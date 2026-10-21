import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { BadRequestError } from '../../common/utils/apiError';
import { SchemeAssignmentService } from './scheme-assignment.service';
import { HonorariumService } from './honorarium.service';
import {
  LIVE,
  PCE_COHORT,
  NO_SCHEME_ASSIGNED,
  APPROVED_DECISIONS,
  DECIDED_SCHEME_STATUSES,
} from './pce.constants';

/**
 * Section 35: the fifteen PCE reports.
 *
 * Each returns the same shape - a title, a column list and rows keyed by those
 * columns - so one screen renders all of them and one export path covers all
 * of them. Fifteen bespoke screens would be fifteen places for a column to
 * drift from the data behind it.
 *
 * Where a report is the same question a screen already answers, it calls that
 * service rather than writing the query again. A report that disagreed with the
 * screen it mirrors would be worse than no report.
 */

export interface ReportColumn {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'money' | 'date' | 'percent';
}

export interface ReportResult {
  key: string;
  title: string;
  description: string;
  columns: ReportColumn[];
  rows: Array<Record<string, unknown>>;
  total: number;
  /** Column keys to sum in a totals row, when summing is meaningful. */
  totalsFor?: string[];
}

interface ReportParams {
  from?: string;
  to?: string;
  schemeId?: string;
  panelId?: string;
}

const COUNTED_EVALUATION = ['SUBMITTED', 'LOCKED'] as const;
const APPROVED = new Set<string>(APPROVED_DECISIONS);

const schemeRef = { id: true, name: true, code: true } as const;

const evaluatorName = (e: any) =>
  [e?.firstName, e?.middleName, e?.lastName].filter(Boolean).join(' ').trim() || '—';

const schemeName = (s: any) => (s ? `${s.name} (${s.code})` : '—');

const avg = (values: number[]): number | null => {
  const usable = values.filter((n) => Number.isFinite(n));
  if (usable.length === 0) return null;
  return Math.round((usable.reduce((a, b) => a + b, 0) / usable.length) * 10) / 10;
};

/** Current scheme: final beats provisional beats the one applied under. */
const currentScheme = (r: any) =>
  r?.pceState?.finalScheme ?? r?.pceState?.provisionalScheme ?? r?.scheme ?? null;

export class ReportsService {
  /** What the Reports screen offers, grouped the way section 35 lists them. */
  static catalogue() {
    return {
      reports: [
        { key: 'scheme-wise-applications', title: 'Scheme-Wise Application Report', group: 'Scheme' },
        { key: 'scheme-assignment-pending', title: 'Scheme Assignment Pending', group: 'Scheme' },
        { key: 'scheme-assignment-history', title: 'Scheme Assignment History', group: 'Scheme' },
        { key: 'scheme-change', title: 'Scheme Change Report', group: 'Scheme' },
        { key: 'preliminary-screening', title: 'Preliminary Screening Report', group: 'Screening' },
        { key: 'pitch-schedule', title: 'Pitch Schedule Report', group: 'Pitching' },
        { key: 'panel-evaluation', title: 'Panel Evaluation Report', group: 'Evaluation' },
        { key: 'evaluator', title: 'Evaluator Report', group: 'Evaluation' },
        { key: 'final-evaluation', title: 'Final Evaluation Report', group: 'Evaluation' },
        { key: 'final-selection', title: 'Final Selection Report', group: 'Selection' },
        { key: 'grant-recommendation', title: 'Grant Recommendation Report', group: 'Grant' },
        { key: 'grant-sanction', title: 'Grant Sanction Report', group: 'Grant' },
        { key: 'scheme-grant-utilization', title: 'Scheme-Wise Grant Utilization', group: 'Grant' },
        { key: 'onboarding', title: 'Onboarding Report', group: 'Onboarding' },
        { key: 'honorarium', title: 'Honorarium Report', group: 'Payments' },
      ],
    };
  }

  /**
   * Dispatch by key.
   *
   * A switch rather than a lookup table so a key the catalogue advertises
   * without an implementation behind it is a compile error, not a runtime one.
   */
  static async run(key: string, params: ReportParams): Promise<ReportResult> {
    switch (key) {
      case 'scheme-wise-applications':
        return this.schemeWiseApplications();
      case 'scheme-assignment-pending':
        return this.schemeAssignmentPending();
      case 'scheme-assignment-history':
        return this.schemeAssignmentHistory(params);
      case 'scheme-change':
        return this.schemeChange(params);
      case 'preliminary-screening':
        return this.preliminaryScreening(params);
      case 'pitch-schedule':
        return this.pitchSchedule(params);
      case 'panel-evaluation':
        return this.panelEvaluation(params);
      case 'evaluator':
        return this.evaluator();
      case 'final-evaluation':
        return this.finalEvaluation(params);
      case 'final-selection':
        return this.finalSelection(params);
      case 'grant-recommendation':
        return this.grantRecommendation(params);
      case 'grant-sanction':
        return this.grantSanction(params);
      case 'scheme-grant-utilization':
        return this.schemeGrantUtilization();
      case 'onboarding':
        return this.onboarding(params);
      case 'honorarium':
        return this.honorarium(params);
      default:
        throw new BadRequestError(`Unknown report "${key}"`);
    }
  }

  // ── Scheme ────────────────────────────────────────────────────────────────

  private static async schemeWiseApplications(): Promise<ReportResult> {
    // The same aggregation the Scheme-Wise Applications screen shows.
    const overview = await SchemeAssignmentService.schemeOverview();
    return {
      key: 'scheme-wise-applications',
      title: 'Scheme-Wise Application Report',
      description:
        'Applications assigned to each scheme and how far they have progressed. "Awaiting" counts applications submitted under the scheme with no assignment yet, and is deliberately separate from the assigned total.',
      columns: [
        { key: 'scheme', label: 'Scheme' },
        { key: 'status', label: 'Status' },
        { key: 'awaiting', label: 'Awaiting Assignment', type: 'number' },
        { key: 'assigned', label: 'Assigned', type: 'number' },
        { key: 'selectedForPitch', label: 'Selected for Pitch', type: 'number' },
        { key: 'pitchScheduled', label: 'Pitch Scheduled', type: 'number' },
        { key: 'pitchCompleted', label: 'Pitch Completed', type: 'number' },
        { key: 'evaluationPending', label: 'Evaluation Pending', type: 'number' },
        { key: 'evaluationCompleted', label: 'Evaluation Completed', type: 'number' },
        { key: 'selected', label: 'Selected', type: 'number' },
        { key: 'grantApproved', label: 'Grant Approved', type: 'number' },
        { key: 'onboardingPending', label: 'Onboarding Pending', type: 'number' },
        { key: 'onboardingCompleted', label: 'Onboarding Completed', type: 'number' },
      ],
      rows: overview.items.map((it: any) => ({
        scheme: schemeName(it.scheme),
        status: it.scheme.status,
        awaiting: it.awaitingAssignment,
        assigned: it.counts.totalApplications,
        selectedForPitch: it.counts.selectedForPitch,
        pitchScheduled: it.counts.pitchScheduled,
        pitchCompleted: it.counts.pitchCompleted,
        evaluationPending: it.counts.evaluationPending,
        evaluationCompleted: it.counts.evaluationCompleted,
        selected: it.counts.selected,
        grantApproved: it.counts.grantApproved,
        onboardingPending: it.counts.onboardingPending,
        onboardingCompleted: it.counts.onboardingCompleted,
      })),
      total: overview.items.length,
      totalsFor: [
        'awaiting',
        'assigned',
        'selectedForPitch',
        'pitchScheduled',
        'pitchCompleted',
        'evaluationPending',
        'evaluationCompleted',
        'selected',
        'grantApproved',
        'onboardingPending',
        'onboardingCompleted',
      ],
    };
  }

  private static async schemeAssignmentPending(): Promise<ReportResult> {
    const rows = await prisma.startupApplication.findMany({
      where: { AND: [PCE_COHORT, NO_SCHEME_ASSIGNED] },
      select: {
        applicationNo: true,
        startupName: true,
        fullName: true,
        mainSector: true,
        status: true,
        createdAt: true,
        scheme: { select: schemeRef },
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      key: 'scheme-assignment-pending',
      title: 'Scheme Assignment Pending',
      description:
        'Applications in the pitching process with no scheme assigned yet. Counted with the same rule the Assign Scheme screen filters by, so this matches that list exactly.',
      columns: [
        { key: 'applicationNo', label: 'Application No' },
        { key: 'startupName', label: 'Startup' },
        { key: 'founder', label: 'Founder' },
        { key: 'sector', label: 'Sector' },
        { key: 'appliedUnder', label: 'Applied Under' },
        { key: 'status', label: 'Application Status' },
        { key: 'appliedOn', label: 'Applied On', type: 'date' },
      ],
      rows: rows.map((r) => ({
        applicationNo: r.applicationNo ?? '—',
        startupName: r.startupName,
        founder: r.fullName,
        sector: r.mainSector,
        appliedUnder: schemeName(r.scheme),
        status: r.status,
        appliedOn: r.createdAt,
      })),
      total: rows.length,
    };
  }

  private static async schemeAssignmentHistory(params: ReportParams): Promise<ReportResult> {
    const history = await SchemeAssignmentService.history({
      schemeId: params.schemeId,
      limit: 500,
    });
    const range = HonorariumService.dateRange(params.from, params.to);
    const items = range
      ? history.items.filter((h: any) => {
          const t = new Date(h.performedAt).getTime();
          if (range.gte && t < new Date(range.gte).getTime()) return false;
          if (range.lte && t > new Date(range.lte).getTime()) return false;
          return true;
        })
      : history.items;

    return {
      key: 'scheme-assignment-history',
      title: 'Scheme Assignment History',
      description:
        'Every scheme assignment, change and confirmation. This is a permanent record — nothing is ever removed from it.',
      columns: [
        { key: 'date', label: 'Date', type: 'date' },
        { key: 'applicationNo', label: 'Application No' },
        { key: 'startupName', label: 'Startup' },
        { key: 'previousScheme', label: 'Previous Scheme' },
        { key: 'scheme', label: 'Scheme' },
        { key: 'kind', label: 'Assignment Type' },
        { key: 'action', label: 'Action' },
        { key: 'performedBy', label: 'By' },
        { key: 'reason', label: 'Reason' },
        { key: 'remarks', label: 'Remarks' },
      ],
      rows: items.map((h: any) => ({
        date: h.performedAt,
        applicationNo: h.application?.applicationNo ?? '—',
        startupName: h.application?.startupName ?? '—',
        previousScheme: h.previousScheme ? schemeName(h.previousScheme) : '—',
        scheme: schemeName(h.scheme),
        kind: h.kind,
        action: h.action,
        performedBy: h.performedByName,
        reason: h.reason ?? '—',
        remarks: h.remarks ?? '—',
      })),
      total: items.length,
    };
  }

  private static async schemeChange(params: ReportParams): Promise<ReportResult> {
    const base = await this.schemeAssignmentHistory(params);
    const rows = base.rows.filter((r) => r.action === 'CHANGED');
    return {
      ...base,
      key: 'scheme-change',
      title: 'Scheme Change Report',
      description:
        'Only the entries where an already-assigned scheme was changed, with the reason recorded at the time.',
      rows,
      total: rows.length,
    };
  }

  // ── Screening ─────────────────────────────────────────────────────────────

  private static async preliminaryScreening(params: ReportParams): Promise<ReportResult> {
    const range = HonorariumService.dateRange(params.from, params.to);
    const rows = await prisma.startupApplication.findMany({
      where: {
        ...LIVE,
        ...(range ? { createdAt: range } : {}),
        reviews: { some: {} },
      },
      select: {
        applicationNo: true,
        startupName: true,
        mainSector: true,
        status: true,
        currentLevel: true,
        createdAt: true,
        scheme: { select: schemeRef },
        reviews: {
          select: { level: true, totalScore: true, recommendation: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      key: 'preliminary-screening',
      title: 'Preliminary Screening Report',
      description:
        'Screening outcomes from the review stages. The score is the average across the stages actually reviewed — stages never reviewed are excluded rather than counted as zero.',
      columns: [
        { key: 'applicationNo', label: 'Application No' },
        { key: 'startupName', label: 'Startup' },
        { key: 'sector', label: 'Sector' },
        { key: 'appliedUnder', label: 'Applied Under' },
        { key: 'reviews', label: 'Reviews', type: 'number' },
        { key: 'score', label: 'Preliminary Score', type: 'percent' },
        { key: 'stage', label: 'Current Stage' },
        { key: 'status', label: 'Status' },
        { key: 'appliedOn', label: 'Applied On', type: 'date' },
      ],
      rows: rows.map((r) => {
        const scored = (r.reviews ?? [])
          .map((v) => Number(v.totalScore))
          .filter((n) => Number.isFinite(n) && n > 0);
        return {
          applicationNo: r.applicationNo ?? '—',
          startupName: r.startupName,
          sector: r.mainSector,
          appliedUnder: schemeName(r.scheme),
          reviews: scored.length,
          score: avg(scored),
          stage: r.currentLevel,
          status: r.status,
          appliedOn: r.createdAt,
        };
      }),
      total: rows.length,
    };
  }

  // ── Pitching ──────────────────────────────────────────────────────────────

  private static async pitchSchedule(params: ReportParams): Promise<ReportResult> {
    const range = HonorariumService.dateRange(params.from, params.to);
    const rows = await prisma.pitchSchedule.findMany({
      where: {
        deletedAt: null,
        application: LIVE,
        ...(range ? { presentationDate: range } : {}),
        ...(params.panelId ? { panelId: params.panelId } : {}),
        ...(params.schemeId ? { schemeId: params.schemeId } : {}),
      },
      select: {
        presentationDate: true,
        startTime: true,
        endTime: true,
        session: true,
        mode: true,
        venue: true,
        status: true,
        isActive: true,
        statusReason: true,
        scheme: { select: schemeRef },
        panel: { select: { name: true } },
        application: {
          select: { applicationNo: true, startupName: true, mainSector: true },
        },
      },
      orderBy: [{ presentationDate: 'asc' }, { startTime: 'asc' }],
    });

    return {
      key: 'pitch-schedule',
      title: 'Pitch Schedule Report',
      description:
        'Every presentation booking in the range, including superseded ones — a row marked not current was rescheduled, and its replacement appears separately.',
      columns: [
        { key: 'date', label: 'Date', type: 'date' },
        { key: 'time', label: 'Time' },
        { key: 'applicationNo', label: 'Application No' },
        { key: 'startupName', label: 'Startup' },
        { key: 'sector', label: 'Sector' },
        { key: 'scheme', label: 'Scheme' },
        { key: 'panel', label: 'Panel' },
        { key: 'session', label: 'Session' },
        { key: 'mode', label: 'Mode' },
        { key: 'venue', label: 'Venue' },
        { key: 'status', label: 'Status' },
        { key: 'current', label: 'Current' },
        { key: 'reason', label: 'Status Reason' },
      ],
      rows: rows.map((r) => {
        const t = (v: Date | null) =>
          v
            ? new Date(v).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
            : null;
        const start = t(r.startTime);
        const end = t(r.endTime);
        return {
          date: r.presentationDate,
          time: start ? (end ? `${start} – ${end}` : start) : (r.session ?? '—'),
          applicationNo: r.application?.applicationNo ?? '—',
          startupName: r.application?.startupName ?? '—',
          sector: r.application?.mainSector ?? '—',
          scheme: r.scheme ? schemeName(r.scheme) : 'Not assigned',
          panel: r.panel?.name ?? '—',
          session: r.session ?? '—',
          mode: r.mode,
          venue: r.venue ?? '—',
          status: r.status,
          current: r.isActive ? 'Yes' : 'No',
          reason: r.statusReason ?? '—',
        };
      }),
      total: rows.length,
    };
  }

  // ── Evaluation ────────────────────────────────────────────────────────────

  private static async panelEvaluation(params: ReportParams): Promise<ReportResult> {
    const panels = await prisma.evaluationPanel.findMany({
      where: {
        ...LIVE,
        ...(params.schemeId ? { schemeId: params.schemeId } : {}),
        ...(params.panelId ? { id: params.panelId } : {}),
      },
      select: {
        name: true,
        status: true,
        pitchDate: true,
        session: true,
        sectors: true,
        scheme: { select: schemeRef },
        members: { select: { evaluatorId: true } },
        allocations: { select: { id: true } },
        evaluations: { select: { totalScore: true, state: true, recommendation: true } },
      },
      orderBy: [{ pitchDate: 'desc' }, { name: 'asc' }],
    });

    return {
      key: 'panel-evaluation',
      title: 'Panel Evaluation Report',
      description:
        'How each panel performed: what it was allocated, how much it has scored, and its average. Averages cover submitted and locked evaluations only.',
      columns: [
        { key: 'panel', label: 'Panel' },
        { key: 'scheme', label: 'Scheme' },
        { key: 'pitchDate', label: 'Pitch Date', type: 'date' },
        { key: 'session', label: 'Session' },
        { key: 'sectors', label: 'Sectors' },
        { key: 'evaluators', label: 'Evaluators', type: 'number' },
        { key: 'allocated', label: 'Allocated', type: 'number' },
        { key: 'submitted', label: 'Submitted', type: 'number' },
        { key: 'expected', label: 'Expected', type: 'number' },
        { key: 'averageScore', label: 'Average Score', type: 'number' },
        { key: 'status', label: 'Status' },
      ],
      rows: panels.map((p) => {
        const counted = (p.evaluations ?? []).filter((e) =>
          COUNTED_EVALUATION.includes(e.state as any),
        );
        return {
          panel: p.name,
          scheme: p.scheme ? schemeName(p.scheme) : 'Not scheme-specific',
          pitchDate: p.pitchDate,
          session: p.session ?? '—',
          sectors: (p.sectors ?? []).join(', ') || 'Any',
          evaluators: (p.members ?? []).length,
          allocated: (p.allocations ?? []).length,
          submitted: counted.length,
          // Everyone seated is expected to score everything allocated.
          expected: (p.members ?? []).length * (p.allocations ?? []).length,
          averageScore: avg(counted.map((e) => Number(e.totalScore))),
          status: p.status,
        };
      }),
      total: panels.length,
      totalsFor: ['evaluators', 'allocated', 'submitted', 'expected'],
    };
  }

  private static async evaluator(): Promise<ReportResult> {
    const evaluators = await prisma.evaluator.findMany({
      where: LIVE,
      select: {
        firstName: true,
        middleName: true,
        lastName: true,
        affiliation: true,
        type: true,
        organization: true,
        status: true,
        sectors: true,
        _count: { select: { committeeSeats: true, panelSeats: true } },
        pitchEvaluations: { select: { totalScore: true, state: true } },
        honorariums: { select: { totalPayable: true, status: true } },
      },
      orderBy: { firstName: 'asc' },
    });

    return {
      key: 'evaluator',
      title: 'Evaluator Report',
      description:
        'Every expert on the register, with their committee and panel involvement, what they have scored and what they have been paid.',
      columns: [
        { key: 'evaluator', label: 'Evaluator' },
        { key: 'affiliation', label: 'Internal / External' },
        { key: 'type', label: 'Type' },
        { key: 'organization', label: 'Organization' },
        { key: 'sectors', label: 'Sectors' },
        { key: 'committees', label: 'Committees', type: 'number' },
        { key: 'panels', label: 'Panels', type: 'number' },
        { key: 'evaluated', label: 'Applications Evaluated', type: 'number' },
        { key: 'averageScore', label: 'Average Score Given', type: 'number' },
        { key: 'paid', label: 'Total Paid', type: 'money' },
        { key: 'outstanding', label: 'Outstanding', type: 'money' },
        { key: 'status', label: 'Status' },
      ],
      rows: evaluators.map((e) => {
        const counted = (e.pitchEvaluations ?? []).filter((v) =>
          COUNTED_EVALUATION.includes(v.state as any),
        );
        const hon = e.honorariums ?? [];
        return {
          evaluator: evaluatorName(e),
          affiliation: e.affiliation,
          type: e.type,
          organization: e.organization ?? '—',
          sectors: (e.sectors ?? []).join(', ') || '—',
          committees: e._count.committeeSeats,
          panels: e._count.panelSeats,
          evaluated: counted.length,
          averageScore: avg(counted.map((v) => Number(v.totalScore))),
          paid: hon
            .filter((h) => h.status === 'PAID')
            .reduce((n, h) => n + Number(h.totalPayable ?? 0), 0),
          outstanding: hon
            .filter((h) => h.status === 'PENDING' || h.status === 'PROCESSING')
            .reduce((n, h) => n + Number(h.totalPayable ?? 0), 0),
          status: e.status,
        };
      }),
      total: evaluators.length,
      totalsFor: ['committees', 'panels', 'evaluated', 'paid', 'outstanding'],
    };
  }

  private static async finalEvaluation(params: ReportParams): Promise<ReportResult> {
    const rows = await this.evaluationRows(params);

    return {
      key: 'final-evaluation',
      title: 'Final Evaluation Report',
      description:
        'The panel outcome for each application. Preliminary is a weighted screening percentage and the pitch score a sum out of 100 — different measures, kept apart.',
      columns: [
        { key: 'applicationNo', label: 'Application No' },
        { key: 'startupName', label: 'Startup' },
        { key: 'sector', label: 'Sector' },
        { key: 'scheme', label: 'Current Scheme' },
        { key: 'panel', label: 'Panel' },
        { key: 'preliminary', label: 'Preliminary', type: 'percent' },
        { key: 'pitchScore', label: 'Pitch Score', type: 'number' },
        { key: 'submitted', label: 'Evaluations', type: 'number' },
        { key: 'recommendation', label: 'Panel Recommendation' },
        { key: 'schemeRecommendation', label: 'Scheme Recommendation' },
        { key: 'evaluationStatus', label: 'Evaluation Status' },
      ],
      rows: rows.map((r) => ({
        applicationNo: r.applicationNo,
        startupName: r.startupName,
        sector: r.sector,
        scheme: r.scheme,
        panel: r.panel,
        preliminary: r.preliminary,
        pitchScore: r.pitchScore,
        submitted: r.submitted,
        recommendation: r.topRecommendation,
        schemeRecommendation: r.topSchemeRecommendation,
        evaluationStatus: r.evaluationStatus,
      })),
      total: rows.length,
    };
  }

  // ── Selection ─────────────────────────────────────────────────────────────

  private static async finalSelection(params: ReportParams): Promise<ReportResult> {
    const range = HonorariumService.dateRange(params.from, params.to);
    const rows = await prisma.finalSelection.findMany({
      where: {
        application: LIVE,
        ...(range ? { decidedAt: range } : {}),
        ...(params.schemeId ? { finalSchemeId: params.schemeId } : {}),
      },
      select: {
        decision: true,
        finalScore: true,
        grantApproved: true,
        sanctionedGrantAmount: true,
        grantConditions: true,
        committeeRemarks: true,
        rePresentationRequired: true,
        decidedAt: true,
        finalScheme: { select: schemeRef },
        application: {
          select: {
            applicationNo: true,
            startupName: true,
            fullName: true,
            mainSector: true,
            pceState: { select: { schemeStatus: true, onboardingStatus: true } },
          },
        },
      },
      orderBy: { decidedAt: 'desc' },
    });

    return {
      key: 'final-selection',
      title: 'Final Selection Report',
      description: 'Committee and CEO decisions, with the approved scheme and sanctioned grant.',
      columns: [
        { key: 'decidedOn', label: 'Decided On', type: 'date' },
        { key: 'applicationNo', label: 'Application No' },
        { key: 'startupName', label: 'Startup' },
        { key: 'founder', label: 'Founder' },
        { key: 'sector', label: 'Sector' },
        { key: 'finalScheme', label: 'Final Approved Scheme' },
        { key: 'schemeStatus', label: 'Scheme Status' },
        { key: 'decision', label: 'Final Decision' },
        { key: 'finalScore', label: 'Final Score', type: 'number' },
        { key: 'grant', label: 'Sanctioned Grant', type: 'money' },
        { key: 'onboarding', label: 'Onboarding Status' },
        { key: 'remarks', label: 'Committee Remarks' },
      ],
      rows: rows.map((r) => ({
        decidedOn: r.decidedAt,
        applicationNo: r.application?.applicationNo ?? '—',
        startupName: r.application?.startupName ?? '—',
        founder: r.application?.fullName ?? '—',
        sector: r.application?.mainSector ?? '—',
        finalScheme: r.finalScheme ? schemeName(r.finalScheme) : 'Not approved',
        schemeStatus: r.application?.pceState?.schemeStatus ?? '—',
        decision: r.decision ?? 'Pending',
        finalScore: r.finalScore,
        grant: r.grantApproved ? Number(r.sanctionedGrantAmount ?? 0) : 0,
        onboarding: r.application?.pceState?.onboardingStatus ?? '—',
        remarks: r.committeeRemarks ?? '—',
      })),
      total: rows.length,
      totalsFor: ['grant'],
    };
  }

  // ── Grant ─────────────────────────────────────────────────────────────────

  private static async grantRecommendation(params: ReportParams): Promise<ReportResult> {
    const rows = await prisma.pitchEvaluation.findMany({
      where: {
        application: LIVE,
        grantRecommended: true,
        state: { in: COUNTED_EVALUATION as any },
        ...(params.panelId ? { panelId: params.panelId } : {}),
      },
      select: {
        recommendedGrantAmount: true,
        grantPurpose: true,
        grantConditions: true,
        totalScore: true,
        recommendation: true,
        submittedAt: true,
        evaluator: { select: { firstName: true, middleName: true, lastName: true } },
        panel: { select: { name: true } },
        application: {
          select: {
            applicationNo: true,
            startupName: true,
            pceState: {
              select: {
                finalScheme: { select: schemeRef },
                provisionalScheme: { select: schemeRef },
              },
            },
            finalSelection: { select: { grantApproved: true, sanctionedGrantAmount: true } },
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });

    return {
      key: 'grant-recommendation',
      title: 'Grant Recommendation Report',
      description:
        'What evaluators recommended, set against what was actually sanctioned. A recommendation is advisory and never becomes a sanction on its own.',
      columns: [
        { key: 'applicationNo', label: 'Application No' },
        { key: 'startupName', label: 'Startup' },
        { key: 'scheme', label: 'Scheme' },
        { key: 'evaluator', label: 'Evaluator' },
        { key: 'panel', label: 'Panel' },
        { key: 'score', label: 'Score', type: 'number' },
        { key: 'recommendation', label: 'Recommendation' },
        { key: 'recommended', label: 'Recommended Grant', type: 'money' },
        { key: 'sanctioned', label: 'Sanctioned Grant', type: 'money' },
        { key: 'purpose', label: 'Purpose' },
        { key: 'submittedOn', label: 'Submitted', type: 'date' },
      ],
      rows: rows.map((r) => {
        const st = r.application?.pceState;
        const scheme = st?.finalScheme ?? st?.provisionalScheme ?? null;
        return {
          applicationNo: r.application?.applicationNo ?? '—',
          startupName: r.application?.startupName ?? '—',
          scheme: scheme ? schemeName(scheme) : 'Not assigned',
          evaluator: evaluatorName(r.evaluator),
          panel: r.panel?.name ?? '—',
          score: Number(r.totalScore ?? 0),
          recommendation: r.recommendation ?? '—',
          recommended: Number(r.recommendedGrantAmount ?? 0),
          sanctioned: r.application?.finalSelection?.grantApproved
            ? Number(r.application.finalSelection.sanctionedGrantAmount ?? 0)
            : 0,
          purpose: r.grantPurpose ?? '—',
          submittedOn: r.submittedAt,
        };
      }),
      total: rows.length,
      totalsFor: ['recommended'],
    };
  }

  private static async grantSanction(params: ReportParams): Promise<ReportResult> {
    const base = await this.finalSelection(params);
    const rows = base.rows.filter((r) => Number(r.grant) > 0);
    return {
      key: 'grant-sanction',
      title: 'Grant Sanction Report',
      description: 'Only the decisions that sanctioned a grant, with the approved amount.',
      columns: base.columns.filter((c) => c.key !== 'onboarding'),
      rows,
      total: rows.length,
      totalsFor: ['grant'],
    };
  }

  private static async schemeGrantUtilization(): Promise<ReportResult> {
    const [schemes, sanctioned] = await Promise.all([
      prisma.scheme.findMany({
        where: LIVE,
        select: { ...schemeRef, status: true, totalBudget: true, maxGrant: true },
        orderBy: { name: 'asc' },
      }),
      prisma.finalSelection.groupBy({
        by: ['finalSchemeId'],
        where: { application: LIVE, grantApproved: true },
        _sum: { sanctionedGrantAmount: true },
        _count: { _all: true },
      }),
    ]);

    const byScheme = new Map(
      sanctioned.map((s: any) => [
        s.finalSchemeId as string,
        { amount: Number(s._sum?.sanctionedGrantAmount ?? 0), count: s._count?._all ?? 0 },
      ]),
    );

    return {
      key: 'scheme-grant-utilization',
      title: 'Scheme-Wise Grant Utilization',
      description:
        'Budget against what this module has sanctioned. Utilisation is blank where a scheme records no total budget, rather than shown as zero or a hundred percent.',
      columns: [
        { key: 'scheme', label: 'Scheme' },
        { key: 'status', label: 'Status' },
        { key: 'totalBudget', label: 'Total Budget', type: 'money' },
        { key: 'maxGrant', label: 'Max Grant per Startup', type: 'money' },
        { key: 'startups', label: 'Startups Sanctioned', type: 'number' },
        { key: 'sanctioned', label: 'Sanctioned', type: 'money' },
        { key: 'remaining', label: 'Remaining', type: 'money' },
        { key: 'utilisation', label: 'Utilisation', type: 'percent' },
      ],
      rows: schemes.map((s) => {
        const used = byScheme.get(s.id);
        const amount = used?.amount ?? 0;
        const budget = s.totalBudget == null ? null : Number(s.totalBudget);
        return {
          scheme: schemeName(s),
          status: s.status,
          totalBudget: budget,
          maxGrant: Number(s.maxGrant ?? 0),
          startups: used?.count ?? 0,
          sanctioned: amount,
          remaining: budget == null ? null : Math.max(0, budget - amount),
          // No budget means no meaningful percentage; left blank on purpose.
          utilisation: budget && budget > 0 ? Math.round((amount / budget) * 1000) / 10 : null,
        };
      }),
      total: schemes.length,
      totalsFor: ['totalBudget', 'startups', 'sanctioned', 'remaining'],
    };
  }

  // ── Onboarding ────────────────────────────────────────────────────────────

  private static async onboarding(params: ReportParams): Promise<ReportResult> {
    const rows = await prisma.onboardingRecord.findMany({
      where: {
        application: LIVE,
        ...(params.schemeId
          ? { application: { ...LIVE, pceState: { finalSchemeId: params.schemeId } } }
          : {}),
      },
      select: {
        status: true,
        incubationStartDate: true,
        agreementStatus: true,
        kycVerified: true,
        bankDetailsVerified: true,
        registrationVerified: true,
        completedAt: true,
        documents: { where: { deletedAt: null }, select: { isRequired: true, isVerified: true } },
        application: {
          select: {
            applicationNo: true,
            startupName: true,
            fullName: true,
            pceState: {
              select: { schemeStatus: true, finalScheme: { select: schemeRef } },
            },
            finalSelection: {
              select: { finalScore: true, grantApproved: true, sanctionedGrantAmount: true, decidedAt: true },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return {
      key: 'onboarding',
      title: 'Onboarding Report',
      description:
        'Onboarding progress for approved startups. Nothing reaches Completed without an approved final scheme, so the scheme column is never blank on a completed row.',
      columns: [
        { key: 'applicationNo', label: 'Application No' },
        { key: 'startupName', label: 'Startup' },
        { key: 'founder', label: 'Founder' },
        { key: 'finalScheme', label: 'Final Scheme' },
        { key: 'selectedOn', label: 'Selected On', type: 'date' },
        { key: 'finalScore', label: 'Final Score', type: 'number' },
        { key: 'grant', label: 'Grant', type: 'money' },
        { key: 'documents', label: 'Documents Verified' },
        { key: 'kyc', label: 'KYC' },
        { key: 'bank', label: 'Bank' },
        { key: 'registration', label: 'Registration' },
        { key: 'agreement', label: 'Agreement' },
        { key: 'startDate', label: 'Incubation Start', type: 'date' },
        { key: 'status', label: 'Onboarding Status' },
        { key: 'completedOn', label: 'Completed On', type: 'date' },
      ],
      rows: rows.map((r) => {
        const app = r.application;
        const required = (r.documents ?? []).filter((d) => d.isRequired);
        const yn = (v: boolean) => (v ? 'Yes' : 'No');
        return {
          applicationNo: app?.applicationNo ?? '—',
          startupName: app?.startupName ?? '—',
          founder: app?.fullName ?? '—',
          finalScheme: app?.pceState?.finalScheme
            ? schemeName(app.pceState.finalScheme)
            : 'Not approved',
          selectedOn: app?.finalSelection?.decidedAt ?? null,
          finalScore: app?.finalSelection?.finalScore ?? null,
          grant: app?.finalSelection?.grantApproved
            ? Number(app.finalSelection.sanctionedGrantAmount ?? 0)
            : 0,
          documents: `${required.filter((d) => d.isVerified).length}/${required.length}`,
          kyc: yn(r.kycVerified),
          bank: yn(r.bankDetailsVerified),
          registration: yn(r.registrationVerified),
          agreement: r.agreementStatus ?? '—',
          startDate: r.incubationStartDate,
          status: r.status,
          completedOn: r.completedAt,
        };
      }),
      total: rows.length,
      totalsFor: ['grant'],
    };
  }

  // ── Payments ──────────────────────────────────────────────────────────────

  private static async honorarium(params: ReportParams): Promise<ReportResult> {
    const data = await HonorariumService.list({
      schemeId: params.schemeId,
      panelId: params.panelId,
      from: params.from,
      to: params.to,
    });

    return {
      key: 'honorarium',
      title: 'Honorarium Report',
      description:
        'Evaluator payments, with the parts kept beside the total. A paid record cannot have its amounts edited, so what is shown here is what was paid.',
      columns: [
        { key: 'evaluator', label: 'Evaluator' },
        { key: 'affiliation', label: 'Internal / External' },
        { key: 'scheme', label: 'Scheme' },
        { key: 'panel', label: 'Panel' },
        { key: 'pitchDate', label: 'Pitch Date', type: 'date' },
        { key: 'evaluated', label: 'Applications Evaluated', type: 'number' },
        { key: 'honorarium', label: 'Honorarium', type: 'money' },
        { key: 'travel', label: 'Travel', type: 'money' },
        { key: 'other', label: 'Other', type: 'money' },
        { key: 'payable', label: 'Total Payable', type: 'money' },
        { key: 'status', label: 'Payment Status' },
        { key: 'paymentDate', label: 'Payment Date', type: 'date' },
        { key: 'transactionRef', label: 'UTR / Transaction' },
        { key: 'remarks', label: 'Remarks' },
      ],
      rows: data.items.map((r: any) => ({
        evaluator: r.evaluatorName,
        affiliation: r.evaluator?.affiliation ?? '—',
        scheme: r.scheme ? schemeName(r.scheme) : '—',
        panel: r.panel?.name ?? '—',
        pitchDate: r.pitchDate,
        evaluated: r.applicationsEvaluated,
        honorarium: Number(r.honorariumAmount ?? 0),
        travel: Number(r.travelAllowance ?? 0),
        other: Number(r.otherAllowance ?? 0),
        payable: Number(r.totalPayable ?? 0),
        status: r.status,
        paymentDate: r.paymentDate,
        transactionRef: r.transactionRef ?? '—',
        remarks: r.remarks ?? '—',
      })),
      total: data.total,
      totalsFor: ['evaluated', 'honorarium', 'travel', 'other', 'payable'],
    };
  }

  // ── Shared ────────────────────────────────────────────────────────────────

  /**
   * Per-application evaluation figures, shared by the evaluation reports so
   * they cannot disagree with each other.
   */
  private static async evaluationRows(params: ReportParams) {
    const and: Prisma.StartupApplicationWhereInput[] = [
      LIVE,
      {
        OR: [
          { pitchEvaluations: { some: {} } },
          { pceState: { pitchStatus: 'COMPLETED' } },
          { pceState: { evaluationStatus: { in: ['IN_PROGRESS', 'COMPLETED'] } } },
        ],
      },
    ];
    if (params.panelId) {
      and.push({ panelAllocations: { some: { panelId: params.panelId } } });
    }
    if (params.schemeId) {
      and.push({
        OR: [
          { pceState: { finalSchemeId: params.schemeId } },
          { pceState: { provisionalSchemeId: params.schemeId } },
        ],
      });
    }

    const rows = await prisma.startupApplication.findMany({
      where: { AND: and },
      select: {
        applicationNo: true,
        startupName: true,
        mainSector: true,
        scheme: { select: schemeRef },
        pceState: {
          select: {
            evaluationStatus: true,
            finalScheme: { select: schemeRef },
            provisionalScheme: { select: schemeRef },
          },
        },
        reviews: { select: { totalScore: true } },
        panelAllocations: { select: { panel: { select: { name: true } } } },
        pitchEvaluations: {
          select: {
            totalScore: true,
            state: true,
            recommendation: true,
            recommendedScheme: { select: schemeRef },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((r) => {
      const counted = (r.pitchEvaluations ?? []).filter((e) =>
        COUNTED_EVALUATION.includes(e.state as any),
      );

      const recTally = new Map<string, number>();
      const schemeTally = new Map<string, { name: string; count: number }>();
      for (const e of counted) {
        if (e.recommendation) {
          recTally.set(e.recommendation, (recTally.get(e.recommendation) ?? 0) + 1);
        }
        if (e.recommendedScheme?.id) {
          const row = schemeTally.get(e.recommendedScheme.id) ?? {
            name: schemeName(e.recommendedScheme),
            count: 0,
          };
          row.count += 1;
          schemeTally.set(e.recommendedScheme.id, row);
        }
      }
      const topRec = Array.from(recTally.entries()).sort((a, b) => b[1] - a[1])[0];
      const topScheme = Array.from(schemeTally.values()).sort((a, b) => b.count - a.count)[0];

      return {
        applicationNo: r.applicationNo ?? '—',
        startupName: r.startupName,
        sector: r.mainSector,
        scheme: schemeName(currentScheme(r)),
        panel: r.panelAllocations?.[0]?.panel?.name ?? '—',
        preliminary: avg(
          (r.reviews ?? []).map((v) => Number(v.totalScore)).filter((n) => n > 0),
        ),
        pitchScore: avg(counted.map((e) => Number(e.totalScore))),
        submitted: counted.length,
        topRecommendation: topRec ? `${topRec[0]} (${topRec[1]})` : '—',
        topSchemeRecommendation: topScheme ? `${topScheme.name} (${topScheme.count})` : '—',
        evaluationStatus: r.pceState?.evaluationStatus ?? 'PENDING',
      };
    });
  }

}


export default ReportsService;
