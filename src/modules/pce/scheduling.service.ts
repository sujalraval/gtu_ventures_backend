import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { BadRequestError, NotFoundError } from '../../common/utils/apiError';
import { PceService } from './pce.service';
import { LIVE, PCE_COHORT } from './pce.constants';

/**
 * Sections 17-20: selecting for pitch, scheduling, and the calendar.
 *
 * The part worth reading carefully is the conflict detection. Section 19 asks
 * the system to *prevent* five kinds of double-booking, so every write goes
 * through detectConflicts first and a blocking conflict refuses the write.
 * An authorised caller can override with a recorded reason - the same shape as
 * the eligibility override in scheme assignment - because a hard block with no
 * escape hatch is how an admin ends up editing the database by hand.
 *
 * Rescheduling never edits a schedule in place. The old row is deactivated and
 * the new one points back at it through rescheduledFromId, so the history of
 * when a pitch was moved, and from what, survives.
 */

// ── Time helpers ─────────────────────────────────────────────────────────────

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const endOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

const parseDate = (v: unknown, label: string): Date => {
  const d = new Date(String(v ?? ''));
  if (Number.isNaN(d.getTime())) throw new BadRequestError(`${label} is not a valid date`);
  return d;
};

const parseOptionalDate = (v: unknown): Date | null => {
  if (v === undefined || v === null || v === '') return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
};

interface Window {
  date: Date;
  start: Date | null;
  end: Date | null;
  session: string | null;
}

/**
 * End time, derived when only a start and a duration were given.
 *
 * Without this a 20-minute slot entered as "starts at 10:00" would have no
 * end, and every overlap test against it would fall back to the coarse
 * same-session comparison.
 */
const resolveEnd = (start: Date | null, end: Date | null, durationMins?: number | null) => {
  if (end) return end;
  if (start && durationMins && durationMins > 0) {
    return new Date(start.getTime() + durationMins * 60_000);
  }
  return null;
};

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/**
 * Whether two bookings collide.
 *
 * With times on both sides this is plain interval overlap, touching ends
 * excluded so 10:00-10:20 and 10:20-10:40 are back to back rather than
 * clashing. Without times it falls back to the day and session, and a booking
 * with no session is treated as colliding with anything that day - erring
 * towards reporting a conflict, since the cost of a false warning is far lower
 * than two startups sent to the same room.
 */
const overlaps = (a: Window, b: Window): boolean => {
  if (a.start && a.end && b.start && b.end) {
    return a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime();
  }
  if (!sameDay(a.date, b.date)) return false;
  if (!a.session || !b.session) return true;
  return a.session === b.session;
};

const normaliseVenue = (v?: string | null) => String(v ?? '').trim().toLowerCase();

// ── Conflicts ────────────────────────────────────────────────────────────────

export type ConflictType =
  | 'DUPLICATE_STARTUP'
  | 'PANEL_BUSY'
  | 'EVALUATOR_BUSY'
  | 'VENUE_BUSY'
  | 'SLOT_TAKEN';

export interface Conflict {
  type: ConflictType;
  message: string;
  /** False for the one conflict an override cannot clear. */
  overridable: boolean;
  scheduleId?: string;
  applicationNo?: string | null;
  startupName?: string | null;
}

const ACTIVE_SCHEDULE: Prisma.PitchScheduleWhereInput = {
  deletedAt: null,
  isActive: true,
  status: { notIn: ['CANCELLED'] },
};

const scheduleCard = {
  id: true,
  applicationId: true,
  presentationDate: true,
  startTime: true,
  endTime: true,
  durationMins: true,
  reportingTime: true,
  session: true,
  mode: true,
  venue: true,
  meetingLink: true,
  instructions: true,
  remarks: true,
  status: true,
  statusReason: true,
  isActive: true,
  completedAt: true,
  createdAt: true,
  rescheduledFromId: true,
  scheme: { select: { id: true, name: true, code: true } },
  panel: {
    select: {
      id: true,
      name: true,
      sectors: true,
      members: {
        select: {
          role: true,
          evaluator: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  },
  application: {
    select: {
      id: true,
      applicationNo: true,
      startupName: true,
      fullName: true,
      mainSector: true,
      primaryEmail: true,
      email: true,
      status: true,
    },
  },
} satisfies Prisma.PitchScheduleSelect;

export class SchedulingService {
  /**
   * Section 19: every way this booking could collide with an existing one.
   *
   * Returns conflicts rather than throwing, so a caller can show them for
   * confirmation before committing. The write paths below are what refuse.
   */
  static async detectConflicts(input: {
    applicationId: string;
    presentationDate: Date;
    startTime: Date | null;
    endTime: Date | null;
    durationMins?: number | null;
    session?: string | null;
    panelId?: string | null;
    venue?: string | null;
    mode?: string | null;
    /** An existing schedule being replaced, which must not clash with itself. */
    excludeScheduleId?: string | null;
  }): Promise<Conflict[]> {
    const candidate: Window = {
      date: input.presentationDate,
      start: input.startTime,
      end: resolveEnd(input.startTime, input.endTime, input.durationMins),
      session: input.session ?? null,
    };

    const conflicts: Conflict[] = [];

    // 1. Duplicate startup scheduling. Not overridable - two live schedules
    //    for one application is not a judgement call, it is a mistake, and
    //    Reschedule is the operation that was meant.
    const existingForApp = await prisma.pitchSchedule.findFirst({
      where: {
        ...ACTIVE_SCHEDULE,
        applicationId: input.applicationId,
        ...(input.excludeScheduleId ? { id: { not: input.excludeScheduleId } } : {}),
      },
      select: { id: true, presentationDate: true, status: true },
    });
    if (existingForApp) {
      conflicts.push({
        type: 'DUPLICATE_STARTUP',
        overridable: false,
        scheduleId: existingForApp.id,
        message: `This application is already scheduled for ${existingForApp.presentationDate
          .toISOString()
          .slice(0, 10)}. Reschedule that booking instead of creating a second one.`,
      });
    }

    // Everything else only collides within the same calendar day, so the
    // search is scoped to it rather than scanning every schedule ever made.
    const sameDayRows = await prisma.pitchSchedule.findMany({
      where: {
        ...ACTIVE_SCHEDULE,
        presentationDate: {
          gte: startOfDay(input.presentationDate),
          lte: endOfDay(input.presentationDate),
        },
        ...(input.excludeScheduleId ? { id: { not: input.excludeScheduleId } } : {}),
        applicationId: { not: input.applicationId },
      },
      select: {
        id: true,
        presentationDate: true,
        startTime: true,
        endTime: true,
        durationMins: true,
        session: true,
        panelId: true,
        venue: true,
        mode: true,
        application: { select: { applicationNo: true, startupName: true } },
        panel: { select: { id: true, name: true, members: { select: { evaluatorId: true } } } },
      },
    });

    const clashing = sameDayRows.filter((r) =>
      overlaps(candidate, {
        date: r.presentationDate,
        start: r.startTime,
        end: resolveEnd(r.startTime, r.endTime, r.durationMins),
        session: r.session ?? null,
      }),
    );

    // 2 and 5. The same panel cannot hear two startups at once, and an exact
    //    slot match is reported as its own kind so the message is useful.
    if (input.panelId) {
      for (const r of clashing.filter((x) => x.panelId === input.panelId)) {
        const exactSlot =
          !!candidate.start &&
          !!r.startTime &&
          candidate.start.getTime() === r.startTime.getTime();
        conflicts.push({
          type: exactSlot ? 'SLOT_TAKEN' : 'PANEL_BUSY',
          overridable: true,
          scheduleId: r.id,
          applicationNo: r.application?.applicationNo ?? null,
          startupName: r.application?.startupName ?? null,
          message: exactSlot
            ? `${r.panel?.name ?? 'This panel'} already has ${
                r.application?.startupName ?? 'another startup'
              } in this exact slot.`
            : `${r.panel?.name ?? 'This panel'} is already hearing ${
                r.application?.startupName ?? 'another startup'
              } at an overlapping time.`,
        });
      }
    }

    // 3. An evaluator sitting on two panels that overlap cannot attend both.
    //    Checked across panels, which is why it is not covered by the panel
    //    check above.
    if (input.panelId) {
      const panel = await prisma.evaluationPanel.findUnique({
        where: { id: input.panelId },
        select: { id: true, name: true, members: { select: { evaluatorId: true } } },
      });
      const ourEvaluators = new Set((panel?.members ?? []).map((m) => m.evaluatorId));

      if (ourEvaluators.size > 0) {
        const seen = new Set<string>();
        for (const r of clashing) {
          if (!r.panelId || r.panelId === input.panelId) continue;
          const shared = (r.panel?.members ?? [])
            .map((m) => m.evaluatorId)
            .filter((id) => ourEvaluators.has(id));
          // One message per other panel, not one per shared evaluator.
          if (shared.length === 0 || seen.has(r.panelId)) continue;
          seen.add(r.panelId);
          conflicts.push({
            type: 'EVALUATOR_BUSY',
            overridable: true,
            scheduleId: r.id,
            applicationNo: r.application?.applicationNo ?? null,
            startupName: r.application?.startupName ?? null,
            message: `${shared.length} evaluator${
              shared.length === 1 ? '' : 's'
            } on this panel ${shared.length === 1 ? 'is' : 'are'} also on ${
              r.panel?.name ?? 'another panel'
            }, which sits at an overlapping time.`,
          });
        }
      }
    }

    // 4. Venue, for anything with a physical room. An online pitch has no
    //    venue to clash over.
    const venue = normaliseVenue(input.venue);
    if (venue && input.mode !== 'ONLINE') {
      for (const r of clashing) {
        if (r.mode === 'ONLINE') continue;
        if (normaliseVenue(r.venue) !== venue) continue;
        conflicts.push({
          type: 'VENUE_BUSY',
          overridable: true,
          scheduleId: r.id,
          applicationNo: r.application?.applicationNo ?? null,
          startupName: r.application?.startupName ?? null,
          message: `${input.venue} is already booked for ${
            r.application?.startupName ?? 'another startup'
          } at an overlapping time.`,
        });
      }
    }

    return conflicts;
  }

  /** Refuse the write unless the caller overrode what can be overridden. */
  private static assertNoBlockingConflicts(conflicts: Conflict[], overrideReason?: string | null) {
    if (conflicts.length === 0) return;
    const hard = conflicts.filter((c) => !c.overridable);
    if (hard.length > 0) {
      throw new BadRequestError(hard.map((c) => c.message).join(' '));
    }
    if (!overrideReason?.trim()) {
      throw new BadRequestError(
        `${conflicts.length} scheduling conflict${
          conflicts.length === 1 ? '' : 's'
        }: ${conflicts.map((c) => c.message).join(' ')} Provide an override reason to schedule anyway.`,
      );
    }
  }

  // ── Section 17: the Selected for Pitch listing ────────────────────────────

  static async selectedForPitch(params: {
    search?: string;
    schemeId?: string;
    schemeStatus?: string;
    pitchStatus?: string;
    panelId?: string;
    sector?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(params.pageSize) || 40));

    const and: Prisma.StartupApplicationWhereInput[] = [PCE_COHORT];

    if (params.search?.trim()) {
      const q = params.search.trim();
      and.push({
        OR: [
          { applicationNo: { contains: q, mode: 'insensitive' } },
          { startupName: { contains: q, mode: 'insensitive' } },
          { fullName: { contains: q, mode: 'insensitive' } },
        ],
      });
    }
    if (params.sector?.trim()) {
      and.push({ mainSector: { equals: params.sector.trim(), mode: 'insensitive' } });
    }
    if (params.schemeStatus?.trim()) {
      and.push({ pceState: { schemeStatus: params.schemeStatus.trim() as any } });
    }
    if (params.pitchStatus?.trim()) {
      and.push({ pceState: { pitchStatus: params.pitchStatus.trim() as any } });
    }
    if (params.schemeId?.trim()) {
      const id = params.schemeId.trim();
      and.push({
        OR: [
          { pceState: { finalSchemeId: id } },
          { pceState: { provisionalSchemeId: id } },
        ],
      });
    }
    if (params.panelId?.trim()) {
      and.push({ panelAllocations: { some: { panelId: params.panelId.trim() } } });
    }

    const where: Prisma.StartupApplicationWhereInput = { AND: and };

    const [total, rows] = await Promise.all([
      prisma.startupApplication.count({ where }),
      prisma.startupApplication.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          applicationNo: true,
          startupName: true,
          fullName: true,
          mainSector: true,
          status: true,
          createdAt: true,
          scheme: { select: { id: true, name: true, code: true } },
          pceState: {
            select: {
              schemeStatus: true,
              pitchStatus: true,
              evaluationStatus: true,
              onboardingStatus: true,
              provisionalScheme: { select: { id: true, name: true, code: true } },
              finalScheme: { select: { id: true, name: true, code: true } },
            },
          },
          finalSelection: { select: { decision: true } },
          // Preliminary score comes from the screening reviews, which are the
          // existing ApplicationReview rows - not from pitch evaluation.
          reviews: { select: { level: true, totalScore: true, createdAt: true } },
          pitchSchedules: {
            where: ACTIVE_SCHEDULE,
            select: {
              id: true,
              presentationDate: true,
              startTime: true,
              session: true,
              mode: true,
              venue: true,
              status: true,
              panel: { select: { id: true, name: true } },
            },
            take: 1,
            orderBy: { presentationDate: 'desc' },
          },
          panelAllocations: {
            select: { panel: { select: { id: true, name: true } } },
          },
        },
      }),
    ]);

    return {
      items: rows.map((r) => {
        // Averaged over the stages actually reviewed, which is how the review
        // screens present an overall score. Stages never reviewed would drag
        // an average towards zero and misrepresent the applicant.
        const scored = (r.reviews ?? []).filter(
          (v) => typeof v.totalScore === 'number' && v.totalScore > 0,
        );
        const preliminaryScore = scored.length
          ? Math.round((scored.reduce((n, v) => n + Number(v.totalScore), 0) / scored.length) * 10) / 10
          : null;

        const schedule = r.pitchSchedules?.[0] ?? null;
        return {
          id: r.id,
          applicationNo: r.applicationNo,
          startupName: r.startupName,
          fullName: r.fullName,
          mainSector: r.mainSector,
          status: r.status,
          createdAt: r.createdAt,
          preliminaryScore,
          reviewCount: scored.length,
          currentScheme:
            r.pceState?.finalScheme ?? r.pceState?.provisionalScheme ?? r.scheme ?? null,
          isSchemeAssigned: !!r.pceState && r.pceState.schemeStatus !== 'NOT_ASSIGNED',
          pceState: r.pceState,
          finalSelection: r.finalSelection,
          schedule,
          panel: schedule?.panel ?? r.panelAllocations?.[0]?.panel ?? null,
        };
      }),
      total,
      page,
      pageSize,
    };
  }

  // ── Section 18: scheduling ────────────────────────────────────────────────

  /**
   * Schedule one or many applications.
   *
   * With several applications and a start time, slots are laid out one after
   * another using the duration plus any gap - which is what section 19's
   * time-slot example describes. Without a start time they all share the
   * session, which is the session-based alternative in the same section.
   */
  static async schedule(
    input: {
      applicationIds: string[];
      schemeId?: string | null;
      panelId?: string | null;
      presentationDate: string;
      startTime?: string | null;
      endTime?: string | null;
      durationMins?: number | null;
      reportingTime?: string | null;
      session?: string | null;
      mode?: string;
      venue?: string | null;
      meetingLink?: string | null;
      instructions?: string | null;
      remarks?: string | null;
      /** Minutes between consecutive slots when scheduling several at once. */
      gapMins?: number | null;
      overrideReason?: string | null;
    },
    actorId: string,
  ) {
    const ids = Array.from(new Set((input.applicationIds ?? []).filter(Boolean)));
    if (ids.length === 0) throw new BadRequestError('No applications selected');

    const date = parseDate(input.presentationDate, 'Presentation date');
    const baseStart = parseOptionalDate(input.startTime);
    const baseEnd = parseOptionalDate(input.endTime);
    const reportingTime = parseOptionalDate(input.reportingTime);
    const duration = input.durationMins && input.durationMins > 0 ? input.durationMins : null;
    const gap = input.gapMins && input.gapMins > 0 ? input.gapMins : 0;

    if (input.panelId) {
      const panel = await prisma.evaluationPanel.findUnique({
        where: { id: input.panelId },
        select: { id: true },
      });
      if (!panel) throw new NotFoundError('Panel not found');
    }

    const applications = await prisma.startupApplication.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        applicationNo: true,
        startupName: true,
        pceState: { select: { provisionalSchemeId: true, finalSchemeId: true } },
      },
    });
    if (applications.length === 0) throw new NotFoundError('No matching applications');

    const scheduled: Array<{ applicationId: string; scheduleId: string }> = [];
    const skipped: Array<{ applicationId: string; reason: string }> = [];

    /**
     * How long one slot runs.
     *
     * An explicit start and end imply the duration, so a single booking entered
     * as 10:00-11:00 keeps that hour instead of being silently shortened to the
     * default duration - and a batch laid out from the same pair gets hour-long
     * slots rather than 20-minute ones.
     */
    const slotMins =
      duration ??
      (baseStart && baseEnd
        ? Math.max(1, Math.round((baseEnd.getTime() - baseStart.getTime()) / 60_000))
        : null);

    // Successive slots need a per-application offset; one shared window when no
    // start time was given, which is the session-based case.
    const step = (slotMins ?? 0) + gap;

    for (let i = 0; i < applications.length; i++) {
      const app = applications[i];
      const offset = baseStart && step > 0 ? i * step * 60_000 : 0;
      const start = baseStart ? new Date(baseStart.getTime() + offset) : null;
      // Without a start time there is no interval to derive, so an end time
      // given on its own is kept as it was entered.
      const end = start ? resolveEnd(start, null, slotMins) : baseEnd;

      // The scheme on the booking follows the assignment, falling back to
      // whatever the caller chose. It may legitimately be none: section 18
      // allows scheduling before a scheme is decided.
      const schemeId =
        input.schemeId ||
        app.pceState?.finalSchemeId ||
        app.pceState?.provisionalSchemeId ||
        null;

      try {
        const conflicts = await this.detectConflicts({
          applicationId: app.id,
          presentationDate: date,
          startTime: start,
          endTime: end,
          durationMins: slotMins,
          session: input.session ?? null,
          panelId: input.panelId ?? null,
          venue: input.venue ?? null,
          mode: input.mode ?? 'OFFLINE',
        });
        this.assertNoBlockingConflicts(conflicts, input.overrideReason);

        const created = await prisma.pitchSchedule.create({
          data: {
            applicationId: app.id,
            schemeId,
            panelId: input.panelId || null,
            presentationDate: date,
            startTime: start,
            endTime: end,
            // slotMins, so a booking entered as a start and end keeps that
            // length on the record rather than a null the UI cannot explain.
            durationMins: slotMins,
            reportingTime,
            session: (input.session as any) || null,
            mode: (input.mode as any) || 'OFFLINE',
            venue: input.venue ?? null,
            meetingLink: input.meetingLink ?? null,
            instructions: input.instructions ?? null,
            remarks: input.remarks ?? null,
            status: 'SCHEDULED',
            statusReason: input.overrideReason?.trim()
              ? `Scheduled over a conflict: ${input.overrideReason.trim()}`
              : null,
            createdBy: actorId,
          },
          select: { id: true },
        });

        await PceService.ensureState(app.id);
        await prisma.applicationPceState.update({
          where: { applicationId: app.id },
          data: { pitchStatus: 'SCHEDULED' },
        });

        // Allocating the application to the panel is implied by scheduling it
        // there - section 15 lists Application Allocation on the panel, and an
        // evaluator sees nothing without it.
        if (input.panelId) {
          await prisma.panelApplication
            .create({
              data: { panelId: input.panelId, applicationId: app.id, allocatedBy: actorId },
            })
            .catch((e: any) => {
              // Already allocated is the expected case on a reschedule.
              if (e?.code !== 'P2002') throw e;
            });
        }

        scheduled.push({ applicationId: app.id, scheduleId: created.id });
      } catch (e: any) {
        // Per application, so one clash does not discard the rest of the batch.
        skipped.push({ applicationId: app.id, reason: e?.message || 'Could not schedule' });
      }
    }

    const found = new Set(applications.map((a) => a.id));
    ids
      .filter((id) => !found.has(id))
      .forEach((id) => skipped.push({ applicationId: id, reason: 'Application not found' }));

    return {
      scheduledCount: scheduled.length,
      skippedCount: skipped.length,
      scheduled,
      skipped,
    };
  }

  /**
   * Section 20: move a pitch.
   *
   * A new row superseding the old one rather than an edit, so "this was moved
   * from the 3rd" remains answerable.
   */
  static async reschedule(
    scheduleId: string,
    input: {
      presentationDate: string;
      startTime?: string | null;
      endTime?: string | null;
      durationMins?: number | null;
      reportingTime?: string | null;
      session?: string | null;
      mode?: string;
      venue?: string | null;
      meetingLink?: string | null;
      panelId?: string | null;
      instructions?: string | null;
      remarks?: string | null;
      reason: string;
      overrideReason?: string | null;
    },
    actorId: string,
  ) {
    if (!input.reason?.trim()) {
      throw new BadRequestError('A reason is required to reschedule a pitch');
    }

    const existing = await prisma.pitchSchedule.findUnique({
      where: { id: scheduleId },
      select: {
        id: true,
        applicationId: true,
        schemeId: true,
        panelId: true,
        isActive: true,
        status: true,
      },
    });
    if (!existing) throw new NotFoundError('Schedule not found');
    if (!existing.isActive) {
      throw new BadRequestError('This schedule has already been superseded');
    }

    const date = parseDate(input.presentationDate, 'Presentation date');
    const start = parseOptionalDate(input.startTime);
    const requested = input.durationMins && input.durationMins > 0 ? input.durationMins : null;
    const end = resolveEnd(start, parseOptionalDate(input.endTime), requested);
    // Derived the same way as a first schedule, so the two paths cannot record
    // a different length for the same pair of times.
    const duration =
      requested ??
      (start && end ? Math.max(1, Math.round((end.getTime() - start.getTime()) / 60_000)) : null);
    const panelId = input.panelId !== undefined ? input.panelId || null : existing.panelId;

    const conflicts = await this.detectConflicts({
      applicationId: existing.applicationId,
      presentationDate: date,
      startTime: start,
      endTime: end,
      durationMins: duration,
      session: input.session ?? null,
      panelId,
      venue: input.venue ?? null,
      mode: input.mode ?? 'OFFLINE',
      // Its own booking is not a conflict with itself.
      excludeScheduleId: scheduleId,
    });
    this.assertNoBlockingConflicts(conflicts, input.overrideReason);

    const [, created] = await prisma.$transaction([
      prisma.pitchSchedule.update({
        where: { id: scheduleId },
        data: {
          isActive: false,
          status: 'RESCHEDULED',
          statusReason: input.reason.trim(),
        },
      }),
      prisma.pitchSchedule.create({
        data: {
          applicationId: existing.applicationId,
          schemeId: existing.schemeId,
          panelId,
          presentationDate: date,
          startTime: start,
          endTime: end,
          durationMins: duration,
          reportingTime: parseOptionalDate(input.reportingTime),
          session: (input.session as any) || null,
          mode: (input.mode as any) || 'OFFLINE',
          venue: input.venue ?? null,
          meetingLink: input.meetingLink ?? null,
          instructions: input.instructions ?? null,
          remarks: input.remarks ?? null,
          status: 'SCHEDULED',
          rescheduledFromId: scheduleId,
          createdBy: actorId,
        },
        select: { id: true },
      }),
    ]);

    // The application's pitch status records that it was moved, even though
    // the booking now in force is itself simply scheduled.
    await prisma.applicationPceState.update({
      where: { applicationId: existing.applicationId },
      data: { pitchStatus: 'RESCHEDULED' },
    });

    return { id: created.id, supersededId: scheduleId };
  }

  static async cancel(scheduleId: string, reason: string) {
    if (!reason?.trim()) throw new BadRequestError('A reason is required to cancel a pitch');

    const existing = await prisma.pitchSchedule.findUnique({
      where: { id: scheduleId },
      select: { id: true, applicationId: true },
    });
    if (!existing) throw new NotFoundError('Schedule not found');

    await prisma.$transaction([
      prisma.pitchSchedule.update({
        where: { id: scheduleId },
        data: { status: 'CANCELLED', isActive: false, statusReason: reason.trim() },
      }),
      prisma.applicationPceState.update({
        where: { applicationId: existing.applicationId },
        data: { pitchStatus: 'CANCELLED' },
      }),
    ]);

    return { id: scheduleId };
  }

  /** Marks the presentation as having happened, which opens evaluation. */
  static async markCompleted(scheduleId: string) {
    const existing = await prisma.pitchSchedule.findUnique({
      where: { id: scheduleId },
      select: { id: true, applicationId: true, status: true },
    });
    if (!existing) throw new NotFoundError('Schedule not found');
    if (existing.status === 'CANCELLED') {
      throw new BadRequestError('A cancelled pitch cannot be marked completed');
    }

    await prisma.$transaction([
      prisma.pitchSchedule.update({
        where: { id: scheduleId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      }),
      prisma.applicationPceState.update({
        where: { applicationId: existing.applicationId },
        data: { pitchStatus: 'COMPLETED' },
      }),
    ]);

    return { id: scheduleId };
  }

  static async updateSchedule(
    scheduleId: string,
    input: { venue?: string | null; meetingLink?: string | null; instructions?: string | null; remarks?: string | null; panelId?: string | null },
    actorId: string,
  ) {
    const existing = await prisma.pitchSchedule.findUnique({
      where: { id: scheduleId },
      select: {
        id: true,
        applicationId: true,
        presentationDate: true,
        startTime: true,
        endTime: true,
        durationMins: true,
        session: true,
        panelId: true,
        mode: true,
      },
    });
    if (!existing) throw new NotFoundError('Schedule not found');

    // Changing the venue or the panel can create a clash, so those go through
    // the same checks. Instructions and remarks cannot.
    const venueChanging = input.venue !== undefined;
    const panelChanging = input.panelId !== undefined && input.panelId !== existing.panelId;

    if (venueChanging || panelChanging) {
      const conflicts = await this.detectConflicts({
        applicationId: existing.applicationId,
        presentationDate: existing.presentationDate,
        startTime: existing.startTime,
        endTime: existing.endTime,
        durationMins: existing.durationMins,
        session: existing.session,
        panelId: panelChanging ? input.panelId || null : existing.panelId,
        venue: venueChanging ? input.venue : undefined,
        mode: existing.mode,
        excludeScheduleId: scheduleId,
      });
      this.assertNoBlockingConflicts(conflicts, null);
    }

    const updated = await prisma.pitchSchedule.update({
      where: { id: scheduleId },
      data: {
        ...(input.venue !== undefined ? { venue: input.venue } : {}),
        ...(input.meetingLink !== undefined ? { meetingLink: input.meetingLink } : {}),
        ...(input.instructions !== undefined ? { instructions: input.instructions } : {}),
        ...(input.remarks !== undefined ? { remarks: input.remarks } : {}),
        ...(input.panelId !== undefined ? { panelId: input.panelId || null } : {}),
      },
      select: { id: true },
    });

    if (panelChanging && input.panelId) {
      await prisma.panelApplication
        .create({
          data: { panelId: input.panelId, applicationId: existing.applicationId, allocatedBy: actorId },
        })
        .catch((e: any) => {
          if (e?.code !== 'P2002') throw e;
        });
    }

    return updated;
  }

  // ── Section 20: the calendar ──────────────────────────────────────────────

  /**
   * Schedules in a date range, for every view the calendar offers.
   *
   * Day, week and date views differ only by the range the caller asks for, and
   * session, panel and scheme views are groupings of the same rows - so this
   * returns the rows and the frontend arranges them, rather than six endpoints
   * that could disagree.
   */
  static async calendar(params: {
    from?: string;
    to?: string;
    panelId?: string;
    schemeId?: string;
    session?: string;
    mode?: string;
    status?: string;
    includeCancelled?: string | boolean;
  }) {
    const from = params.from ? startOfDay(parseDate(params.from, 'From date')) : startOfDay(new Date());
    const to = params.to ? endOfDay(parseDate(params.to, 'To date')) : endOfDay(from);

    const includeCancelled =
      params.includeCancelled === true || params.includeCancelled === 'true';

    const rows = await prisma.pitchSchedule.findMany({
      where: {
        deletedAt: null,
        // Superseded rows are history, not calendar entries.
        isActive: true,
        ...(includeCancelled ? {} : { status: { notIn: ['CANCELLED'] } }),
        presentationDate: { gte: from, lte: to },
        ...(params.panelId ? { panelId: params.panelId } : {}),
        ...(params.schemeId ? { schemeId: params.schemeId } : {}),
        ...(params.session ? { session: params.session as any } : {}),
        ...(params.mode ? { mode: params.mode as any } : {}),
        ...(params.status ? { status: params.status as any } : {}),
        application: LIVE,
      },
      select: scheduleCard,
      orderBy: [{ presentationDate: 'asc' }, { startTime: 'asc' }],
    });

    return {
      items: rows,
      from: from.toISOString(),
      to: to.toISOString(),
      total: rows.length,
    };
  }

  static async getSchedule(scheduleId: string) {
    const schedule = await prisma.pitchSchedule.findUnique({
      where: { id: scheduleId },
      select: {
        ...scheduleCard,
        invitations: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!schedule) throw new NotFoundError('Schedule not found');
    return schedule;
  }

  /** The reschedule chain for one application, newest first. */
  static async scheduleHistory(applicationId: string) {
    const rows = await prisma.pitchSchedule.findMany({
      where: { applicationId, deletedAt: null },
      select: scheduleCard,
      orderBy: { createdAt: 'desc' },
    });
    return { items: rows, total: rows.length };
  }
}

export default SchedulingService;
