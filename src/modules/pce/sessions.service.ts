import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { BadRequestError, NotFoundError } from '../../common/utils/apiError';
import { PceService } from './pce.service';
import { SchedulingService } from './scheduling.service';
import { LIVE } from './pce.constants';

/**
 * The pitching calendar: sessions, and the applications assigned to them.
 *
 * A session is one sitting - a date, a time window, a venue, a round and a
 * capacity. The "calendar" is the collection of them, grouped by date, which is
 * why there is no separate calendar table: it would carry the same date, time
 * and venue fields and give them a second place to disagree.
 *
 * Assigning an application to a session creates a PitchSchedule through the
 * existing scheduling service, so section 19's conflict checks apply here too
 * rather than being bypassed by a second write path.
 */

/** How close to a sitting an assignment is considered late. */
const LEAD_TIME_HOURS = 2;

const schemeRef = { id: true, name: true, code: true } as const;

const sessionSelect = {
  id: true,
  name: true,
  round: true,
  presentationDate: true,
  startTime: true,
  endTime: true,
  session: true,
  reportingTime: true,
  mode: true,
  venue: true,
  meetingLink: true,
  capacity: true,
  instructions: true,
  remarks: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  scheme: { select: schemeRef },
  panels: {
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      status: true,
      requiredEvaluators: true,
      confirmedAt: true,
      mandateId: true,
      _count: { select: { members: true } },
    },
  },
  schedules: {
    where: { deletedAt: null, isActive: true, status: { notIn: ['CANCELLED'] as any } },
    select: {
      id: true,
      status: true,
      startTime: true,
      startupNotifiedAt: true,
      createdAt: true,
      application: {
        select: { id: true, applicationNo: true, startupName: true, mainSector: true },
      },
      panel: { select: { id: true, name: true } },
    },
    orderBy: { startTime: 'asc' },
  },
} satisfies Prisma.PitchingSessionSelect;

export class SessionsService {
  static async list(params: {
    schemeId?: string;
    round?: string;
    status?: string;
    from?: string;
    to?: string;
  }) {
    const and: Prisma.PitchingSessionWhereInput[] = [LIVE];

    if (params.schemeId?.trim()) and.push({ schemeId: params.schemeId.trim() });
    if (params.round?.trim()) {
      and.push({ round: { equals: params.round.trim(), mode: 'insensitive' } });
    }
    if (params.status?.trim()) and.push({ status: params.status.trim() as any });

    const range = this.dayRange(params.from, params.to);
    if (range) and.push({ presentationDate: range });

    const rows = await prisma.pitchingSession.findMany({
      where: { AND: and },
      select: sessionSelect,
      orderBy: [{ presentationDate: 'asc' }, { startTime: 'asc' }],
    });

    return { items: rows.map((r) => this.present(r)), total: rows.length };
  }

  /** The distinct rounds in use, so the UI can offer them without a master. */
  static async rounds() {
    const rows = await prisma.pitchingSession.findMany({
      where: { ...LIVE, round: { not: null } },
      select: { round: true },
      distinct: ['round'],
      orderBy: { round: 'asc' },
    });
    return { rounds: rows.map((r) => r.round).filter(Boolean) as string[] };
  }

  static async getById(id: string) {
    const row = await prisma.pitchingSession.findUnique({ where: { id }, select: sessionSelect });
    if (!row) throw new NotFoundError('Pitching session not found');
    return this.present(row);
  }

  static async create(
    input: {
      schemeId?: string | null;
      name: string;
      round?: string | null;
      presentationDate: string;
      startTime?: string | null;
      endTime?: string | null;
      session?: string | null;
      reportingTime?: string | null;
      mode?: string;
      venue?: string | null;
      meetingLink?: string | null;
      capacity?: number | null;
      instructions?: string | null;
      remarks?: string | null;
      status?: string;
    },
    actorId: string,
  ) {
    const date = this.parseDate(input.presentationDate, 'Presentation date');
    this.assertWindow(input.startTime, input.endTime);

    return prisma.pitchingSession.create({
      data: {
        schemeId: input.schemeId || null,
        name: input.name.trim(),
        round: input.round?.trim() || null,
        presentationDate: date,
        startTime: this.parseOptional(input.startTime),
        endTime: this.parseOptional(input.endTime),
        session: (input.session as any) || null,
        reportingTime: this.parseOptional(input.reportingTime),
        mode: (input.mode as any) ?? 'OFFLINE',
        venue: input.venue ?? null,
        meetingLink: input.meetingLink ?? null,
        capacity:
          input.capacity == null ? null : Math.max(1, Number(input.capacity) || 1),
        instructions: input.instructions ?? null,
        remarks: input.remarks ?? null,
        status: (input.status as any) ?? 'DRAFT',
        createdBy: actorId,
      },
      select: { id: true, name: true },
    });
  }

  static async update(id: string, input: Record<string, any>) {
    const existing = await prisma.pitchingSession.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundError('Pitching session not found');

    if (input.startTime !== undefined || input.endTime !== undefined) {
      this.assertWindow(input.startTime, input.endTime);
    }

    return prisma.pitchingSession.update({
      where: { id },
      data: {
        ...(input.schemeId !== undefined ? { schemeId: input.schemeId || null } : {}),
        ...(input.name !== undefined ? { name: String(input.name).trim() } : {}),
        ...(input.round !== undefined ? { round: input.round?.trim() || null } : {}),
        ...(input.presentationDate !== undefined
          ? { presentationDate: this.parseDate(input.presentationDate, 'Presentation date') }
          : {}),
        ...(input.startTime !== undefined
          ? { startTime: this.parseOptional(input.startTime) }
          : {}),
        ...(input.endTime !== undefined ? { endTime: this.parseOptional(input.endTime) } : {}),
        ...(input.session !== undefined ? { session: (input.session as any) || null } : {}),
        ...(input.reportingTime !== undefined
          ? { reportingTime: this.parseOptional(input.reportingTime) }
          : {}),
        ...(input.mode !== undefined ? { mode: input.mode as any } : {}),
        ...(input.venue !== undefined ? { venue: input.venue } : {}),
        ...(input.meetingLink !== undefined ? { meetingLink: input.meetingLink } : {}),
        ...(input.capacity !== undefined
          ? { capacity: input.capacity == null ? null : Math.max(1, Number(input.capacity) || 1) }
          : {}),
        ...(input.instructions !== undefined ? { instructions: input.instructions } : {}),
        ...(input.remarks !== undefined ? { remarks: input.remarks } : {}),
        ...(input.status !== undefined ? { status: input.status as any } : {}),
      },
      select: { id: true, name: true },
    });
  }

  /** Soft delete. Bookings made from it keep pointing at it. */
  static async remove(id: string) {
    const existing = await prisma.pitchingSession.findUnique({
      where: { id },
      select: { id: true, _count: { select: { schedules: true, panels: true } } },
    });
    if (!existing) throw new NotFoundError('Pitching session not found');

    await prisma.pitchingSession.delete({ where: { id } });
    return {
      id,
      hadSchedules: existing._count.schedules > 0,
      hadPanels: existing._count.panels > 0,
    };
  }

  /**
   * Put applications into a session.
   *
   * Goes through SchedulingService.schedule so the conflict checks in section 19
   * still apply - a second write path here would be a way to double-book that
   * the calendar screen could not see.
   */
  static async assignApplications(
    sessionId: string,
    input: { applicationIds: string[]; panelId?: string | null; gapMins?: number | null; overrideReason?: string | null },
    actorId: string,
  ) {
    const session = await prisma.pitchingSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        schemeId: true,
        presentationDate: true,
        startTime: true,
        endTime: true,
        session: true,
        reportingTime: true,
        mode: true,
        venue: true,
        meetingLink: true,
        capacity: true,
        instructions: true,
        _count: { select: { schedules: true } },
      },
    });
    if (!session) throw new NotFoundError('Pitching session not found');

    const ids = Array.from(new Set((input.applicationIds ?? []).filter(Boolean)));
    if (ids.length === 0) throw new BadRequestError('No applications selected');

    // Capacity is the point of recording it, so it is enforced rather than
    // displayed and ignored.
    if (session.capacity != null) {
      const already = await prisma.pitchSchedule.count({
        where: {
          sessionId,
          deletedAt: null,
          isActive: true,
          status: { notIn: ['CANCELLED'] },
        },
      });
      const room = session.capacity - already;
      if (room <= 0) {
        throw new BadRequestError(
          `This session is full (${session.capacity} startups). Raise the capacity or use another session.`,
        );
      }
      if (ids.length > room) {
        throw new BadRequestError(
          `Only ${room} place${room === 1 ? '' : 's'} left in this session; ${ids.length} were selected.`,
        );
      }
    }

    // Slot length derived from the session window when it has one, so a
    // three-hour sitting of six startups lays out sensibly by default.
    const windowMins =
      session.startTime && session.endTime
        ? Math.max(
            1,
            Math.round((session.endTime.getTime() - session.startTime.getTime()) / 60_000),
          )
        : null;
    const perSlot = windowMins ? Math.max(5, Math.floor(windowMins / ids.length)) : 20;

    const result = await SchedulingService.schedule(
      {
        applicationIds: ids,
        schemeId: session.schemeId,
        panelId: input.panelId ?? null,
        presentationDate: session.presentationDate.toISOString(),
        startTime: session.startTime ? session.startTime.toISOString() : null,
        endTime: null,
        durationMins: perSlot,
        reportingTime: session.reportingTime ? session.reportingTime.toISOString() : null,
        session: session.session,
        mode: session.mode,
        venue: session.venue,
        meetingLink: session.meetingLink,
        instructions: session.instructions,
        gapMins: input.gapMins ?? 0,
        overrideReason: input.overrideReason ?? null,
      },
      actorId,
    );

    // Tie the new bookings to this session. schedule() does not know about
    // sessions, which keeps that service unaware of the calendar.
    const scheduleIds = (result.scheduled ?? []).map((s) => s.scheduleId);
    if (scheduleIds.length > 0) {
      await prisma.pitchSchedule.updateMany({
        where: { id: { in: scheduleIds } },
        data: { sessionId },
      });
    }

    return { ...result, sessionId };
  }

  /** Take an application out of a session without cancelling its booking. */
  static async detach(scheduleId: string) {
    const existing = await prisma.pitchSchedule.findUnique({
      where: { id: scheduleId },
      select: { id: true, sessionId: true },
    });
    if (!existing) throw new NotFoundError('Booking not found');
    await prisma.pitchSchedule.update({ where: { id: scheduleId }, data: { sessionId: null } });
    return { id: scheduleId };
  }

  // ── Presentation ──────────────────────────────────────────────────────────

  /**
   * The derived figures a calendar row needs.
   *
   * Includes the lead-time check: the spec requires details to reach evaluators
   * at least two hours before a sitting, so an assignment made inside that
   * window is flagged. Nothing is hidden - the requirement is a guarantee of
   * notice, not a restriction on access, and hiding an application would stop
   * an evaluator preparing at all.
   */
  private static present(r: any) {
    const schedules = r.schedules ?? [];
    const panels = r.panels ?? [];

    const start = r.startTime ?? r.presentationDate;
    const cutoff = start ? new Date(new Date(start).getTime() - LEAD_TIME_HOURS * 3_600_000) : null;

    const lateAssignments = cutoff
      ? schedules.filter((s: any) => new Date(s.createdAt).getTime() > cutoff.getTime())
      : [];

    const confirmedPanels = panels.filter((p: any) => !!p.confirmedAt);

    return {
      ...r,
      assignedCount: schedules.length,
      remainingCapacity:
        r.capacity == null ? null : Math.max(0, r.capacity - schedules.length),
      isFull: r.capacity != null && schedules.length >= r.capacity,
      panelCount: panels.length,
      confirmedPanelCount: confirmedPanels.length,
      /** Panels seated but not yet confirmed; startups wait on these. */
      unconfirmedPanelCount: panels.length - confirmedPanels.length,
      notifiedCount: schedules.filter((s: any) => !!s.startupNotifiedAt).length,
      leadTimeHours: LEAD_TIME_HOURS,
      /** Assignments made inside the notice window. */
      lateAssignmentCount: lateAssignments.length,
      lateAssignments: lateAssignments.map((s: any) => ({
        scheduleId: s.id,
        startupName: s.application?.startupName,
        assignedAt: s.createdAt,
      })),
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private static parseDate(v: unknown, label: string) {
    const d = new Date(String(v ?? ''));
    if (Number.isNaN(d.getTime())) throw new BadRequestError(`${label} is not a valid date`);
    return d;
  }

  private static parseOptional(v: unknown) {
    if (v === undefined || v === null || v === '') return null;
    const d = new Date(String(v));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  private static assertWindow(startTime?: unknown, endTime?: unknown) {
    const s = this.parseOptional(startTime);
    const e = this.parseOptional(endTime);
    if (s && e && e.getTime() <= s.getTime()) {
      throw new BadRequestError('The session end time must be after its start time.');
    }
  }

  static dayRange(from?: string, to?: string) {
    const gte = from ? new Date(from) : null;
    const lte = to ? new Date(to) : null;
    if (gte && !Number.isNaN(gte.getTime())) gte.setHours(0, 0, 0, 0);
    if (lte && !Number.isNaN(lte.getTime())) lte.setHours(23, 59, 59, 999);
    const ok = (d: Date | null) => !!d && !Number.isNaN(d.getTime());
    if (!ok(gte) && !ok(lte)) return undefined;
    return { ...(ok(gte) ? { gte: gte as Date } : {}), ...(ok(lte) ? { lte: lte as Date } : {}) };
  }
}

export default SessionsService;
