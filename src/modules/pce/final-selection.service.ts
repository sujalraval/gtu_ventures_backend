import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { BadRequestError, NotFoundError } from '../../common/utils/apiError';
import { PceService } from './pce.service';
import { SchemeAssignmentService } from './scheme-assignment.service';
import { EvaluationsService } from './evaluations.service';
import { OnboardingService } from './onboarding.service';
import { LIVE, APPROVED_DECISIONS } from './pce.constants';

/**
 * Sections 29 and 30: confirming the final scheme, and the committee decision.
 *
 * Scheme confirmation does not write the state row itself. It delegates to
 * SchemeAssignmentService - assign() when the committee is confirming the
 * scheme already in force, changeScheme() when they are picking a different
 * one, which requires a reason. That keeps one write path for every scheme
 * change in the module, so SchemeAssignmentHistory stays a complete record and
 * section 29's "any further change requires authorised reassignment with a
 * reason" holds here too.
 *
 * An approving decision requires the final scheme to be approved first.
 * Section 29 puts confirmation before final selection, and the spec's closing
 * objective is explicit that nothing completes onboarding without a recorded
 * final scheme - so the ordering is enforced rather than left to the operator.
 */

const APPROVED = new Set<string>(APPROVED_DECISIONS);

/** Decisions that end the journey without an incubation offer. */
const NON_APPROVING = new Set([
  'RE_PRESENTATION_REQUIRED',
  'WAITLISTED',
  'REJECTED',
]);

const schemeRef = { id: true, name: true, code: true } as const;

export class FinalSelectionService {
  /**
   * Section 30: applications at the decision stage.
   *
   * Everything whose pitch is done or whose evaluation has started, so the
   * committee sees what is coming as well as what is ready.
   */
  static async list(params: {
    search?: string;
    schemeId?: string;
    decision?: string;
    schemeStatus?: string;
    evaluationStatus?: string;
  }) {
    const and: Prisma.StartupApplicationWhereInput[] = [
      LIVE,
      {
        OR: [
          { pitchEvaluations: { some: {} } },
          { pceState: { pitchStatus: 'COMPLETED' } },
          { pceState: { evaluationStatus: { in: ['IN_PROGRESS', 'COMPLETED'] } } },
          { finalSelection: { isNot: null } },
        ],
      },
    ];

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
    if (params.schemeStatus?.trim()) {
      and.push({ pceState: { schemeStatus: params.schemeStatus.trim() as any } });
    }
    if (params.evaluationStatus?.trim()) {
      and.push({ pceState: { evaluationStatus: params.evaluationStatus.trim() as any } });
    }
    if (params.decision?.trim()) {
      const v = params.decision.trim();
      if (v === 'PENDING') {
        and.push({
          OR: [{ finalSelection: { is: null } }, { finalSelection: { decision: null } }],
        });
      } else if (v === 'APPROVED_ANY') {
        and.push({ finalSelection: { decision: { in: APPROVED_DECISIONS as any } } });
      } else {
        and.push({ finalSelection: { decision: v as any } });
      }
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

    const rows = await prisma.startupApplication.findMany({
      where: { AND: and },
      select: {
        id: true,
        applicationNo: true,
        startupName: true,
        fullName: true,
        mainSector: true,
        scheme: { select: schemeRef },
        pceState: {
          select: {
            schemeStatus: true,
            pitchStatus: true,
            evaluationStatus: true,
            onboardingStatus: true,
            schemeApprovedBy: true,
            schemeApprovedAt: true,
            provisionalScheme: { select: schemeRef },
            finalScheme: { select: schemeRef },
          },
        },
        finalSelection: {
          select: {
            id: true,
            decision: true,
            finalScore: true,
            grantApproved: true,
            sanctionedGrantAmount: true,
            rePresentationRequired: true,
            committeeRemarks: true,
            grantConditions: true,
            decidedBy: true,
            decidedAt: true,
            finalScheme: { select: schemeRef },
          },
        },
        onboarding: { select: { status: true } },
        reviews: { select: { totalScore: true } },
        pitchEvaluations: {
          select: { totalScore: true, state: true, recommendation: true },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    const actorIds = rows
      .flatMap((r) => [r.finalSelection?.decidedBy, r.pceState?.schemeApprovedBy])
      .filter((v): v is string => !!v);
    const actors = await this.resolveActors(actorIds);

    return {
      items: rows.map((r) => {
        const counted = (r.pitchEvaluations ?? []).filter(
          (e) => e.state === 'SUBMITTED' || e.state === 'LOCKED',
        );
        return {
          id: r.id,
          applicationNo: r.applicationNo,
          startupName: r.startupName,
          fullName: r.fullName,
          mainSector: r.mainSector,
          currentScheme:
            r.pceState?.finalScheme ?? r.pceState?.provisionalScheme ?? r.scheme ?? null,
          isSchemeFinalised: r.pceState?.schemeStatus === 'FINAL_APPROVED',
          pceState: r.pceState,
          finalSelection: r.finalSelection,
          onboardingStatus: r.onboarding?.status ?? r.pceState?.onboardingStatus ?? 'NOT_STARTED',
          preliminaryScore: this.average(
            (r.reviews ?? []).map((v) => Number(v.totalScore)).filter((n) => n > 0),
          ),
          pitchScore: this.average(counted.map((e) => Number(e.totalScore))),
          evaluationCount: counted.length,
          decidedByName: r.finalSelection?.decidedBy
            ? actors.get(r.finalSelection.decidedBy) ?? 'Unknown user'
            : null,
          schemeApprovedByName: r.pceState?.schemeApprovedBy
            ? actors.get(r.pceState.schemeApprovedBy) ?? 'Unknown user'
            : null,
        };
      }),
      total: rows.length,
    };
  }

  /**
   * Section 29: everything the committee needs to confirm a scheme.
   *
   * The available schemes carry their own eligibility verdict and remaining
   * budget, so the choice is made against the facts rather than from a bare
   * dropdown.
   */
  static async confirmationContext(applicationId: string) {
    const application = await prisma.startupApplication.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        applicationNo: true,
        startupName: true,
        fullName: true,
        mainSector: true,
        subSectors: true,
        scheme: { select: schemeRef },
        pceState: {
          select: {
            schemeStatus: true,
            eligibilityVerdict: true,
            schemeRemarks: true,
            schemeApprovedBy: true,
            schemeApprovedAt: true,
            provisionalScheme: { select: schemeRef },
            finalScheme: { select: schemeRef },
          },
        },
        finalSelection: { select: { decision: true, sanctionedGrantAmount: true } },
      },
    });
    if (!application) throw new NotFoundError('Application not found');

    // Section 26's panel figures, reused rather than recomputed differently.
    const evaluationView = await EvaluationsService.forApplication(applicationId);

    const schemes = await prisma.scheme.findMany({
      where: { ...LIVE, status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        code: true,
        maxGrant: true,
        totalBudget: true,
        sectors: true,
        eligibility: true,
      },
      orderBy: { name: 'asc' },
    });

    // Grant availability per scheme: what this module has already sanctioned
    // against each, set beside the scheme's own budget.
    const sanctioned = await prisma.finalSelection.groupBy({
      by: ['finalSchemeId'],
      where: { application: LIVE, grantApproved: true },
      _sum: { sanctionedGrantAmount: true },
    });
    const sanctionedBy = new Map(
      sanctioned.map((s: any) => [s.finalSchemeId as string, Number(s._sum?.sanctionedGrantAmount ?? 0)]),
    );

    const appSectors = [application.mainSector, ...(application.subSectors ?? [])]
      .map((s) => String(s ?? '').trim().toLowerCase())
      .filter(Boolean);

    return {
      application: {
        ...application,
        currentScheme:
          application.pceState?.finalScheme ??
          application.pceState?.provisionalScheme ??
          application.scheme ??
          null,
        isSchemeFinalised: application.pceState?.schemeStatus === 'FINAL_APPROVED',
      },
      /** Section 29: what the evaluators put forward, and the panel's view. */
      evaluatorSchemeRecommendations: evaluationView.summary.schemeRecommendations,
      panelRecommendations: evaluationView.summary.recommendations,
      panelScore: evaluationView.summary.averagePanelScore,
      preliminaryScore: evaluationView.application.preliminaryScore,
      averageRecommendedGrant: evaluationView.summary.averageRecommendedGrant,
      availableSchemes: schemes.map((s) => {
        const used = sanctionedBy.get(s.id) ?? 0;
        const schemeSectors = (s.sectors ?? []).map((x) => String(x).trim().toLowerCase());
        return {
          ...s,
          /**
           * A quick sector signal only. The full check, with the override
           * rules, is the eligibility endpoint in scheme assignment.
           */
          sectorMatch: schemeSectors.length === 0 || appSectors.some((x) => schemeSectors.includes(x)),
          hasWrittenCriteria: !!s.eligibility?.trim(),
          sanctionedSoFar: used,
          remainingBudget:
            s.totalBudget != null ? Math.max(0, Number(s.totalBudget) - used) : null,
        };
      }),
    };
  }

  /**
   * Section 29: record the final approved scheme.
   *
   * Delegated so the history is written the same way as every other scheme
   * change. Confirming the scheme already in force is an assignment at
   * FINAL_APPROVE; choosing a different one is a change, which needs a reason.
   */
  static async confirmScheme(
    input: { applicationId: string; schemeId: string; reason?: string | null; remarks?: string | null },
    actorId: string,
  ) {
    const state = await prisma.applicationPceState.findUnique({
      where: { applicationId: input.applicationId },
      select: { provisionalSchemeId: true, finalSchemeId: true, schemeStatus: true },
    });

    const current = state?.finalSchemeId ?? state?.provisionalSchemeId ?? null;
    const isSwitch = !!current && current !== input.schemeId;

    if (isSwitch) {
      if (!input.reason?.trim()) {
        throw new BadRequestError(
          'This application already has a scheme. Approving a different one is a reassignment and needs a reason.',
        );
      }
      await SchemeAssignmentService.changeScheme(
        {
          applicationIds: [input.applicationId],
          schemeId: input.schemeId,
          reason: input.reason.trim(),
          remarks: input.remarks ?? null,
          asFinal: true,
        },
        actorId,
      );
      // changeScheme records CHANGED; section 29 wants the end state to say the
      // final scheme is approved, so it is confirmed immediately after.
      await SchemeAssignmentService.assign(
        {
          applicationIds: [input.applicationId],
          schemeId: input.schemeId,
          mode: 'FINAL_APPROVE',
          remarks: input.remarks ?? null,
        },
        actorId,
      );
    } else {
      await SchemeAssignmentService.assign(
        {
          applicationIds: [input.applicationId],
          schemeId: input.schemeId,
          mode: 'FINAL_APPROVE',
          remarks: input.remarks ?? null,
        },
        actorId,
      );
    }

    const updated = await prisma.applicationPceState.findUnique({
      where: { applicationId: input.applicationId },
      select: {
        schemeStatus: true,
        schemeApprovedAt: true,
        finalScheme: { select: schemeRef },
      },
    });

    // Section 29's own guard: if the delegation did not land on the approved
    // state, say so rather than reporting success.
    if (updated?.schemeStatus !== 'FINAL_APPROVED') {
      throw new BadRequestError(
        'The scheme could not be approved. Check whether it is already assigned elsewhere, then try again.',
      );
    }

    // Keep FinalSelection's own copy in step, so the decision row and the
    // state row cannot name different schemes.
    await prisma.finalSelection.upsert({
      where: { applicationId: input.applicationId },
      create: { applicationId: input.applicationId, finalSchemeId: input.schemeId },
      update: { finalSchemeId: input.schemeId },
    });

    return updated;
  }

  /** Section 30: the committee or CEO decision. */
  static async recordDecision(
    input: {
      applicationId: string;
      decision: string;
      committeeRemarks?: string | null;
      finalScore?: number | null;
      grantApproved?: boolean;
      sanctionedGrantAmount?: number | null;
      grantConditions?: string | null;
      rePresentationRequired?: boolean;
    },
    actorId: string,
  ) {
    const application = await prisma.startupApplication.findUnique({
      where: { id: input.applicationId },
      select: {
        id: true,
        pceState: {
          select: { schemeStatus: true, finalSchemeId: true, provisionalSchemeId: true },
        },
      },
    });
    if (!application) throw new NotFoundError('Application not found');

    const state = application.pceState;
    const approving = APPROVED.has(input.decision);

    // Section 29 puts scheme confirmation before final selection, and nothing
    // completes onboarding without it - so an approval cannot be recorded
    // against an unconfirmed scheme.
    if (approving && state?.schemeStatus !== 'FINAL_APPROVED') {
      throw new BadRequestError(
        'Confirm the final scheme before approving this application. An approved application must have a recorded final scheme.',
      );
    }

    if (input.grantApproved && !(Number(input.sanctionedGrantAmount) > 0)) {
      throw new BadRequestError('A sanctioned grant amount is required when a grant is approved');
    }

    // The per-startup ceiling is the scheme's own maximum.
    if (input.grantApproved && state?.finalSchemeId) {
      const scheme = await prisma.scheme.findUnique({
        where: { id: state.finalSchemeId },
        select: { name: true, maxGrant: true },
      });
      const cap = Number(scheme?.maxGrant ?? 0);
      if (cap > 0 && Number(input.sanctionedGrantAmount) > cap) {
        throw new BadRequestError(
          `The sanctioned amount exceeds the maximum grant for ${scheme?.name} (${cap}).`,
        );
      }
    }

    const now = new Date();
    const decision = await prisma.finalSelection.upsert({
      where: { applicationId: input.applicationId },
      create: {
        applicationId: input.applicationId,
        finalSchemeId: state?.finalSchemeId ?? null,
        decision: input.decision as any,
        committeeRemarks: input.committeeRemarks ?? null,
        finalScore: input.finalScore ?? null,
        grantApproved: !!input.grantApproved,
        sanctionedGrantAmount: input.grantApproved
          ? Number(input.sanctionedGrantAmount) || null
          : null,
        grantConditions: input.grantApproved ? (input.grantConditions ?? null) : null,
        rePresentationRequired:
          input.rePresentationRequired ?? input.decision === 'RE_PRESENTATION_REQUIRED',
        decidedBy: actorId,
        decidedAt: now,
      },
      update: {
        finalSchemeId: state?.finalSchemeId ?? undefined,
        decision: input.decision as any,
        committeeRemarks: input.committeeRemarks ?? null,
        finalScore: input.finalScore ?? null,
        grantApproved: !!input.grantApproved,
        sanctionedGrantAmount: input.grantApproved
          ? Number(input.sanctionedGrantAmount) || null
          : null,
        grantConditions: input.grantApproved ? (input.grantConditions ?? null) : null,
        rePresentationRequired:
          input.rePresentationRequired ?? input.decision === 'RE_PRESENTATION_REQUIRED',
        decidedBy: actorId,
        decidedAt: now,
      },
      select: { id: true, decision: true, decidedAt: true },
    });

    await PceService.ensureState(input.applicationId);

    // An approved application moves into onboarding; a non-approving decision
    // stops it, and its onboarding record is left alone rather than reset -
    // the history of what was done stays readable.
    //
    // Delegated to OnboardingService.start rather than creating the row here,
    // because start also seeds the document checklist from the approved
    // scheme's own requiredDocuments. Creating the row directly would leave
    // every onboarding with an empty checklist.
    if (approving) {
      await OnboardingService.start(input.applicationId);
    }

    return decision;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private static average(values: number[]): number | null {
    const usable = values.filter((n) => Number.isFinite(n));
    if (usable.length === 0) return null;
    return Math.round((usable.reduce((a, b) => a + b, 0) / usable.length) * 10) / 10;
  }

  private static async resolveActors(ids: string[]) {
    const unique = Array.from(new Set(ids));
    if (unique.length === 0) return new Map<string, string>();
    const users = await prisma.user.findMany({
      where: { id: { in: unique } },
      select: { id: true, name: true, email: true },
    });
    return new Map(users.map((u) => [u.id, u.name?.trim() || u.email || 'Unknown user']));
  }
}

export default FinalSelectionService;
