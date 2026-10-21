import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { LIVE, PCE_COHORT, APPROVED_DECISIONS } from './pce.constants';
import {
  STAGES,
  FUNNEL_STAGES,
  STAGE_LABELS,
  STAGE_HELP,
  STAGE_ORDER,
  EVALUATION_SLA_DAYS,
  EXPERT_TYPE_SET,
  type Stage,
} from './dashboard.constants';

/**
 * The Pitching & Evaluation management dashboard.
 *
 * Shape of this file: one lean projection of the applications in the pitching
 * cohort is read once, each row is assigned exactly one lifecycle stage, and
 * every section is a tally over that array. See dashboard.constants.ts for why
 * it is built that way rather than as one count() per card.
 *
 * Two things that are easy to get wrong here:
 *
 * 1. ApplicationPceState rows are created lazily, so an application that this
 *    module has never touched has no row at all. Every read below treats a
 *    missing row as the defaults rather than skipping the application, or a
 *    freshly selected application would be invisible on the page whose job is
 *    to tell you it needs planning.
 *
 * 2. The soft-delete extension filters findMany and count but not groupBy or
 *    aggregate. Anything grouped here is scoped by `application: { deletedAt:
 *    null }` explicitly.
 */

// ── Filters ─────────────────────────────────────────────────────────────────

export interface DashboardFilters {
  /** Date range over application selection, which is what "Date Range" means here. */
  from?: string;
  to?: string;
  schemeId?: string;
  cohortId?: string;
  sector?: string;
  /** StartupApplication.status. */
  status?: string;
  /** ApplicationPceState.pitchStatus. */
  pitchStatus?: string;
  /** ApplicationPceState.evaluationStatus. */
  evaluationStatus?: string;
  onboardingStatus?: string;
  schemeStatus?: string;
  finalDecision?: string;
  committeeId?: string;
  panelId?: string;
  evaluatorId?: string;
  /** An evaluator seated as one of the expert types. */
  expertId?: string;
  sessionId?: string;
  /** One of STAGES — the drill-down from a KPI card. */
  stage?: string;
}

const dayRange = (from?: string, to?: string) => {
  const gte = from ? new Date(from) : null;
  const lte = to ? new Date(to) : null;
  if (gte && !Number.isNaN(gte.getTime())) gte.setHours(0, 0, 0, 0);
  if (lte && !Number.isNaN(lte.getTime())) lte.setHours(23, 59, 59, 999);
  const ok = (d: Date | null) => !!d && !Number.isNaN(d.getTime());
  if (!ok(gte) && !ok(lte)) return undefined;
  return { ...(ok(gte) ? { gte: gte as Date } : {}), ...(ok(lte) ? { lte: lte as Date } : {}) };
};

const pct = (part: number, whole: number) =>
  whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;

/** Mean of a list of day-counts, to one decimal, or null when there is nothing to average. */
const avg = (values: number[]) =>
  values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null;

const days = (from: Date, to: Date) => (to.getTime() - from.getTime()) / 86_400_000;

// ── The projection ──────────────────────────────────────────────────────────

/**
 * Only the columns the stage derivation and the tallies actually need.
 *
 * Deliberately narrow: this reads every application in the cohort, so the cost
 * is the row width times the cohort size. Nothing here is a text column.
 */
const projection = {
  id: true,
  applicationNo: true,
  startupName: true,
  mainSector: true,
  status: true,
  createdAt: true,
  schemeId: true,
  cohortId: true,
  pceState: {
    select: {
      schemeStatus: true,
      pitchStatus: true,
      evaluationStatus: true,
      onboardingStatus: true,
      provisionalSchemeId: true,
      finalSchemeId: true,
    },
  },
  finalSelection: { select: { decision: true, decidedAt: true, createdAt: true } },
  pitchSchedules: {
    where: { deletedAt: null, isActive: true },
    select: {
      id: true,
      presentationDate: true,
      startTime: true,
      endTime: true,
      status: true,
      completedAt: true,
      startupNotifiedAt: true,
      panelId: true,
      sessionId: true,
      mode: true,
      venue: true,
      meetingLink: true,
      createdAt: true,
    },
    orderBy: { presentationDate: 'desc' as const },
  },
  panelAllocations: { select: { panelId: true } },
  pitchEvaluations: { select: { state: true, submittedAt: true, evaluatorId: true } },
} satisfies Prisma.StartupApplicationSelect;

type Row = Prisma.StartupApplicationGetPayload<{ select: typeof projection }>;

/** A row with its derived stage and the few facts the sections reuse. */
interface Derived {
  row: Row;
  stage: Stage;
  /** The schedule the stage was decided from: the most recent live one. */
  schedule: Row['pitchSchedules'][number] | null;
  submittedCount: number;
  isOverdue: boolean;
  /**
   * The slot has passed but nobody marked the pitch complete, so the
   * application is stuck one stage behind where it really is.
   */
  isStalePitch: boolean;
  /** Scheme the application is counted under: final, else provisional, else applied-under. */
  schemeId: string | null;
}

export class DashboardService {
  // ── Where clause ──────────────────────────────────────────────────────────

  /**
   * Every filter as one application-level predicate.
   *
   * Built once and used for the projection, so no section can be filtered
   * differently from its neighbours. `stage` is deliberately not here: it is a
   * derived value, so it is applied after derivation.
   */
  static buildWhere(f: DashboardFilters = {}): Prisma.StartupApplicationWhereInput {
    const and: Prisma.StartupApplicationWhereInput[] = [PCE_COHORT];

    if (f.sector?.trim()) {
      and.push({ mainSector: { equals: f.sector.trim(), mode: 'insensitive' } });
    }
    if (f.status?.trim()) and.push({ status: f.status.trim() as any });
    if (f.cohortId?.trim()) and.push({ cohortId: f.cohortId.trim() });

    if (f.schemeId?.trim()) {
      const id = f.schemeId.trim();
      // A scheme can be the applied-under one, the provisional one or the final
      // one, and the dashboard should find the application under any of them.
      and.push({
        OR: [
          { pceState: { finalSchemeId: id } },
          { pceState: { provisionalSchemeId: id } },
          { schemeId: id },
        ],
      });
    }
    if (f.schemeStatus?.trim()) {
      and.push(
        f.schemeStatus.trim() === 'NOT_ASSIGNED'
          ? { OR: [{ pceState: { is: null } }, { pceState: { schemeStatus: 'NOT_ASSIGNED' } }] }
          : { pceState: { schemeStatus: f.schemeStatus.trim() as any } },
      );
    }
    if (f.pitchStatus?.trim()) {
      and.push({ pceState: { pitchStatus: f.pitchStatus.trim() as any } });
    }
    if (f.evaluationStatus?.trim()) {
      and.push({ pceState: { evaluationStatus: f.evaluationStatus.trim() as any } });
    }
    if (f.onboardingStatus?.trim()) {
      and.push({ pceState: { onboardingStatus: f.onboardingStatus.trim() as any } });
    }
    if (f.finalDecision?.trim()) {
      const d = f.finalDecision.trim();
      if (d === 'PENDING') {
        and.push({
          OR: [{ finalSelection: { is: null } }, { finalSelection: { decision: null } }],
        });
      } else if (d === 'APPROVED_ANY') {
        and.push({ finalSelection: { decision: { in: APPROVED_DECISIONS as any } } });
      } else {
        and.push({ finalSelection: { decision: d as any } });
      }
    }
    if (f.panelId?.trim()) {
      and.push({ panelAllocations: { some: { panelId: f.panelId.trim() } } });
    }
    if (f.sessionId?.trim()) {
      and.push({
        pitchSchedules: { some: { deletedAt: null, isActive: true, sessionId: f.sessionId.trim() } },
      });
    }
    if (f.committeeId?.trim()) {
      // A committee reaches an application through the panels built from the
      // same mandate, which is the only link the schema draws between them.
      and.push({
        panelAllocations: {
          some: {
            panel: {
              deletedAt: null,
              mandate: { committees: { some: { id: f.committeeId.trim() } } },
            },
          },
        },
      });
    }
    if (f.evaluatorId?.trim() || f.expertId?.trim()) {
      const id = (f.evaluatorId || f.expertId)!.trim();
      // Seated on the panel, or already the author of an evaluation.
      and.push({
        OR: [
          { panelAllocations: { some: { panel: { members: { some: { evaluatorId: id } } } } } },
          { pitchEvaluations: { some: { evaluatorId: id } } },
        ],
      });
    }

    const range = dayRange(f.from, f.to);
    if (range) and.push({ createdAt: range });

    return { AND: and };
  }

  // ── Stage derivation ──────────────────────────────────────────────────────

  /**
   * The one current stage of one application.
   *
   * Read bottom-up: the furthest milestone reached wins, so an application that
   * has completed its evaluation is never also counted as awaiting one.
   */
  static deriveStage(row: Row, now: Date): { stage: Stage; schedule: Derived['schedule'] } {
    const state = row.pceState;
    const schedules = row.pitchSchedules ?? [];
    // The live one decides the stage; a cancelled row should not mask it.
    const live = schedules.find((s) => s.status !== 'CANCELLED') ?? schedules[0] ?? null;

    const decision = row.finalSelection?.decision ?? null;
    if (decision) return { stage: 'FINAL_DECISION', schedule: live };

    // A final-selection record with no decision means the committee has opened
    // the question but not answered it.
    if (row.finalSelection) return { stage: 'RECOMMENDATION_PENDING', schedule: live };

    const evaluation = state?.evaluationStatus ?? 'PENDING';
    if (evaluation === 'COMPLETED') return { stage: 'EVALUATION_COMPLETED', schedule: live };
    if (evaluation === 'IN_PROGRESS') return { stage: 'EVALUATION_IN_PROGRESS', schedule: live };

    const pitchDone =
      state?.pitchStatus === 'COMPLETED' || schedules.some((s) => !!s.completedAt);
    if (pitchDone) {
      // Nothing to evaluate with until a panel holds the application.
      const allocated = (row.panelAllocations ?? []).length > 0;
      return { stage: allocated ? 'EVALUATION_PENDING' : 'PITCHING_COMPLETED', schedule: live };
    }

    if (state?.pitchStatus === 'CANCELLED' || (live && live.status === 'CANCELLED')) {
      return { stage: 'CANCELLED', schedule: live };
    }

    if (live) {
      const start = live.startTime ?? live.presentationDate;
      const end = live.endTime ?? null;
      const started = !!start && new Date(start).getTime() <= now.getTime();
      // With no end time, the pitch is "in progress" for the rest of its day.
      const endsAt = end
        ? new Date(end)
        : start
          ? new Date(new Date(start).setHours(23, 59, 59, 999))
          : null;
      const finished = !!endsAt && endsAt.getTime() < now.getTime();

      if (started && !finished) return { stage: 'PITCHING_IN_PROGRESS', schedule: live };
      // Planned internally versus committed to the startup. The notification is
      // the line: before it the slot can still move silently.
      return { stage: live.startupNotifiedAt ? 'SCHEDULED' : 'PLANNED', schedule: live };
    }

    return { stage: 'PENDING_PLANNING', schedule: null };
  }

  private static derive(rows: Row[], now: Date): Derived[] {
    const slaMs = EVALUATION_SLA_DAYS * 86_400_000;

    return rows.map((row) => {
      const { stage, schedule } = this.deriveStage(row, now);
      const submittedCount = (row.pitchEvaluations ?? []).filter(
        (e) => e.state === 'SUBMITTED' || e.state === 'LOCKED',
      ).length;

      // Overdue is measured from the completed pitch, which is the only moment
      // in the schema that starts the evaluation clock.
      const completedAt =
        (row.pitchSchedules ?? []).map((s) => s.completedAt).filter(Boolean)[0] ?? null;
      const isOverdue =
        !!completedAt &&
        row.pceState?.evaluationStatus !== 'COMPLETED' &&
        now.getTime() - new Date(completedAt).getTime() > slaMs;

      const schemeId =
        row.pceState?.finalSchemeId ?? row.pceState?.provisionalSchemeId ?? row.schemeId ?? null;

      // Still sitting in a pre-pitch stage although its window has closed.
      const windowEnd = schedule
        ? new Date(
            schedule.endTime ??
              new Date(new Date(schedule.presentationDate).setHours(23, 59, 59, 999)),
          )
        : null;
      const isStalePitch =
        (stage === 'SCHEDULED' || stage === 'PLANNED') &&
        !!windowEnd &&
        windowEnd.getTime() < now.getTime();

      return { row, stage, schedule, submittedCount, isOverdue, isStalePitch, schemeId };
    });
  }

  // ── The payload ───────────────────────────────────────────────────────────

  static async getDashboard(filters: DashboardFilters = {}) {
    const now = new Date();
    const where = this.buildWhere(filters);

    const [rows, committees, panels, evaluators, sessions, schemes] = await Promise.all([
      prisma.startupApplication.findMany({ where, select: projection }),
      prisma.committee.findMany({
        where: LIVE,
        select: {
          id: true,
          name: true,
          status: true,
          schemeId: true,
          createdAt: true,
          _count: { select: { members: true } },
        },
      }),
      prisma.evaluationPanel.findMany({
        where: LIVE,
        select: {
          id: true,
          name: true,
          status: true,
          schemeId: true,
          sessionId: true,
          sectors: true,
          confirmedAt: true,
          createdAt: true,
          _count: { select: { members: true, allocations: true } },
        },
      }),
      prisma.evaluator.findMany({
        where: LIVE,
        select: { id: true, type: true, status: true, userId: true, expertCategories: true },
      }),
      prisma.pitchingSession.findMany({
        where: LIVE,
        select: {
          id: true,
          name: true,
          presentationDate: true,
          startTime: true,
          endTime: true,
          status: true,
          mode: true,
          venue: true,
          meetingLink: true,
          schemeId: true,
          scheme: { select: { id: true, name: true } },
          _count: { select: { schedules: true, panels: true } },
        },
        orderBy: { presentationDate: 'asc' },
      }),
      prisma.scheme.findMany({ where: LIVE, select: { id: true, name: true, code: true } }),
    ]);

    const all = this.derive(rows, now);
    // The stage filter is applied after derivation, because it is derived.
    const wanted = filters.stage?.trim();
    const derived =
      wanted && (STAGES as readonly string[]).includes(wanted)
        ? all.filter((d) => d.stage === wanted)
        : all;

    const schemeNames = new Map(schemes.map((s) => [s.id, s.name]));

    return {
      generatedAt: now.toISOString(),
      evaluationSlaDays: EVALUATION_SLA_DAYS,
      total: derived.length,
      stageDefinitions: FUNNEL_STAGES.map((s) => ({
        stage: s,
        label: STAGE_LABELS[s],
        help: STAGE_HELP[s],
      })),
      pipeline: this.pipeline(derived),
      funnel: this.funnel(derived),
      planning: this.planning(derived),
      sessions: this.sessionSection(sessions, now),
      pitching: this.pitchingSection(derived),
      evaluation: this.evaluationSection(derived, evaluators),
      committeesPanels: this.committeePanelSection(derived, committees, panels),
      evaluatorsExperts: this.evaluatorSection(derived, evaluators),
      sectorWise: this.bySector(derived),
      schemeWise: this.byScheme(derived, schemeNames),
      pendingActions: this.pendingActions(derived, evaluators, sessions, panels),
      onboarding: await this.onboardingSection(derived, evaluators),
      performance: this.performance(derived),
      upcomingActivities: this.upcoming(sessions, derived, now),
      recentActivities: await this.recent(derived, committees, panels),
    };
  }

  // ── Section 3: pipeline KPIs ──────────────────────────────────────────────

  /**
   * The exclusive stage counts, plus the cohort total.
   *
   * `selected` is the whole pipeline rather than a stage, which is why it is
   * returned apart from the list: the stage counts sum to it exactly.
   */
  private static pipeline(derived: Derived[]) {
    const counts = new Map<Stage, number>(STAGES.map((s) => [s, 0]));
    derived.forEach((d) => counts.set(d.stage, (counts.get(d.stage) ?? 0) + 1));

    return {
      selected: {
        key: 'selected',
        label: 'Applications Selected for Pitching',
        count: derived.length,
        filter: {},
      },
      stages: STAGES.map((s) => ({
        key: s.toLowerCase(),
        stage: s,
        label: STAGE_LABELS[s],
        help: STAGE_HELP[s],
        count: counts.get(s) ?? 0,
        filter: { stage: s },
      })),
      /** Proof of the invariant, for the screen to assert against if it wants. */
      stagesSumToSelected:
        STAGES.reduce((n, s) => n + (counts.get(s) ?? 0), 0) === derived.length,
    };
  }

  // ── Section 12: funnel ────────────────────────────────────────────────────

  /**
   * Both readings of the funnel, because they answer different questions.
   *
   * `current` is how many sit at this stage now and sums to the total.
   * `reached` is how many have ever got at least this far, which is the shape
   * people expect a funnel to have — monotonically decreasing.
   */
  private static funnel(derived: Derived[]) {
    const live = derived.filter((d) => d.stage !== 'CANCELLED');

    return FUNNEL_STAGES.map((stage) => {
      const current = live.filter((d) => d.stage === stage).length;
      const reached = live.filter((d) => STAGE_ORDER[d.stage] >= STAGE_ORDER[stage]).length;
      return {
        stage,
        label: STAGE_LABELS[stage],
        current,
        reached,
        reachedPct: pct(reached, live.length),
        filter: { stage },
      };
    });
  }

  // ── Section 4: planning ───────────────────────────────────────────────────

  private static planning(derived: Derived[]) {
    const at = (s: Stage) => derived.filter((d) => d.stage === s).length;

    const needsReschedule = derived.filter(
      (d) => d.row.pceState?.pitchStatus === 'RESCHEDULED' || d.stage === 'CANCELLED',
    ).length;

    const noPanel = derived.filter((d) => (d.row.panelAllocations ?? []).length === 0).length;

    // A panel with no seated member cannot evaluate, which is a different gap
    // from having no panel at all and needs a different fix.
    const noEvaluator = derived.filter((d) => {
      const alloc = d.row.panelAllocations ?? [];
      if (alloc.length === 0) return true;
      return (d.row.pitchEvaluations ?? []).length === 0 && d.submittedCount === 0;
    }).length;

    /**
     * A slot that cannot actually be held: no panel to hear it, or no place to
     * hold it. Online and offline fail differently, so both are checked.
     */
    const incomplete = derived.filter((d) => {
      const s = d.schedule;
      if (!s) return false;
      if (!s.panelId) return true;
      if (s.mode === 'ONLINE') return !s.meetingLink;
      if (s.mode === 'OFFLINE') return !s.venue;
      return !s.venue && !s.meetingLink;
    }).length;

    return {
      kpis: [
        { key: 'selected', label: 'Selected for pitching', count: derived.length, filter: {} },
        {
          key: 'pending_planning',
          label: 'Pending for planning',
          count: at('PENDING_PLANNING'),
          filter: { stage: 'PENDING_PLANNING' },
        },
        {
          key: 'planned',
          label: 'Planned for pitching',
          count: at('PLANNED') + at('SCHEDULED'),
          filter: { stage: 'PLANNED' },
        },
        {
          key: 'reschedule',
          label: 'Requiring rescheduling',
          count: needsReschedule,
          filter: { pitchStatus: 'RESCHEDULED' },
        },
        {
          key: 'no_panel',
          label: 'Without committee/panel allocation',
          count: noPanel,
          filter: { stage: 'PITCHING_COMPLETED' },
        },
        {
          key: 'no_evaluator',
          label: 'Without evaluator allocation',
          count: noEvaluator,
          filter: {},
        },
        {
          key: 'incomplete',
          label: 'Incomplete pitching arrangements',
          count: incomplete,
          filter: {},
        },
      ],
      statusTable: [
        {
          status: 'Pending Planning',
          count: at('PENDING_PLANNING'),
          filter: { stage: 'PENDING_PLANNING' },
        },
        { status: 'Planning Completed', count: at('PLANNED'), filter: { stage: 'PLANNED' } },
        { status: 'Scheduled', count: at('SCHEDULED'), filter: { stage: 'SCHEDULED' } },
        {
          status: 'Reschedule Required',
          count: needsReschedule,
          filter: { pitchStatus: 'RESCHEDULED' },
        },
      ],
    };
  }

  // ── Section 5: sessions ───────────────────────────────────────────────────

  private static sessionSection(sessions: any[], now: Date) {
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const on = (s: any) => new Date(s.presentationDate).getTime();
    const isToday = (s: any) => on(s) >= startOfDay.getTime() && on(s) <= endOfDay.getTime();

    const today = sessions.filter(isToday);
    const upcoming = sessions.filter((s) => on(s) > endOfDay.getTime() && s.status !== 'CANCELLED');
    const completed = sessions.filter((s) => s.status === 'COMPLETED');
    const cancelled = sessions.filter((s) => s.status === 'CANCELLED');

    const present = (s: any) => ({
      id: s.id,
      name: s.name,
      presentationDate: s.presentationDate,
      startTime: s.startTime,
      endTime: s.endTime,
      status: s.status,
      mode: s.mode,
      venue: s.venue,
      meetingLink: s.meetingLink,
      scheme: s.scheme,
      applicationCount: s._count?.schedules ?? 0,
      panelCount: s._count?.panels ?? 0,
    });

    return {
      kpis: [
        { key: 'today', label: "Today's sessions", count: today.length },
        { key: 'upcoming', label: 'Upcoming sessions', count: upcoming.length },
        { key: 'completed', label: 'Completed sessions', count: completed.length },
        { key: 'cancelled', label: 'Cancelled sessions', count: cancelled.length },
      ],
      today: today.map(present),
      upcoming: upcoming.slice(0, 20).map(present),
    };
  }

  // ── Section 6: pitching status ────────────────────────────────────────────

  private static pitchingSection(derived: Derived[]) {
    const at = (s: Stage) => derived.filter((d) => d.stage === s).length;
    const scheduledTotal = at('PLANNED') + at('SCHEDULED') + at('PITCHING_IN_PROGRESS');
    const rescheduled = derived.filter(
      (d) => d.row.pceState?.pitchStatus === 'RESCHEDULED',
    ).length;

    return {
      kpis: [
        { key: 'scheduled_total', label: 'Total applications scheduled', count: scheduledTotal },
        {
          key: 'not_started',
          label: 'Pitching not started',
          count: at('PLANNED') + at('SCHEDULED'),
          filter: { stage: 'SCHEDULED' },
        },
        {
          key: 'in_progress',
          label: 'Pitching in progress',
          count: at('PITCHING_IN_PROGRESS'),
          filter: { stage: 'PITCHING_IN_PROGRESS' },
        },
        {
          key: 'completed',
          label: 'Pitching completed',
          // Everything at or past the completed-pitch milestone.
          count: derived.filter(
            (d) =>
              d.stage !== 'CANCELLED' && STAGE_ORDER[d.stage] >= STAGE_ORDER.PITCHING_COMPLETED,
          ).length,
          filter: { stage: 'PITCHING_COMPLETED' },
        },
        {
          key: 'cancelled',
          label: 'Pitching cancelled',
          count: at('CANCELLED'),
          filter: { stage: 'CANCELLED' },
        },
        {
          key: 'rescheduled',
          label: 'Pitching rescheduled',
          count: rescheduled,
          filter: { pitchStatus: 'RESCHEDULED' },
        },
      ],
    };
  }

  // ── Section 7: evaluation ─────────────────────────────────────────────────

  private static evaluationSection(derived: Derived[], evaluators: any[]) {
    const at = (s: Stage) => derived.filter((d) => d.stage === s).length;
    const allocated = derived.filter((d) => (d.row.panelAllocations ?? []).length > 0).length;
    const overdue = derived.filter((d) => d.isOverdue).length;

    // Per-evaluator progress, counted over panel seats rather than evaluations,
    // so somebody who has submitted nothing still appears with work assigned.
    const assignedBy = new Map<string, number>();
    const doneBy = new Map<string, number>();
    derived.forEach((d) => {
      (d.row.pitchEvaluations ?? []).forEach((e) => {
        assignedBy.set(e.evaluatorId, (assignedBy.get(e.evaluatorId) ?? 0) + 1);
        if (e.state === 'SUBMITTED' || e.state === 'LOCKED') {
          doneBy.set(e.evaluatorId, (doneBy.get(e.evaluatorId) ?? 0) + 1);
        }
      });
    });

    const assignedTotal = [...assignedBy.values()].reduce((a, b) => a + b, 0);
    const doneTotal = [...doneBy.values()].reduce((a, b) => a + b, 0);
    const activeEvaluators = evaluators.filter((e) => e.status === 'ACTIVE').length;

    return {
      kpis: [
        {
          key: 'awaiting',
          label: 'Awaiting evaluation',
          count: at('PITCHING_COMPLETED') + at('EVALUATION_PENDING'),
          filter: { stage: 'EVALUATION_PENDING' },
        },
        { key: 'allocated', label: 'Assigned to evaluators', count: allocated },
        {
          key: 'in_progress',
          label: 'Evaluations in progress',
          count: at('EVALUATION_IN_PROGRESS'),
          filter: { stage: 'EVALUATION_IN_PROGRESS' },
        },
        {
          key: 'partial',
          label: 'Partially completed',
          count: derived.filter(
            (d) => d.submittedCount > 0 && d.row.pceState?.evaluationStatus !== 'COMPLETED',
          ).length,
          filter: { stage: 'EVALUATION_IN_PROGRESS' },
        },
        {
          key: 'completed',
          label: 'Evaluations completed',
          count: derived.filter(
            (d) => d.stage !== 'CANCELLED' && STAGE_ORDER[d.stage] >= STAGE_ORDER.EVALUATION_COMPLETED,
          ).length,
          filter: { stage: 'EVALUATION_COMPLETED' },
        },
        { key: 'overdue', label: `Overdue (> ${EVALUATION_SLA_DAYS}d)`, count: overdue },
        {
          key: 'awaiting_recommendation',
          label: 'Awaiting final recommendation',
          count: at('EVALUATION_COMPLETED') + at('RECOMMENDATION_PENDING'),
          filter: { stage: 'RECOMMENDATION_PENDING' },
        },
      ],
      evaluatorProgress: {
        totalEvaluators: evaluators.length,
        activeEvaluators,
        applicationsAssigned: assignedTotal,
        applicationsEvaluated: doneTotal,
        pendingEvaluations: Math.max(0, assignedTotal - doneTotal),
        overdueApplications: overdue,
        completionPct: pct(doneTotal, assignedTotal),
      },
    };
  }

  // ── Section 8: committees and panels ──────────────────────────────────────

  private static committeePanelSection(derived: Derived[], committees: any[], panels: any[]) {
    const bySector = (items: any[]) => {
      const m = new Map<string, number>();
      items.forEach((p) =>
        (p.sectors ?? []).forEach((s: string) => m.set(s, (m.get(s) ?? 0) + 1)),
      );
      return [...m.entries()].map(([sector, count]) => ({ sector, count }));
    };

    const withPanel = derived.filter((d) => (d.row.panelAllocations ?? []).length > 0).length;
    const withEvaluation = derived.filter((d) => (d.row.pitchEvaluations ?? []).length > 0).length;

    return {
      committees: {
        total: committees.length,
        active: committees.filter((c) => c.status === 'ACTIVE').length,
        inactive: committees.filter((c) => c.status !== 'ACTIVE').length,
        members: committees.reduce((n, c) => n + (c._count?.members ?? 0), 0),
      },
      panels: {
        total: panels.length,
        active: panels.filter((p) => p.status === 'ACTIVE').length,
        inactive: panels.filter((p) => p.status !== 'ACTIVE').length,
        members: panels.reduce((n, p) => n + (p._count?.members ?? 0), 0),
        confirmed: panels.filter((p) => !!p.confirmedAt).length,
        applicationsAssigned: panels.reduce((n, p) => n + (p._count?.allocations ?? 0), 0),
        bySector: bySector(panels),
      },
      allocation: [
        { key: 'panel_assigned', label: 'With panel assigned', count: withPanel },
        {
          key: 'panel_pending',
          label: 'Pending panel allocation',
          count: derived.length - withPanel,
        },
        { key: 'evaluator_assigned', label: 'With evaluator assigned', count: withEvaluation },
        {
          key: 'evaluator_pending',
          label: 'Pending evaluator allocation',
          count: derived.length - withEvaluation,
        },
      ],
    };
  }

  // ── Section 9: evaluators and experts ─────────────────────────────────────

  private static evaluatorSection(derived: Derived[], evaluators: any[]) {
    const busy = new Set<string>();
    const finished = new Set<string>();
    derived.forEach((d) =>
      (d.row.pitchEvaluations ?? []).forEach((e) => {
        busy.add(e.evaluatorId);
        if (e.state === 'SUBMITTED' || e.state === 'LOCKED') finished.add(e.evaluatorId);
      }),
    );

    const summarise = (list: any[]) => ({
      total: list.length,
      active: list.filter((e) => e.status === 'ACTIVE').length,
      inactive: list.filter((e) => e.status !== 'ACTIVE').length,
      // Portal access is the only onboarding signal the schema carries for an
      // evaluator: a linked user account means they can sign in.
      onboarded: list.filter((e) => !!e.userId).length,
      pendingOnboarding: list.filter((e) => !e.userId).length,
      assigned: list.filter((e) => busy.has(e.id)).length,
      withPending: list.filter((e) => busy.has(e.id) && !finished.has(e.id)).length,
      completed: list.filter((e) => finished.has(e.id)).length,
    });

    return {
      evaluators: summarise(evaluators),
      experts: summarise(evaluators.filter((e) => EXPERT_TYPE_SET.has(String(e.type)))),
    };
  }

  // ── Sections 10 and 11: sector-wise and scheme-wise ───────────────────────

  private static rollup(derived: Derived[]) {
    const at = (list: Derived[], s: Stage) => list.filter((d) => d.stage === s).length;
    const atOrPast = (list: Derived[], s: Stage) =>
      list.filter((d) => d.stage !== 'CANCELLED' && STAGE_ORDER[d.stage] >= STAGE_ORDER[s]).length;

    return (list: Derived[]) => ({
      selected: list.length,
      planningPending: at(list, 'PENDING_PLANNING'),
      planned: at(list, 'PLANNED'),
      scheduled: at(list, 'SCHEDULED'),
      inProgress: at(list, 'PITCHING_IN_PROGRESS'),
      pitchingCompleted: atOrPast(list, 'PITCHING_COMPLETED'),
      evaluationPending: at(list, 'EVALUATION_PENDING') + at(list, 'PITCHING_COMPLETED'),
      evaluationCompleted: atOrPast(list, 'EVALUATION_COMPLETED'),
      recommendationPending: at(list, 'RECOMMENDATION_PENDING'),
      finalDecision: at(list, 'FINAL_DECISION'),
      cancelled: at(list, 'CANCELLED'),
    });
  }

  private static bySector(derived: Derived[]) {
    const groups = new Map<string, Derived[]>();
    derived.forEach((d) => {
      const key = (d.row.mainSector || 'Unspecified').trim();
      (groups.get(key) ?? groups.set(key, []).get(key)!).push(d);
    });
    const shape = this.rollup(derived);

    return [...groups.entries()]
      .map(([sector, list]) => ({ sector, filter: { sector }, ...shape(list) }))
      .sort((a, b) => b.selected - a.selected);
  }

  private static byScheme(derived: Derived[], names: Map<string, string>) {
    const groups = new Map<string, Derived[]>();
    derived.forEach((d) => {
      const key = d.schemeId ?? 'none';
      (groups.get(key) ?? groups.set(key, []).get(key)!).push(d);
    });
    const shape = this.rollup(derived);

    return [...groups.entries()]
      .map(([schemeId, list]) => ({
        schemeId: schemeId === 'none' ? null : schemeId,
        scheme: schemeId === 'none' ? 'No scheme assigned' : (names.get(schemeId) ?? 'Unknown'),
        filter: schemeId === 'none' ? { schemeStatus: 'NOT_ASSIGNED' } : { schemeId },
        ...shape(list),
      }))
      .sort((a, b) => b.selected - a.selected);
  }

  // ── Section 13: pending actions ───────────────────────────────────────────

  private static pendingActions(
    derived: Derived[],
    evaluators: any[],
    sessions: any[],
    panels: any[],
  ) {
    const at = (s: Stage) => derived.filter((d) => d.stage === s).length;

    const items = [
      {
        key: 'pending_planning',
        label: 'Applications pending pitching planning',
        count: at('PENDING_PLANNING'),
        to: '/pce/calendar',
        filter: { stage: 'PENDING_PLANNING' },
      },
      {
        key: 'pending_panel',
        label: 'Applications pending panel allocation',
        count: derived.filter((d) => (d.row.panelAllocations ?? []).length === 0).length,
        to: '/pce/panels',
        filter: {},
      },
      {
        key: 'pending_evaluator',
        label: 'Applications pending evaluator allocation',
        count: derived.filter(
          (d) =>
            (d.row.panelAllocations ?? []).length > 0 &&
            (d.row.pitchEvaluations ?? []).length === 0,
        ).length,
        to: '/pce/panels',
        filter: {},
      },
      {
        key: 'needs_scheduling',
        label: 'Pitching sessions requiring scheduling',
        count: sessions.filter((s) => s.status === 'DRAFT').length,
        to: '/pce/sessions',
        filter: {},
      },
      {
        key: 'needs_reschedule',
        label: 'Applications requiring rescheduling',
        count: derived.filter((d) => d.row.pceState?.pitchStatus === 'RESCHEDULED').length,
        to: '/pce/calendar/bookings',
        filter: { pitchStatus: 'RESCHEDULED' },
      },
      {
        key: 'stale_pitch',
        label: 'Pitches held but not marked complete',
        count: derived.filter((d) => d.isStalePitch).length,
        to: '/pce/calendar/bookings',
        filter: { stage: 'SCHEDULED' },
      },
      {
        key: 'pending_evaluation',
        label: 'Applications pending evaluation',
        count: at('EVALUATION_PENDING') + at('EVALUATION_IN_PROGRESS'),
        to: '/pce/evaluations',
        filter: { stage: 'EVALUATION_PENDING' },
      },
      {
        key: 'overdue',
        label: `Overdue evaluations (> ${EVALUATION_SLA_DAYS} days)`,
        count: derived.filter((d) => d.isOverdue).length,
        to: '/pce/evaluations',
        filter: {},
      },
      {
        key: 'pending_recommendation',
        label: 'Applications pending final recommendation',
        count: at('EVALUATION_COMPLETED') + at('RECOMMENDATION_PENDING'),
        to: '/pce/final-selection',
        filter: { stage: 'RECOMMENDATION_PENDING' },
      },
      {
        key: 'evaluator_onboarding',
        label: 'Pending evaluator/expert onboarding',
        count: evaluators.filter((e) => !e.userId && e.status === 'ACTIVE').length,
        to: '/pce/evaluators',
        filter: {},
      },
      {
        key: 'unconfirmed_panels',
        label: 'Panels awaiting confirmation',
        // Seated but not yet confirmed: the startups on these panels are
        // waiting on an acceptance that may never come.
        count: panels.filter((p) => !p.confirmedAt && p.status !== 'CANCELLED').length,
        to: '/pce/panels',
        filter: {},
      },
    ];

    // Only the rows that need attention, most pressing first.
    return items.filter((i) => i.count > 0).sort((a, b) => b.count - a.count);
  }

  // ── Section 14: onboarding ────────────────────────────────────────────────

  private static async onboardingSection(derived: Derived[], evaluators: any[]) {
    const linked = evaluators.filter((e) => !!e.userId);

    // The invitation funnel: the specification asks for sent, accepted and
    // declined, which live on PitchInvitation rather than on the evaluator.
    const invitationRows = await prisma.pitchInvitation.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    const invitations = invitationRows.reduce(
      (acc: Record<string, number>, r: any) => ({
        ...acc,
        [String(r.status)]: r._count?._all ?? 0,
      }),
      {},
    );
    const countOf = (...keys: string[]) =>
      keys.reduce((n, k) => n + (invitations[k] ?? 0), 0);

    return {
      invitations: {
        // SENT and RESENT are both "it went out"; PENDING never left the queue.
        sent: countOf('SENT', 'RESENT', 'ACCEPTED', 'DECLINED'),
        accepted: countOf('ACCEPTED'),
        declined: countOf('DECLINED'),
        awaitingReply: countOf('SENT', 'RESENT'),
        failed: countOf('FAILED'),
        queued: countOf('PENDING'),
      },
      evaluators: {
        total: evaluators.length,
        onboarded: linked.length,
        pending: evaluators.length - linked.length,
        active: evaluators.filter((e) => e.status === 'ACTIVE').length,
        inactive: evaluators.filter((e) => e.status === 'INACTIVE').length,
        blacklisted: evaluators.filter((e) => e.status === 'BLACKLISTED').length,
      },
      /** Startup-side onboarding, which is the other half of section 14. */
      startups: {
        notStarted: derived.filter(
          (d) => (d.row.pceState?.onboardingStatus ?? 'NOT_STARTED') === 'NOT_STARTED',
        ).length,
        inProgress: derived.filter((d) => {
          const s = d.row.pceState?.onboardingStatus;
          return !!s && s !== 'NOT_STARTED' && s !== 'COMPLETED';
        }).length,
        completed: derived.filter((d) => d.row.pceState?.onboardingStatus === 'COMPLETED').length,
      },
    };
  }

  // ── Section 15: performance ───────────────────────────────────────────────

  private static performance(derived: Derived[]) {
    const live = derived.filter((d) => d.stage !== 'CANCELLED');
    const planned = live.filter((d) => d.stage !== 'PENDING_PLANNING').length;
    const pitched = live.filter(
      (d) => STAGE_ORDER[d.stage] >= STAGE_ORDER.PITCHING_COMPLETED,
    ).length;
    const evaluated = live.filter(
      (d) => STAGE_ORDER[d.stage] >= STAGE_ORDER.EVALUATION_COMPLETED,
    ).length;

    // Selection to pitch, measured on applications that actually pitched.
    const selectionToPitch: number[] = [];
    const pitchToEvaluation: number[] = [];

    derived.forEach((d) => {
      const completedAt = (d.row.pitchSchedules ?? [])
        .map((s) => s.completedAt)
        .filter(Boolean)[0] as Date | undefined;
      if (completedAt) {
        selectionToPitch.push(days(new Date(d.row.createdAt), new Date(completedAt)));

        const lastSubmission = (d.row.pitchEvaluations ?? [])
          .map((e) => e.submittedAt)
          .filter(Boolean)
          .map((t) => new Date(t as Date).getTime());
        if (lastSubmission.length && d.row.pceState?.evaluationStatus === 'COMPLETED') {
          pitchToEvaluation.push(
            days(new Date(completedAt), new Date(Math.max(...lastSubmission))),
          );
        }
      }
    });

    return {
      plannedPct: pct(planned, live.length),
      pitchedPct: pct(pitched, planned),
      pitchingCompletedPct: pct(pitched, live.length),
      evaluationCompletedPct: pct(evaluated, pitched),
      overduePct: pct(derived.filter((d) => d.isOverdue).length, live.length),
      avgDaysSelectionToPitch: avg(selectionToPitch),
      avgDaysPitchToEvaluation: avg(pitchToEvaluation),
    };
  }

  // ── Section 17: upcoming activities ───────────────────────────────────────

  private static upcoming(sessions: any[], derived: Derived[], now: Date) {
    const soon = sessions
      .filter(
        (s) => new Date(s.presentationDate).getTime() >= now.getTime() && s.status !== 'CANCELLED',
      )
      .slice(0, 10)
      .map((s) => ({
        kind: 'SESSION' as const,
        id: s.id,
        label: s.name,
        at: s.presentationDate,
        detail: `${s._count?.schedules ?? 0} applications`,
        to: `/pce/sessions`,
      }));

    const pitches = derived
      .filter((d) => !!d.schedule && new Date(d.schedule.presentationDate).getTime() >= now.getTime())
      .sort(
        (a, b) =>
          new Date(a.schedule!.presentationDate).getTime() -
          new Date(b.schedule!.presentationDate).getTime(),
      )
      .slice(0, 10)
      .map((d) => ({
        kind: 'PITCH' as const,
        id: d.row.id,
        label: d.row.startupName,
        at: d.schedule!.presentationDate,
        detail: STAGE_LABELS[d.stage],
        to: `/pce/calendar/bookings`,
      }));

    return [...soon, ...pitches]
      .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
      .slice(0, 15);
  }

  // ── Section 16: recent activities ─────────────────────────────────────────

  /**
   * What has just happened, assembled from the timestamps the workflow already
   * writes.
   *
   * There is no audit table for this module, and inventing one would mean every
   * service taking a write it does not otherwise need. These are the real
   * moments instead: a slot was created, a pitch was marked done, an evaluation
   * was submitted, a decision was recorded. Application-bound entries honour the
   * page filters; committees and panels are organisation-level resources and are
   * always shown, because "a panel was created" is news regardless of which
   * sector you are looking at.
   */
  private static async recent(derived: Derived[], committees: any[], panels: any[]) {
    const ids = derived.map((d) => d.row.id);
    const names = new Map(derived.map((d) => [d.row.id, d.row.startupName]));

    type Entry = { kind: string; label: string; detail: string; at: Date; to: string };
    const entries: Entry[] = [];

    // Nothing application-bound to report when the filters match nothing.
    if (ids.length) {
      const [schedules, evaluations, decisions] = await Promise.all([
        prisma.pitchSchedule.findMany({
          where: { applicationId: { in: ids }, deletedAt: null },
          select: { applicationId: true, createdAt: true, completedAt: true, venue: true },
          orderBy: { createdAt: 'desc' },
          take: 15,
        }),
        prisma.pitchEvaluation.findMany({
          where: { applicationId: { in: ids }, submittedAt: { not: null } },
          select: {
            applicationId: true,
            submittedAt: true,
            totalScore: true,
            evaluator: { select: { firstName: true, lastName: true } },
          },
          orderBy: { submittedAt: 'desc' },
          take: 15,
        }),
        prisma.finalSelection.findMany({
          where: { applicationId: { in: ids }, decidedAt: { not: null } },
          select: { applicationId: true, decision: true, decidedAt: true },
          orderBy: { decidedAt: 'desc' },
          take: 15,
        }),
      ]);

      schedules.forEach((r) => {
        const name = names.get(r.applicationId) ?? 'An application';
        entries.push({
          kind: 'PITCH_PLANNED',
          label: `Pitch planned for ${name}`,
          detail: r.venue ?? 'Slot created',
          at: r.createdAt,
          to: '/pce/calendar/bookings',
        });
        if (r.completedAt) {
          entries.push({
            kind: 'PITCH_COMPLETED',
            label: `${name} completed its pitch`,
            detail: 'Marked complete',
            at: r.completedAt,
            to: '/pce/calendar/bookings',
          });
        }
      });

      evaluations.forEach((r) => {
        const who = [r.evaluator?.firstName, r.evaluator?.lastName].filter(Boolean).join(' ');
        entries.push({
          kind: 'EVALUATION_SUBMITTED',
          label: `Evaluation submitted for ${names.get(r.applicationId) ?? 'an application'}`,
          detail: `${who || 'An evaluator'} · ${Math.round(r.totalScore)} marks`,
          at: r.submittedAt as Date,
          to: '/pce/evaluations',
        });
      });

      decisions.forEach((r) => {
        entries.push({
          kind: 'FINAL_DECISION',
          label: `Decision recorded for ${names.get(r.applicationId) ?? 'an application'}`,
          detail: String(r.decision ?? '').replace(/_/g, ' '),
          at: r.decidedAt as Date,
          to: '/pce/final-selection',
        });
      });
    }

    committees.slice(0, 10).forEach((c) => {
      if (c.createdAt) {
        entries.push({
          kind: 'COMMITTEE_FORMED',
          label: `Committee formed: ${c.name}`,
          detail: `${c._count?.members ?? 0} members`,
          at: c.createdAt,
          to: '/pce/committees',
        });
      }
    });

    panels.slice(0, 10).forEach((p) => {
      if (p.createdAt) {
        entries.push({
          kind: 'PANEL_CREATED',
          label: `Panel created: ${p.name}`,
          detail: p.confirmedAt ? 'Confirmed' : 'Awaiting confirmation',
          at: p.createdAt,
          to: '/pce/panels',
        });
      }
    });

    return entries
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 20)
      .map((e) => ({ ...e, at: new Date(e.at).toISOString() }));
  }

  // ── Drill-down ────────────────────────────────────────────────────────────

  /**
   * The applications behind any dashboard number.
   *
   * Takes the same filters, including the derived `stage`, so a card and the
   * list it opens cannot disagree: both run the same predicate and the same
   * derivation.
   */
  static async listApplications(
    filters: DashboardFilters & { page?: number; pageSize?: number },
  ) {
    const now = new Date();
    const rows = await prisma.startupApplication.findMany({
      where: this.buildWhere(filters),
      select: projection,
    });

    const derived = this.derive(rows, now);
    const wanted = filters.stage?.trim();
    const matched =
      wanted && (STAGES as readonly string[]).includes(wanted)
        ? derived.filter((d) => d.stage === wanted)
        : derived;

    const page = Math.max(1, Number(filters.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(filters.pageSize) || 25));
    const start = (page - 1) * pageSize;

    return {
      total: matched.length,
      page,
      pageSize,
      items: matched.slice(start, start + pageSize).map((d) => ({
        id: d.row.id,
        applicationNo: d.row.applicationNo,
        startupName: d.row.startupName,
        sector: d.row.mainSector,
        status: d.row.status,
        stage: d.stage,
        stageLabel: STAGE_LABELS[d.stage],
        schemeId: d.schemeId,
        presentationDate: d.schedule?.presentationDate ?? null,
        startTime: d.schedule?.startTime ?? null,
        venue: d.schedule?.venue ?? null,
        panelCount: (d.row.panelAllocations ?? []).length,
        submittedEvaluations: d.submittedCount,
        isOverdue: d.isOverdue,
        isStalePitch: d.isStalePitch,
        decision: d.row.finalSelection?.decision ?? null,
      })),
    };
  }
}

export default DashboardService;
