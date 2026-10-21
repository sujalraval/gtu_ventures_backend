import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { BadRequestError, NotFoundError } from '../../common/utils/apiError';
import { PceService } from './pce.service';
import {
  LIVE,
  PCE_COHORT,
  NO_SCHEME_ASSIGNED,
  DECIDED_SCHEME_STATUSES,
  DECIDED,
  ONBOARDING_NOT_STARTED,
  APPROVED_DECISIONS,
} from './pce.constants';

/**
 * Sections 2 and 6-10: assigning, changing and confirming the scheme an
 * application is incubated under.
 *
 * The one rule everything here is built around: an assignment is never
 * overwritten in place. ApplicationPceState says where things stand now and
 * SchemeAssignmentHistory records every step that got there, so the previous
 * scheme is always recoverable. Section 7 requires exactly that, and it is why
 * every write below goes through writeAssignment rather than touching the
 * state row directly.
 *
 * The scheme an applicant chose on the form stays on StartupApplication and is
 * never written here. It is a different fact from the scheme the institute
 * assigns, and conflating them would make every application look assigned.
 */

/** What an assign request is trying to do, and what it means for the record. */
const MODES = {
  SUGGEST: { status: 'SUGGESTED', kind: 'SUGGESTED', action: 'SUGGESTED', target: 'provisional' },
  PROVISIONAL: { status: 'PROVISIONALLY_ASSIGNED', kind: 'PROVISIONAL', action: 'ASSIGNED', target: 'provisional' },
  ASSIGN: { status: 'ASSIGNED', kind: 'PROVISIONAL', action: 'ASSIGNED', target: 'provisional' },
  CONFIRM: { status: 'CONFIRMED', kind: 'FINAL', action: 'CONFIRMED', target: 'final' },
  FINAL_APPROVE: { status: 'FINAL_APPROVED', kind: 'FINAL', action: 'FINAL_APPROVED', target: 'final' },
} as const;

export type AssignMode = keyof typeof MODES;

const ONBOARDING_PENDING_SET = new Set<string>(ONBOARDING_NOT_STARTED);
const APPROVED_DECISIONS_SET = new Set<string>(APPROVED_DECISIONS);

const displayName = (u: { name: string | null; email: string } | null | undefined) =>
  u?.name?.trim() || u?.email || 'Unknown user';

/** Resolve a set of bare user ids to display names in one query. */
async function resolveActors(ids: Array<string | null | undefined>) {
  const unique = Array.from(new Set(ids.filter((v): v is string => !!v)));
  if (unique.length === 0) return new Map<string, string>();
  const users = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true, email: true },
  });
  return new Map(users.map((u) => [u.id, displayName(u)]));
}

const schemeSelect = { id: true, name: true, code: true } as const;

const lower = (v: unknown) => String(v ?? '').trim().toLowerCase();

export class SchemeAssignmentService {
  // ── Section 2: the listing ────────────────────────────────────────────────

  static async listApplications(params: {
    search?: string;
    /** Matches the assigned scheme, falling back to the applied-under one. */
    schemeId?: string;
    schemeStatus?: string;
    pitchStatus?: string;
    evaluationStatus?: string;
    onboardingStatus?: string;
    sector?: string;
    status?: string;
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
          { primaryEmail: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      });
    }

    if (params.sector?.trim()) {
      and.push({ mainSector: { equals: params.sector.trim(), mode: 'insensitive' } });
    }
    if (params.status?.trim()) {
      and.push({ status: params.status.trim() as any });
    }

    // "Scheme Not Assigned" has to match both an explicit NOT_ASSIGNED row and
    // no row at all, because state rows are created lazily.
    if (params.schemeStatus === 'NOT_ASSIGNED') {
      and.push({
        ...NO_SCHEME_ASSIGNED,
      });
    } else if (params.schemeStatus === 'ASSIGNED_ANY') {
      and.push({ pceState: { schemeStatus: { in: DECIDED_SCHEME_STATUSES as any } } });
    } else if (params.schemeStatus?.trim()) {
      and.push({ pceState: { schemeStatus: params.schemeStatus.trim() as any } });
    }

    if (params.pitchStatus?.trim()) {
      const v = params.pitchStatus.trim();
      // The dashboard's "Pitch Scheduled" card covers rescheduled too.
      and.push({
        pceState:
          v === 'SCHEDULED'
            ? { pitchStatus: { in: ['SCHEDULED', 'RESCHEDULED'] } }
            : { pitchStatus: v as any },
      });
    }
    if (params.evaluationStatus?.trim()) {
      and.push({ pceState: { evaluationStatus: params.evaluationStatus.trim() as any } });
    }
    if (params.onboardingStatus?.trim()) {
      const v = params.onboardingStatus.trim();
      if (v === 'PENDING_ANY') {
        and.push({ pceState: { onboardingStatus: { in: ONBOARDING_NOT_STARTED as any } } });
      } else if (v === 'IN_PROGRESS_ANY') {
        and.push({
          pceState: {
            onboardingStatus: {
              in: ['DOCUMENTS_PENDING', 'VERIFICATION_PENDING', 'AGREEMENT_PENDING', 'FINAL_APPROVAL_PENDING'] as any,
            },
          },
        });
      } else {
        and.push({ pceState: { onboardingStatus: v as any } });
      }
    }

    // A scheme filter has to consider all three places a scheme can sit, or
    // filtering by scheme would hide everything not yet assigned to it.
    if (params.schemeId?.trim()) {
      const id = params.schemeId.trim();
      and.push({
        OR: [
          { pceState: { finalSchemeId: id } },
          { pceState: { provisionalSchemeId: id } },
          { AND: [{ schemeId: id }, { OR: [{ pceState: { is: null } }, { pceState: { schemeStatus: 'NOT_ASSIGNED' } }] }] },
        ],
      });
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
          currentLevel: true,
          createdAt: true,
          scheme: { select: schemeSelect },
          pceState: {
            select: {
              schemeStatus: true,
              pitchStatus: true,
              evaluationStatus: true,
              onboardingStatus: true,
              schemeAssignedBy: true,
              schemeAssignedAt: true,
              schemeRemarks: true,
              eligibilityVerdict: true,
              provisionalScheme: { select: schemeSelect },
              finalScheme: { select: schemeSelect },
            },
          },
          finalSelection: { select: { decision: true, grantApproved: true } },
        },
      }),
    ]);

    const actors = await resolveActors(rows.map((r) => r.pceState?.schemeAssignedBy));

    return {
      items: rows.map((r) => ({
        ...r,
        // Resolved here so every screen shows the same name for the same id.
        assignedByName: r.pceState?.schemeAssignedBy
          ? actors.get(r.pceState.schemeAssignedBy) ?? 'Unknown user'
          : null,
        currentScheme: r.pceState?.finalScheme ?? r.pceState?.provisionalScheme ?? r.scheme ?? null,
        /** False when the only scheme on the row is the one applied under. */
        isSchemeAssigned: !!r.pceState && r.pceState.schemeStatus !== 'NOT_ASSIGNED',
      })),
      total,
      page,
      pageSize,
    };
  }

  // ── Sections 2, 6: assign, one or many ────────────────────────────────────

  /**
   * The single write path for an assignment.
   *
   * Everything - single, bulk, change, confirm - comes through here so that no
   * code path can update the state row without also appending to the history.
   */
  private static async writeAssignment(opts: {
    applicationId: string;
    schemeId: string;
    previousSchemeId: string | null;
    /** Set when a final scheme was already approved, so it can be reopened. */
    previousFinalSchemeId?: string | null;
    status: string;
    kind: string;
    action: string;
    target: 'provisional' | 'final';
    actorId: string;
    reason?: string | null;
    remarks?: string | null;
    overrideReason?: string | null;
  }) {
    const now = new Date();

    const stateData: Prisma.ApplicationPceStateUpdateInput = {
      schemeStatus: opts.status as any,
      schemeAssignedBy: opts.actorId,
      schemeAssignedAt: now,
      schemeRemarks: opts.remarks ?? null,
    };

    if (opts.target === 'final') {
      stateData.finalScheme = { connect: { id: opts.schemeId } };
      stateData.schemeApprovedBy = opts.actorId;
      stateData.schemeApprovedAt = now;
    } else {
      stateData.provisionalScheme = { connect: { id: opts.schemeId } };
      // Going back to a provisional scheme reopens the final decision, so the
      // previously approved scheme has to be cleared with it. Leaving it set
      // would make the current scheme - final ?? provisional - still resolve
      // to the old one, and the change would not show anywhere.
      if (opts.previousFinalSchemeId) {
        stateData.finalScheme = { disconnect: true };
        stateData.schemeApprovedBy = null;
        stateData.schemeApprovedAt = null;
      }
    }

    if (opts.overrideReason) {
      stateData.eligibilityOverrideReason = opts.overrideReason;
    }

    return prisma.$transaction([
      prisma.applicationPceState.update({
        where: { applicationId: opts.applicationId },
        data: stateData,
      }),
      prisma.schemeAssignmentHistory.create({
        data: {
          applicationId: opts.applicationId,
          schemeId: opts.schemeId,
          previousSchemeId: opts.previousSchemeId,
          kind: opts.kind as any,
          action: opts.action as any,
          reason: opts.reason ?? null,
          remarks: opts.remarks ?? null,
          performedBy: opts.actorId,
          performedAt: now,
        },
      }),
    ]);
  }

  static async assign(
    input: {
      applicationIds: string[];
      schemeId: string;
      mode?: AssignMode;
      remarks?: string | null;
      overrideReason?: string | null;
    },
    actorId: string,
  ) {
    const mode = MODES[input.mode ?? 'PROVISIONAL'];
    if (!mode) throw new BadRequestError('Unknown assignment mode');

    // The UI can send the same id twice when a row appears in two selections.
    const ids = Array.from(new Set((input.applicationIds ?? []).filter(Boolean)));
    if (ids.length === 0) throw new BadRequestError('No applications selected');

    const scheme = await prisma.scheme.findUnique({
      where: { id: input.schemeId },
      select: { id: true, name: true, code: true, status: true },
    });
    if (!scheme) throw new NotFoundError('Scheme not found');

    const applications = await prisma.startupApplication.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        applicationNo: true,
        startupName: true,
        schemeId: true,
        pceState: {
          select: { schemeStatus: true, provisionalSchemeId: true, finalSchemeId: true },
        },
      },
    });
    if (applications.length === 0) throw new NotFoundError('No matching applications');

    const assigned: string[] = [];
    const skipped: Array<{ applicationId: string; reason: string }> = [];

    for (const app of applications) {
      const state = app.pceState;
      const currentId = state?.finalSchemeId ?? state?.provisionalSchemeId ?? null;

      // Already on this scheme at this status: writing it again would add a
      // history row that records nothing having happened.
      if (currentId === input.schemeId && state?.schemeStatus === mode.status) {
        skipped.push({ applicationId: app.id, reason: 'Already assigned this scheme at this status' });
        continue;
      }

      // Changing an assigned scheme needs a reason, which this endpoint does
      // not take - section 7 has its own path for that.
      if (currentId && currentId !== input.schemeId && DECIDED.has(state?.schemeStatus ?? '')) {
        skipped.push({
          applicationId: app.id,
          reason: 'Already has a different scheme — use Change Scheme, which records a reason',
        });
        continue;
      }

      try {
        // The listing above already told us whether a state row exists, so
        // ensureState is only needed when it does not.
        if (!state) await PceService.ensureState(app.id);
        await this.writeAssignment({
          applicationId: app.id,
          schemeId: input.schemeId,
          previousSchemeId: currentId,
          previousFinalSchemeId: state?.finalSchemeId ?? null,
          status: mode.status,
          kind: mode.kind,
          action: mode.action,
          target: mode.target,
          actorId,
          remarks: input.remarks ?? null,
          overrideReason: input.overrideReason ?? null,
        });
        assigned.push(app.id);
      } catch (e: any) {
        // A bulk action reports per application. Throwing here would lose the
        // outcome for everything already written in this batch.
        skipped.push({ applicationId: app.id, reason: e?.message || 'Assignment failed' });
      }
    }

    // Ids that matched nothing at all, as opposed to being deliberately skipped.
    const found = new Set(applications.map((a) => a.id));
    ids.filter((id) => !found.has(id)).forEach((id) =>
      skipped.push({ applicationId: id, reason: 'Application not found' }),
    );

    return {
      scheme,
      assignedCount: assigned.length,
      skippedCount: skipped.length,
      assignedApplicationIds: assigned,
      skipped,
    };
  }

  // ── Section 7: change / reassign ──────────────────────────────────────────

  static async changeScheme(
    input: {
      applicationIds: string[];
      schemeId: string;
      reason: string;
      remarks?: string | null;
      /** Keeps a confirmed scheme confirmed; otherwise the change is provisional. */
      asFinal?: boolean;
    },
    actorId: string,
  ) {
    if (!input.reason?.trim()) {
      throw new BadRequestError('A reason is required to change an assigned scheme');
    }

    const ids = Array.from(new Set((input.applicationIds ?? []).filter(Boolean)));
    if (ids.length === 0) throw new BadRequestError('No applications selected');

    const scheme = await prisma.scheme.findUnique({
      where: { id: input.schemeId },
      select: { id: true, name: true, code: true },
    });
    if (!scheme) throw new NotFoundError('Scheme not found');

    const applications = await prisma.startupApplication.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        pceState: {
          select: { schemeStatus: true, provisionalSchemeId: true, finalSchemeId: true },
        },
      },
    });

    const changed: string[] = [];
    const skipped: Array<{ applicationId: string; reason: string }> = [];

    for (const app of applications) {
      const state = app.pceState;
      const currentId = state?.finalSchemeId ?? state?.provisionalSchemeId ?? null;

      if (!currentId || !DECIDED.has(state?.schemeStatus ?? '')) {
        skipped.push({
          applicationId: app.id,
          reason: 'No scheme assigned yet — use Assign Scheme',
        });
        continue;
      }
      if (currentId === input.schemeId) {
        skipped.push({ applicationId: app.id, reason: 'Already on this scheme' });
        continue;
      }

      const target = input.asFinal ? 'final' : 'provisional';
      try {
        await this.writeAssignment({
          applicationId: app.id,
          schemeId: input.schemeId,
          previousSchemeId: currentId,
          previousFinalSchemeId: state?.finalSchemeId ?? null,
          // CHANGED is its own status so the listing shows that this
          // application was moved rather than assigned first time.
          status: 'CHANGED',
          kind: input.asFinal ? 'FINAL' : 'PROVISIONAL',
          action: 'CHANGED',
          target,
          actorId,
          reason: input.reason.trim(),
          remarks: input.remarks ?? null,
        });
        changed.push(app.id);
      } catch (e: any) {
        skipped.push({ applicationId: app.id, reason: e?.message || 'Change failed' });
      }
    }

    const found = new Set(applications.map((a) => a.id));
    ids.filter((id) => !found.has(id)).forEach((id) =>
      skipped.push({ applicationId: id, reason: 'Application not found' }),
    );

    return {
      scheme,
      changedCount: changed.length,
      skippedCount: skipped.length,
      changedApplicationIds: changed,
      skipped,
    };
  }

  // ── Section 8: history ────────────────────────────────────────────────────

  static async history(params: { applicationId?: string; schemeId?: string; limit?: number }) {
    const limit = Math.min(500, Math.max(1, Number(params.limit) || 200));

    const where: Prisma.SchemeAssignmentHistoryWhereInput = {
      application: LIVE,
      ...(params.applicationId ? { applicationId: params.applicationId } : {}),
      ...(params.schemeId ? { schemeId: params.schemeId } : {}),
    };

    const rows = await prisma.schemeAssignmentHistory.findMany({
      where,
      orderBy: { performedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        applicationId: true,
        kind: true,
        action: true,
        reason: true,
        remarks: true,
        performedBy: true,
        performedAt: true,
        scheme: { select: schemeSelect },
        previousScheme: { select: schemeSelect },
        application: {
          select: { id: true, applicationNo: true, startupName: true, fullName: true },
        },
      },
    });

    const actors = await resolveActors(rows.map((r) => r.performedBy));

    return {
      items: rows.map((r) => ({
        ...r,
        performedByName: r.performedBy ? actors.get(r.performedBy) ?? 'Unknown user' : 'System',
      })),
      total: rows.length,
      /** True when the cap was hit, so the UI can say the list is truncated. */
      truncated: rows.length === limit,
    };
  }

  // ── Section 9: eligibility ────────────────────────────────────────────────

  /**
   * Whether an application meets a scheme's requirements.
   *
   * Only what can actually be checked against structured data is checked. A
   * scheme's eligibility prose cannot be evaluated by code, and claiming
   * "Eligible" while ignoring it would be worse than useless - so its presence
   * downgrades the verdict to "Review Required" and the text is returned for
   * the admin to read.
   *
   * Hard failures (the scheme is not open, or its validity has passed) give
   * Not Eligible. A sector mismatch gives Partially Eligible: it is a
   * judgement call, not a disqualification, and the spec expects an authorised
   * user to be able to proceed anyway.
   */
  static async checkEligibility(applicationId: string, schemeId: string) {
    const [application, scheme] = await Promise.all([
      prisma.startupApplication.findUnique({
        where: { id: applicationId },
        select: {
          id: true,
          applicationNo: true,
          startupName: true,
          mainSector: true,
          subSectors: true,
          stage: true,
          isRegistered: true,
          dpiitRegistered: true,
          state: true,
        },
      }),
      prisma.scheme.findUnique({
        where: { id: schemeId },
        select: {
          id: true,
          name: true,
          code: true,
          status: true,
          sectors: true,
          eligibility: true,
          validityPeriods: true,
          maxGrant: true,
        },
      }),
    ]);

    if (!application) throw new NotFoundError('Application not found');
    if (!scheme) throw new NotFoundError('Scheme not found');

    type Check = {
      label: string;
      result: 'PASS' | 'HARD_FAIL' | 'SOFT_FAIL' | 'UNVERIFIABLE';
      detail: string;
    };
    const checks: Check[] = [];

    // 1. Is the scheme open at all.
    if (scheme.status === 'ACTIVE') {
      checks.push({ label: 'Scheme is open', result: 'PASS', detail: 'Scheme status is Active.' });
    } else if (scheme.status === 'DRAFT') {
      checks.push({
        label: 'Scheme is open',
        result: 'UNVERIFIABLE',
        detail: 'Scheme is still a draft, so its terms may change.',
      });
    } else {
      checks.push({
        label: 'Scheme is open',
        result: 'HARD_FAIL',
        detail: `Scheme status is ${String(scheme.status).toLowerCase()}.`,
      });
    }

    // 2. Validity window, when the scheme records one.
    const periods = Array.isArray(scheme.validityPeriods)
      ? (scheme.validityPeriods as Array<{ start?: string; end?: string }>)
      : [];
    const usable = periods.filter((p) => p?.start || p?.end);
    if (usable.length === 0) {
      checks.push({
        label: 'Within validity period',
        result: 'PASS',
        detail: 'Scheme records no validity period, so none applies.',
      });
    } else {
      const now = Date.now();
      const covers = usable.some((p) => {
        const start = p.start ? new Date(p.start).getTime() : -Infinity;
        const end = p.end ? new Date(p.end).getTime() : Infinity;
        // An unparseable date is not evidence of anything, so it does not fail.
        if (Number.isNaN(start) || Number.isNaN(end)) return true;
        return now >= start && now <= end;
      });
      checks.push(
        covers
          ? { label: 'Within validity period', result: 'PASS', detail: 'Today falls inside the scheme validity period.' }
          : {
              label: 'Within validity period',
              result: 'HARD_FAIL',
              detail: 'Today falls outside every validity period recorded for this scheme.',
            },
      );
    }

    // 3. Sector.
    const schemeSectors = (scheme.sectors ?? []).map(lower).filter(Boolean);
    if (schemeSectors.length === 0) {
      checks.push({
        label: 'Sector match',
        result: 'PASS',
        detail: 'Scheme is not restricted to particular sectors.',
      });
    } else {
      const appSectors = [application.mainSector, ...(application.subSectors ?? [])]
        .map(lower)
        .filter(Boolean);
      const hit = appSectors.find((s) => schemeSectors.includes(s));
      checks.push(
        hit
          ? { label: 'Sector match', result: 'PASS', detail: `Matches on "${hit}".` }
          : {
              label: 'Sector match',
              result: 'SOFT_FAIL',
              detail: `Startup sector ${appSectors.map((s) => `"${s}"`).join(', ') || '(none recorded)'} is not among the scheme's sectors.`,
            },
      );
    }

    // 4. Anything written as prose, which code cannot judge.
    if (scheme.eligibility?.trim()) {
      checks.push({
        label: 'Scheme eligibility criteria',
        result: 'UNVERIFIABLE',
        detail: 'This scheme states its criteria in words, which need a person to read.',
      });
    }

    const verdict = checks.some((c) => c.result === 'HARD_FAIL')
      ? 'NOT_ELIGIBLE'
      : checks.some((c) => c.result === 'SOFT_FAIL')
        ? 'PARTIALLY_ELIGIBLE'
        : checks.some((c) => c.result === 'UNVERIFIABLE')
          ? 'REVIEW_REQUIRED'
          : 'ELIGIBLE';

    // Recorded so the listing can show it without re-running the check, but
    // never used to block an assignment - only the admin decides that.
    await PceService.ensureState(applicationId);
    await prisma.applicationPceState.update({
      where: { applicationId },
      data: { eligibilityVerdict: verdict as any, eligibilityCheckedAt: new Date() },
    });

    return {
      verdict,
      /** Only a hard failure needs the admin to record an override reason. */
      requiresOverride: verdict === 'NOT_ELIGIBLE',
      checks,
      eligibilityText: scheme.eligibility ?? null,
      application: {
        id: application.id,
        applicationNo: application.applicationNo,
        startupName: application.startupName,
        mainSector: application.mainSector,
      },
      scheme: { id: scheme.id, name: scheme.name, code: scheme.code },
    };
  }

  // ── Section 10: scheme-wise view ──────────────────────────────────────────

  /**
   * Per-scheme totals across the whole journey.
   *
   * Grouped in memory rather than in SQL because "the scheme this application
   * is on" is final ?? provisional ?? applied-under, and a COALESCE across
   * three columns in a groupBy is far harder to read - and to correct later -
   * than the same fold written out.
   */
  static async schemeOverview() {
    const [schemes, states, unassigned] = await Promise.all([
      prisma.scheme.findMany({
        where: LIVE,
        orderBy: { name: 'asc' },
        select: { id: true, name: true, code: true, status: true, maxGrant: true },
      }),
      prisma.applicationPceState.findMany({
        where: { application: LIVE },
        select: {
          schemeStatus: true,
          pitchStatus: true,
          evaluationStatus: true,
          onboardingStatus: true,
          provisionalSchemeId: true,
          finalSchemeId: true,
          application: {
            select: {
              schemeId: true,
              status: true,
              finalSelection: { select: { decision: true, grantApproved: true } },
            },
          },
        },
      }),
      // Selected for pitch but never touched by this module, so no state row.
      prisma.startupApplication.groupBy({
        by: ['schemeId'],
        where: { ...LIVE, status: 'SELECTED_FOR_PITCH', pceState: { is: null } },
        _count: { _all: true },
      }),
    ]);

    const blank = () => ({
      totalApplications: 0,
      selectedForPitch: 0,
      pitchScheduled: 0,
      pitchCompleted: 0,
      evaluationPending: 0,
      evaluationCompleted: 0,
      selected: 0,
      grantApproved: 0,
      onboardingPending: 0,
      onboardingCompleted: 0,
    });

    const byScheme = new Map<string, ReturnType<typeof blank>>();
    const bucket = (id: string) => {
      if (!byScheme.has(id)) byScheme.set(id, blank());
      return byScheme.get(id)!;
    };

    for (const s of states) {
      // Only count against a scheme this module actually assigned; an
      // application still on its applied-under scheme is counted as unassigned
      // below, so it is not attributed to a scheme nobody chose for it.
      const id = s.finalSchemeId ?? s.provisionalSchemeId;
      if (!id) continue;

      const b = bucket(id);
      b.totalApplications++;
      if (s.application?.status === 'SELECTED_FOR_PITCH') b.selectedForPitch++;
      if (s.pitchStatus === 'SCHEDULED' || s.pitchStatus === 'RESCHEDULED') b.pitchScheduled++;
      if (s.pitchStatus === 'COMPLETED') b.pitchCompleted++;
      if (s.evaluationStatus === 'PENDING') b.evaluationPending++;
      if (s.evaluationStatus === 'COMPLETED') b.evaluationCompleted++;

      const decision = s.application?.finalSelection?.decision;
      if (decision && APPROVED_DECISIONS_SET.has(decision)) b.selected++;
      if (s.application?.finalSelection?.grantApproved) b.grantApproved++;

      if (ONBOARDING_PENDING_SET.has(s.onboardingStatus)) b.onboardingPending++;
      if (s.onboardingStatus === 'COMPLETED') b.onboardingCompleted++;
    }

    const untrackedByScheme = new Map(
      unassigned.map((u: any) => [u.schemeId as string, u._count?._all ?? 0]),
    );

    return {
      items: schemes.map((s) => ({
        scheme: s,
        counts: byScheme.get(s.id) ?? blank(),
        /**
         * Applied under this scheme and selected for pitch, but with no scheme
         * assigned yet. Shown separately so the two are never added together.
         */
        awaitingAssignment: untrackedByScheme.get(s.id) ?? 0,
      })),
    };
  }
}

export default SchemeAssignmentService;
