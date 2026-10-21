import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import {
  LIVE,
  PCE_COHORT,
  NO_SCHEME_ASSIGNED,
  DECIDED_SCHEME_STATUSES,
  ONBOARDING_NOT_STARTED,
  ONBOARDING_IN_PROGRESS,
} from './pce.constants';

/**
 * PCE — Pitching, Committee, Evaluator & Onboarding.
 *
 * The stretch of the journey from Selected for Pitch through to onboarding.
 *
 * Two things worth knowing before reading anything below:
 *
 * 1. ApplicationPceState rows are created lazily - an application that has
 *    never been touched by this module has no row. So "Scheme Not Assigned"
 *    means *either* no row at all *or* a row saying NOT_ASSIGNED, and every
 *    count here has to treat those the same way.
 *
 * 2. The soft-delete extension filters findMany and count, but not groupBy.
 *    ApplicationPceState has no deletedAt of its own either, so anything
 *    reading it has to exclude states belonging to deleted applications
 *    explicitly, via `application: { deletedAt: null }`.
 */

type Counts = Record<string, number>;

/** groupBy rows -> { value: count }, with every expected key present as 0. */
const tally = (rows: Array<Record<string, any>>, field: string): Counts =>
  rows.reduce((acc: Counts, r) => {
    const key = String(r[field] ?? '');
    acc[key] = (acc[key] ?? 0) + (r._count?._all ?? 0);
    return acc;
  }, {});

const sumOf = (counts: Counts, keys: readonly string[]) =>
  keys.reduce((n, k) => n + (counts[k] ?? 0), 0);

/** Section 1's dashboard filters. */
export interface DashboardFilters {
  schemeId?: string;
  /**
   * The spec's "Program" filter.
   *
   * Mapped to Cohort: a cohort belongs to a scheme and applications join one
   * through StartupApplication.cohortId, which is what a programme or batch
   * is in this schema. There is no separate Program entity to invent.
   */
  cohortId?: string;
  schemeStatus?: string;
  sector?: string;
  status?: string;
  evaluationStatus?: string;
  onboardingStatus?: string;
  finalDecision?: string;
  panelId?: string;
  /** INTERNAL or EXTERNAL - matches applications whose panel seats one. */
  evaluatorAffiliation?: string;
  appliedFrom?: string;
  appliedTo?: string;
  pitchFrom?: string;
  pitchTo?: string;
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

export class PceService {
  /**
   * Section 1's filters, as one application-level predicate.
   *
   * Built once and applied to every count below, so no card can be filtered
   * differently from its neighbours.
   */
  static buildDashboardWhere(f: DashboardFilters = {}): Prisma.StartupApplicationWhereInput {
    const and: Prisma.StartupApplicationWhereInput[] = [LIVE];

    if (f.sector?.trim()) {
      and.push({ mainSector: { equals: f.sector.trim(), mode: 'insensitive' } });
    }
    if (f.status?.trim()) and.push({ status: f.status.trim() as any });
    if (f.cohortId?.trim()) and.push({ cohortId: f.cohortId.trim() });
    if (f.schemeStatus?.trim()) {
      and.push(
        f.schemeStatus.trim() === 'NOT_ASSIGNED'
          ? NO_SCHEME_ASSIGNED
          : { pceState: { schemeStatus: f.schemeStatus.trim() as any } },
      );
    }
    if (f.evaluationStatus?.trim()) {
      and.push({ pceState: { evaluationStatus: f.evaluationStatus.trim() as any } });
    }
    if (f.onboardingStatus?.trim()) {
      and.push({ pceState: { onboardingStatus: f.onboardingStatus.trim() as any } });
    }
    if (f.finalDecision?.trim()) {
      and.push({ finalSelection: { decision: f.finalDecision.trim() as any } });
    }
    if (f.schemeId?.trim()) {
      const id = f.schemeId.trim();
      and.push({
        OR: [
          { pceState: { finalSchemeId: id } },
          { pceState: { provisionalSchemeId: id } },
          { AND: [{ schemeId: id }, NO_SCHEME_ASSIGNED] },
        ],
      });
    }
    if (f.panelId?.trim()) {
      and.push({ panelAllocations: { some: { panelId: f.panelId.trim() } } });
    }
    if (f.evaluatorAffiliation?.trim()) {
      // Applications sitting with a panel that seats an evaluator of this kind.
      and.push({
        panelAllocations: {
          some: {
            panel: {
              deletedAt: null,
              members: { some: { evaluator: { affiliation: f.evaluatorAffiliation.trim() as any } } },
            },
          },
        },
      });
    }

    const applied = dayRange(f.appliedFrom, f.appliedTo);
    if (applied) and.push({ createdAt: applied });

    const pitched = dayRange(f.pitchFrom, f.pitchTo);
    if (pitched) {
      and.push({
        pitchSchedules: {
          some: { deletedAt: null, isActive: true, presentationDate: pitched },
        },
      });
    }

    return { AND: and };
  }

  /**
   * Section 1: the twenty dashboard cards, honouring section 1's filters.
   *
   * Seven queries rather than twenty: the status dimensions come from one
   * grouped read of the state table, and only the two scheme figures are
   * counted directly, because those two have to match the Assign Scheme
   * listing row for row.
   */
  static async getDashboard(filters: DashboardFilters = {}) {
    // The same predicate on every query, so the cards stay comparable.
    const appWhere = this.buildDashboardWhere(filters);
    const [
      screeningCount,
      selectedForPitchCount,
      pceStateRows,
      statesWithoutDecision,
      decisionRows,
      schemeNotAssigned,
      schemeAssigned,
    ] = await Promise.all([
      prisma.startupApplication.count({
        where: { AND: [appWhere, { status: 'UNDER_REVIEW' }] },
      }),
      prisma.startupApplication.count({
        where: { AND: [appWhere, { status: 'SELECTED_FOR_PITCH' }] },
      }),
      prisma.applicationPceState.groupBy({
        by: ['schemeStatus', 'pitchStatus', 'evaluationStatus', 'onboardingStatus'],
        where: { application: appWhere },
        _count: { _all: true },
      }),
      // Evaluation finished but the committee has not recorded a decision yet.
      prisma.applicationPceState.count({
        where: {
          application: appWhere,
          evaluationStatus: 'COMPLETED',
          OR: [
            { application: { finalSelection: null } },
            { application: { finalSelection: { decision: null } } },
          ],
        },
      }),
      prisma.finalSelection.groupBy({
        by: ['decision'],
        where: { application: appWhere },
        _count: { _all: true },
      }),
      // Counted with exactly the predicate the Assign Scheme listing filters
      // by, so the card and the list it opens can never disagree.
      prisma.startupApplication.count({
        where: { AND: [PCE_COHORT, appWhere, NO_SCHEME_ASSIGNED] },
      }),
      prisma.startupApplication.count({
        where: {
          AND: [
            PCE_COHORT,
            appWhere,
            { pceState: { schemeStatus: { in: DECIDED_SCHEME_STATUSES as any } } },
          ],
        },
      }),
    ]);

    // The grouped rows are multi-dimensional, so each dimension is folded
    // separately rather than read off one combined key.
    const fold = (field: string): Counts =>
      pceStateRows.reduce((acc: Counts, r: any) => {
        const key = String(r[field] ?? '');
        acc[key] = (acc[key] ?? 0) + (r._count?._all ?? 0);
        return acc;
      }, {});

    const pitch = fold('pitchStatus');
    const evaluation = fold('evaluationStatus');
    const onboarding = fold('onboardingStatus');
    const decision = tally(decisionRows as any[], 'decision');

    const cards = [
      { key: 'screening', label: 'Applications Under Preliminary Screening', count: screeningCount, filter: { status: 'UNDER_REVIEW' } },
      { key: 'selected_for_pitch', label: 'Selected for Pitch', count: selectedForPitchCount, filter: { status: 'SELECTED_FOR_PITCH' } },

      { key: 'scheme_not_assigned', label: 'Scheme Not Assigned', count: schemeNotAssigned, filter: { schemeStatus: 'NOT_ASSIGNED' } },
      { key: 'scheme_assigned', label: 'Scheme Assigned', count: schemeAssigned, filter: { schemeStatus: 'ASSIGNED_ANY' } },

      { key: 'invitation_pending', label: 'Pitch Invitation Pending', count: pitch['INVITATION_PENDING'] ?? 0, filter: { pitchStatus: 'INVITATION_PENDING' } },
      { key: 'pitch_scheduled', label: 'Pitch Scheduled', count: (pitch['SCHEDULED'] ?? 0) + (pitch['RESCHEDULED'] ?? 0), filter: { pitchStatus: 'SCHEDULED' } },
      { key: 'pitch_completed', label: 'Presentation Completed', count: pitch['COMPLETED'] ?? 0, filter: { pitchStatus: 'COMPLETED' } },

      { key: 'evaluation_pending', label: 'Evaluation Pending', count: evaluation['PENDING'] ?? 0, filter: { evaluationStatus: 'PENDING' } },
      { key: 'evaluation_in_progress', label: 'Evaluation In Progress', count: evaluation['IN_PROGRESS'] ?? 0, filter: { evaluationStatus: 'IN_PROGRESS' } },
      { key: 'evaluation_completed', label: 'Evaluation Completed', count: evaluation['COMPLETED'] ?? 0, filter: { evaluationStatus: 'COMPLETED' } },

      { key: 'final_decision_pending', label: 'Final Decision Pending', count: statesWithoutDecision, filter: { finalDecision: 'PENDING' } },

      {
        key: 'selected_for_incubation',
        label: 'Selected for Incubation',
        count:
          (decision['APPROVED_FOR_INCUBATION'] ?? 0) +
          (decision['APPROVED_WITH_GRANT'] ?? 0) +
          (decision['APPROVED_WITHOUT_GRANT'] ?? 0) +
          (decision['APPROVED_WITH_CONDITIONS'] ?? 0),
        filter: { finalDecision: 'APPROVED_ANY' },
      },
      { key: 'selected_with_grant', label: 'Selected with Grant', count: decision['APPROVED_WITH_GRANT'] ?? 0, filter: { finalDecision: 'APPROVED_WITH_GRANT' } },
      { key: 'selected_without_grant', label: 'Selected without Grant', count: decision['APPROVED_WITHOUT_GRANT'] ?? 0, filter: { finalDecision: 'APPROVED_WITHOUT_GRANT' } },
      { key: 're_pitch', label: 'Re-Pitch Required', count: decision['RE_PRESENTATION_REQUIRED'] ?? 0, filter: { finalDecision: 'RE_PRESENTATION_REQUIRED' } },
      { key: 'waitlisted', label: 'Waitlisted', count: decision['WAITLISTED'] ?? 0, filter: { finalDecision: 'WAITLISTED' } },
      { key: 'rejected', label: 'Rejected', count: decision['REJECTED'] ?? 0, filter: { finalDecision: 'REJECTED' } },

      { key: 'onboarding_pending', label: 'Onboarding Pending', count: sumOf(onboarding, ONBOARDING_NOT_STARTED), filter: { onboardingStatus: 'PENDING_ANY' } },
      { key: 'onboarding_in_progress', label: 'Onboarding In Progress', count: sumOf(onboarding, ONBOARDING_IN_PROGRESS), filter: { onboardingStatus: 'IN_PROGRESS_ANY' } },
      { key: 'onboarding_completed', label: 'Onboarding Completed', count: onboarding['COMPLETED'] ?? 0, filter: { onboardingStatus: 'COMPLETED' } },
    ];

    return { cards };
  }

  /**
   * The PCE state row for an application, created on first use.
   *
   * Creating it is the only write here, and it writes nothing but defaults -
   * the scheme an application was submitted under is left where it is, on
   * StartupApplication, and is never copied in as if it had been assigned.
   */
  static async ensureState(applicationId: string) {
    const existing = await prisma.applicationPceState.findUnique({
      where: { applicationId },
    });
    if (existing) return existing;

    // The application has to exist and be live; creating a state row for a
    // deleted or missing application would put a phantom in every count.
    const application = await prisma.startupApplication.findUnique({
      where: { id: applicationId },
      select: { id: true },
    });
    if (!application) {
      throw Object.assign(new Error('Application not found'), { status: 404 });
    }

    try {
      return await prisma.applicationPceState.create({ data: { applicationId } });
    } catch (e: any) {
      // Two requests can race here; the unique constraint settles it and the
      // loser just reads what the winner wrote.
      if (e?.code === 'P2002') {
        return await prisma.applicationPceState.findUnique({ where: { applicationId } });
      }
      throw e;
    }
  }
}

export default PceService;
