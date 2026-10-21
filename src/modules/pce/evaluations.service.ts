import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../common/utils/apiError';
import { PceService } from './pce.service';
import { LIVE } from './pce.constants';

/**
 * Sections 16, 22-28: pitch evaluation.
 *
 * The seven criteria and their maximums are fixed by section 22 and sum to
 * 100, so the total is a plain sum with no weighting - unlike the screening
 * scores in ApplicationReview, which are weighted percentages. The two live
 * side by side and section 28 shows both; neither is derived from the other.
 *
 * Three things an evaluator records are explicitly advisory, and nothing here
 * acts on them: a recommended scheme (section 24) does not change the assigned
 * scheme, a recommended grant (section 25) does not become a sanction, and a
 * recommendation (section 23) does not decide the application. They are
 * surfaced to the Final Committee, which decides in phase 6.
 */

/** Section 22, fixed: seven criteria, 20/20/20/20/10/5/5 = 100. */
const CRITERIA = [
  { key: 'needOfInnovation', label: 'Need of Innovation', max: 20 },
  { key: 'feasibility', label: 'Feasibility', max: 20 },
  { key: 'potentialImpact', label: 'Potential Impact', max: 20 },
  { key: 'novelty', label: 'Novelty', max: 20 },
  { key: 'team', label: 'Team', max: 10 },
  { key: 'fundUtilization', label: 'Fund Utilization Plan', max: 5 },
  { key: 'presentation', label: 'Presentation', max: 5 },
] as const;

export const PITCH_TOTAL_MARKS = CRITERIA.reduce((n, c) => n + c.max, 0);

const scoreField = (key: string) => `${key}Score`;

/** States in which an evaluation counts towards the panel's figures. */
const COUNTED = ['SUBMITTED', 'LOCKED'] as const;

/** An evaluation an evaluator may still edit. */
const EDITABLE = ['DRAFT', 'REOPENED'] as const;

/**
 * Marks clamped to each criterion's maximum, and their sum.
 *
 * Clamped here rather than trusted from the request: a 20 typed into Team,
 * which is out of 10, would otherwise put the total over 100 and quietly
 * break every average built on it.
 */
const normaliseScores = (input: Record<string, any>) => {
  const out: Record<string, number> = {};
  let total = 0;
  for (const c of CRITERIA) {
    const raw = Number(input[scoreField(c.key)] ?? input[c.key] ?? 0);
    const safe = Number.isFinite(raw) ? Math.max(0, Math.min(raw, c.max)) : 0;
    out[scoreField(c.key)] = safe;
    total += safe;
  }
  return { scores: out, total: Math.round(total * 100) / 100 };
};

const evaluatorName = (e: any) =>
  [e?.firstName, e?.middleName, e?.lastName].filter(Boolean).join(' ').trim() || '—';

const evaluationSelect = {
  id: true,
  applicationId: true,
  evaluatorId: true,
  panelId: true,
  scheduleId: true,
  needOfInnovationScore: true,
  feasibilityScore: true,
  potentialImpactScore: true,
  noveltyScore: true,
  teamScore: true,
  fundUtilizationScore: true,
  presentationScore: true,
  totalScore: true,
  criteriaRemarks: true,
  recommendation: true,
  strengths: true,
  weaknesses: true,
  risks: true,
  suggestions: true,
  conditions: true,
  finalNote: true,
  remarks: true,
  recommendedSchemeId: true,
  alternativeSchemeId: true,
  schemeRecommendationRemarks: true,
  grantRecommended: true,
  recommendedGrantAmount: true,
  grantPurpose: true,
  fundUtilizationRemarks: true,
  grantConditions: true,
  state: true,
  submittedAt: true,
  lockedAt: true,
  reopenReason: true,
  reopenedBy: true,
  reopenedAt: true,
  revision: true,
  createdAt: true,
  updatedAt: true,
  evaluator: {
    select: {
      id: true,
      firstName: true,
      middleName: true,
      lastName: true,
      affiliation: true,
      type: true,
      organization: true,
      designation: true,
    },
  },
  panel: { select: { id: true, name: true } },
  recommendedScheme: { select: { id: true, name: true, code: true } },
  alternativeScheme: { select: { id: true, name: true, code: true } },
} satisfies Prisma.PitchEvaluationSelect;

export class EvaluationsService {
  /** The criteria definition, so the form is driven by the server's own list. */
  static criteria() {
    return { criteria: CRITERIA, totalMarks: PITCH_TOTAL_MARKS };
  }

  // ── Section 16: the evaluator's own view ──────────────────────────────────

  /**
   * The Evaluator record behind a logged-in user.
   *
   * Authorisation for the portal is "your user is linked to an evaluator",
   * not a role: an internal expert who already has an admin login should be
   * able to evaluate without a second account.
   */
  static async resolveEvaluator(userId: string) {
    const evaluator = await prisma.evaluator.findFirst({
      where: { userId, deletedAt: null },
      select: { id: true, firstName: true, middleName: true, lastName: true, status: true },
    });
    if (!evaluator) {
      throw new ForbiddenError(
        'Your account is not linked to an evaluator record, so there is nothing to evaluate.',
      );
    }
    if (evaluator.status !== 'ACTIVE') {
      throw new ForbiddenError('This evaluator record is not active.');
    }
    return evaluator;
  }

  /**
   * Section 16: only the applications allocated to this evaluator's panels.
   *
   * Reached through PanelMember -> panel -> PanelApplication, which is the
   * only path. An application not allocated to a panel they sit on is not
   * visible to them at all.
   */
  static async myAssignments(userId: string) {
    const evaluator = await this.resolveEvaluator(userId);

    const seats = await prisma.panelMember.findMany({
      where: { evaluatorId: evaluator.id, panel: { deletedAt: null } },
      select: {
        role: true,
        panel: {
          select: {
            id: true,
            name: true,
            status: true,
            pitchDate: true,
            session: true,
            evaluationStage: true,
            scheme: { select: { id: true, name: true, code: true } },
            // The round the spec asks the evaluator's dashboard to show. It
            // belongs to the sitting, so it arrives through the panel.
            pitchingSession: {
              select: {
                id: true,
                name: true,
                round: true,
                presentationDate: true,
                startTime: true,
                endTime: true,
                reportingTime: true,
                mode: true,
                venue: true,
                meetingLink: true,
              },
            },
            allocations: {
              where: { application: LIVE },
              select: {
                application: {
                  select: {
                    id: true,
                    applicationNo: true,
                    startupName: true,
                    fullName: true,
                    mainSector: true,
                    subSectors: true,
                    stage: true,
                    briefAbout: true,
                    problemStmt: true,
                    solution: true,
                    website: true,
                    marketSize: true,
                    revenueModel: true,
                    ipStatus: true,
                    designation: true,
                    highestQualification: true,
                    city: true,
                    state: true,
                    isRegistered: true,
                    legalStatus: true,
                    incorporationDate: true,
                    dpiitRegistered: true,
                    /**
                     * Section 16: documents the panel needs to judge the
                     * application. Deliberately no contact details, Aadhaar,
                     * PAN or CIN - an external jury member scores the venture,
                     * and does not need the founder's personal identifiers to
                     * do it.
                     */
                    pitchDeck: true,
                    registrationCert: true,
                    dpiitCert: true,
                    patentDocs: true,
                    gstCert: true,
                    financialStatements: true,
                    additionalDocs: true,
                    // Co-founders, for the Team criterion. Names and standing
                    // only, for the same reason.
                    formB: {
                      select: {
                        founders: {
                          select: {
                            name: true,
                            designation: true,
                            lastEducation: true,
                            degreeName: true,
                            universityName: true,
                            priorVentures: true,
                            linkedIn: true,
                          },
                        },
                      },
                    },
                    // Section 16 lists the scheme, which may not be decided.
                    scheme: { select: { id: true, name: true, code: true } },
                    pceState: {
                      select: {
                        schemeStatus: true,
                        pitchStatus: true,
                        evaluationStatus: true,
                        provisionalScheme: { select: { id: true, name: true, code: true } },
                        finalScheme: { select: { id: true, name: true, code: true } },
                      },
                    },
                    pitchSchedules: {
                      where: { deletedAt: null, isActive: true, status: { notIn: ['CANCELLED'] } },
                      select: {
                        id: true,
                        presentationDate: true,
                        startTime: true,
                        endTime: true,
                        session: true,
                        mode: true,
                        venue: true,
                        meetingLink: true,
                        status: true,
                      },
                      take: 1,
                      orderBy: { presentationDate: 'desc' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    // One row per application the evaluator can act on, with their own
    // evaluation attached if they have started it.
    const applicationIds = Array.from(
      new Set(
        seats.flatMap((s) => (s.panel?.allocations ?? []).map((a) => a.application.id)),
      ),
    );

    const mine = applicationIds.length
      ? await prisma.pitchEvaluation.findMany({
          where: { evaluatorId: evaluator.id, applicationId: { in: applicationIds } },
          select: evaluationSelect,
        })
      : [];
    const byApplication = new Map(mine.map((m) => [m.applicationId, m]));

    const items = seats.flatMap((seat) =>
      (seat.panel?.allocations ?? []).map((a) => {
        const app = a.application;
        const schedule = app.pitchSchedules?.[0] ?? null;
        // One list rather than seven nullable fields for the portal to probe.
        const documents = [
          ['Pitch Deck', app.pitchDeck],
          ['Registration Certificate', app.registrationCert],
          ['DPIIT Certificate', app.dpiitCert],
          ['Patent Documents', app.patentDocs],
          ['GST Certificate', app.gstCert],
          ['Financial Statements', app.financialStatements],
        ]
          .filter(([, url]) => !!url)
          .map(([label, url]) => ({ label: label as string, url: url as string }));

        return {
          application: {
            ...app,
            pitchSchedules: undefined,
            documents,
            founders: app.formB?.founders ?? [],
            // Section 16: shown as not yet decided rather than defaulting to
            // the scheme applied under, which nobody has chosen for them.
            currentScheme:
              app.pceState?.finalScheme ?? app.pceState?.provisionalScheme ?? null,
            appliedScheme: app.scheme ?? null,
            isSchemeFinalised: app.pceState?.schemeStatus === 'FINAL_APPROVED',
          },
          schedule,
          panel: {
            id: seat.panel.id,
            name: seat.panel.name,
            status: seat.panel.status,
            pitchDate: seat.panel.pitchDate,
            session: seat.panel.session,
            evaluationStage: seat.panel.evaluationStage,
            scheme: seat.panel.scheme,
            round: seat.panel.pitchingSession?.round ?? null,
            sessionName: seat.panel.pitchingSession?.name ?? null,
            myRole: seat.role,
          },
          evaluation: byApplication.get(app.id) ?? null,
        };
      }),
    );

    return {
      evaluator: { id: evaluator.id, name: evaluatorName(evaluator) },
      items,
      total: items.length,
      pendingCount: items.filter(
        (i) => !i.evaluation || EDITABLE.includes(i.evaluation.state as any),
      ).length,
      completedCount: items.filter(
        (i) => i.evaluation && COUNTED.includes(i.evaluation.state as any),
      ).length,
    };
  }

  /** Refuse unless this evaluator may act on this application. */
  private static async assertAllocated(evaluatorId: string, applicationId: string) {
    const seat = await prisma.panelApplication.findFirst({
      where: {
        applicationId,
        panel: { deletedAt: null, members: { some: { evaluatorId } } },
      },
      select: { panelId: true },
    });
    if (!seat) {
      throw new ForbiddenError('This application is not allocated to any of your panels.');
    }
    return seat.panelId;
  }

  // ── Sections 22-25: saving and submitting ─────────────────────────────────

  /**
   * Save without submitting.
   *
   * Scores are recalculated on the server from the clamped marks, so the total
   * on the record is never whatever the client computed.
   */
  static async saveDraft(
    input: {
      applicationId: string;
      /** Admin recording on behalf of an evaluator; otherwise resolved from the user. */
      evaluatorId?: string;
      scheduleId?: string | null;
      [key: string]: any;
    },
    actor: { userId: string; isAdmin: boolean },
  ) {
    const evaluatorId = await this.resolveActingEvaluator(input, actor);
    const panelId = await this.assertAllocated(evaluatorId, input.applicationId);

    const existing = await prisma.pitchEvaluation.findUnique({
      where: {
        applicationId_evaluatorId: {
          applicationId: input.applicationId,
          evaluatorId,
        },
      },
      select: { id: true, state: true },
    });

    // A locked evaluation is reopened by an admin, not edited around.
    if (existing && !EDITABLE.includes(existing.state as any)) {
      throw new BadRequestError(
        'This evaluation has been submitted and locked. An administrator must reopen it before it can be changed.',
      );
    }

    const { scores, total } = normaliseScores(input);
    const data = {
      ...scores,
      totalScore: total,
      criteriaRemarks: input.criteriaRemarks ?? undefined,
      recommendation: input.recommendation ?? null,
      strengths: input.strengths ?? null,
      weaknesses: input.weaknesses ?? null,
      risks: input.risks ?? null,
      suggestions: input.suggestions ?? null,
      conditions: input.conditions ?? null,
      finalNote: input.finalNote ?? null,
      remarks: input.remarks ?? null,
      // Section 24: a recommendation only - nothing here touches the assigned
      // scheme on ApplicationPceState.
      recommendedSchemeId: input.recommendedSchemeId || null,
      alternativeSchemeId: input.alternativeSchemeId || null,
      schemeRecommendationRemarks: input.schemeRecommendationRemarks ?? null,
      // Section 25: likewise advisory, never a sanction.
      grantRecommended: !!input.grantRecommended,
      recommendedGrantAmount: input.grantRecommended
        ? Number(input.recommendedGrantAmount) || null
        : null,
      grantPurpose: input.grantRecommended ? (input.grantPurpose ?? null) : null,
      fundUtilizationRemarks: input.fundUtilizationRemarks ?? null,
      grantConditions: input.grantRecommended ? (input.grantConditions ?? null) : null,
      panelId,
      scheduleId: input.scheduleId || null,
    };

    const saved = existing
      ? await prisma.pitchEvaluation.update({
          where: { id: existing.id },
          data,
          select: evaluationSelect,
        })
      : await prisma.pitchEvaluation.create({
          data: { applicationId: input.applicationId, evaluatorId, state: 'DRAFT', ...data },
          select: evaluationSelect,
        });

    await this.syncApplicationEvaluationStatus(input.applicationId);
    return saved;
  }

  /** Section 27: submit and lock, recording the time. */
  static async submit(
    input: { applicationId: string; evaluatorId?: string; [key: string]: any },
    actor: { userId: string; isAdmin: boolean },
  ) {
    // Saved first, so submit cannot lock a different set of marks from the
    // ones the evaluator is looking at.
    const draft = await this.saveDraft(input, actor);

    if (!draft.recommendation) {
      throw new BadRequestError('A recommendation is required before submitting');
    }

    const now = new Date();
    const submitted = await prisma.pitchEvaluation.update({
      where: { id: draft.id },
      data: { state: 'LOCKED', submittedAt: draft.submittedAt ?? now, lockedAt: now },
      select: evaluationSelect,
    });

    await this.syncApplicationEvaluationStatus(input.applicationId);
    return submitted;
  }

  /**
   * Section 27: reopen a locked evaluation.
   *
   * The current state is snapshotted first, so the scoring as submitted
   * survives being edited. Admin only, and the reason is required.
   */
  static async reopen(evaluationId: string, reason: string, actorId: string) {
    if (!reason?.trim()) {
      throw new BadRequestError('A reason is required to reopen an evaluation');
    }

    const existing = await prisma.pitchEvaluation.findUnique({
      where: { id: evaluationId },
      select: { ...evaluationSelect, applicationId: true },
    });
    if (!existing) throw new NotFoundError('Evaluation not found');
    if (EDITABLE.includes(existing.state as any)) {
      throw new BadRequestError('This evaluation is already open for editing');
    }

    const nextRevision = (existing.revision ?? 1) + 1;

    await prisma.$transaction([
      prisma.pitchEvaluationRevision.create({
        data: {
          evaluationId,
          revision: existing.revision ?? 1,
          // The whole row as it stood, rather than a column-per-field copy.
          snapshot: existing as unknown as Prisma.InputJsonValue,
          reason: reason.trim(),
          createdBy: actorId,
        },
      }),
      prisma.pitchEvaluation.update({
        where: { id: evaluationId },
        data: {
          state: 'REOPENED',
          reopenReason: reason.trim(),
          reopenedBy: actorId,
          reopenedAt: new Date(),
          revision: nextRevision,
          lockedAt: null,
        },
      }),
    ]);

    await this.syncApplicationEvaluationStatus(existing.applicationId);
    return { id: evaluationId, revision: nextRevision };
  }

  static async revisions(evaluationId: string) {
    const rows = await prisma.pitchEvaluationRevision.findMany({
      where: { evaluationId },
      orderBy: { revision: 'desc' },
    });
    return { items: rows, total: rows.length };
  }

  // ── Section 26: one application, every evaluator ──────────────────────────

  static async forApplication(applicationId: string) {
    const application = await prisma.startupApplication.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        applicationNo: true,
        startupName: true,
        fullName: true,
        mainSector: true,
        scheme: { select: { id: true, name: true, code: true } },
        pceState: {
          select: {
            schemeStatus: true,
            pitchStatus: true,
            evaluationStatus: true,
            provisionalScheme: { select: { id: true, name: true, code: true } },
            finalScheme: { select: { id: true, name: true, code: true } },
          },
        },
        reviews: { select: { level: true, totalScore: true } },
        panelAllocations: {
          select: {
            panel: {
              select: {
                id: true,
                name: true,
                members: {
                  select: {
                    role: true,
                    evaluator: {
                      select: { id: true, firstName: true, middleName: true, lastName: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!application) throw new NotFoundError('Application not found');

    const evaluations = await prisma.pitchEvaluation.findMany({
      where: { applicationId },
      select: evaluationSelect,
      orderBy: { createdAt: 'asc' },
    });

    return {
      application: {
        ...application,
        currentScheme:
          application.pceState?.finalScheme ??
          application.pceState?.provisionalScheme ??
          application.scheme ??
          null,
        preliminaryScore: this.averageOf(
          (application.reviews ?? [])
            .map((r) => Number(r.totalScore))
            .filter((n) => Number.isFinite(n) && n > 0),
        ),
      },
      evaluations: evaluations.map((e) => ({ ...e, evaluatorName: evaluatorName(e.evaluator) })),
      summary: this.summarise(evaluations, application.panelAllocations),
    };
  }

  /** Mean to one decimal, or null when there is nothing to average. */
  private static averageOf(values: number[]): number | null {
    if (values.length === 0) return null;
    return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
  }

  /**
   * Section 26's panel figures.
   *
   * Averages cover only submitted and locked evaluations. Including drafts
   * would let a half-filled form drag the panel score down and make the
   * number move as someone types.
   */
  private static summarise(evaluations: any[], allocations?: any[]) {
    const counted = evaluations.filter((e) => COUNTED.includes(e.state));

    // Everyone seated on a panel this application is allocated to is expected
    // to evaluate it; those are the pending ones.
    const expected = new Set<string>();
    (allocations ?? []).forEach((a) =>
      (a.panel?.members ?? []).forEach((m: any) => {
        if (m.evaluator?.id) expected.add(m.evaluator.id);
      }),
    );
    const done = new Set(counted.map((e) => e.evaluatorId));

    const grants = counted
      .filter((e) => e.grantRecommended && Number(e.recommendedGrantAmount) > 0)
      .map((e) => Number(e.recommendedGrantAmount));

    return {
      averagePanelScore: this.averageOf(counted.map((e) => Number(e.totalScore))),
      totalMarks: PITCH_TOTAL_MARKS,
      completedCount: counted.length,
      /** Seated evaluators who have not submitted yet. */
      pendingCount: Math.max(0, expected.size - done.size),
      expectedCount: expected.size,
      /** For reference only; it is not a sanctioned figure. */
      averageRecommendedGrant: this.averageOf(grants),
      grantRecommendedCount: grants.length,
      /** Distinct schemes evaluators put forward, for the committee to weigh. */
      schemeRecommendations: this.tallySchemes(counted),
      recommendations: this.tallyRecommendations(counted),
    };
  }

  /** Which schemes evaluators put forward, most-recommended first. */
  private static tallySchemes(
    counted: any[],
  ): Array<{ scheme: { id: string; name: string; code: string }; count: number }> {
    const byId = new Map<string, { scheme: any; count: number }>();
    for (const e of counted) {
      const s = e.recommendedScheme;
      if (!s?.id) continue;
      const row = byId.get(s.id) ?? { scheme: s, count: 0 };
      row.count += 1;
      byId.set(s.id, row);
    }
    return Array.from(byId.values()).sort((a, b) => b.count - a.count);
  }

  /** How the panel's recommendations split, most-common first. */
  private static tallyRecommendations(
    counted: any[],
  ): Array<{ recommendation: string; count: number }> {
    const byValue = new Map<string, number>();
    for (const e of counted) {
      if (!e.recommendation) continue;
      byValue.set(e.recommendation, (byValue.get(e.recommendation) ?? 0) + 1);
    }
    return Array.from(byValue.entries())
      .map(([recommendation, count]) => ({ recommendation, count }))
      .sort((a, b) => b.count - a.count);
  }

  // ── Section 27: the admin's worklist ──────────────────────────────────────

  static async listForAdmin(params: {
    search?: string;
    panelId?: string;
    state?: string;
    evaluatorId?: string;
    schemeId?: string;
  }) {
    const and: Prisma.PitchEvaluationWhereInput[] = [{ application: LIVE }];

    if (params.panelId?.trim()) and.push({ panelId: params.panelId.trim() });
    if (params.state?.trim()) {
      const v = params.state.trim();
      if (v === 'PENDING') and.push({ state: { in: EDITABLE as any } });
      else if (v === 'COMPLETED') and.push({ state: { in: COUNTED as any } });
      else and.push({ state: v as any });
    }
    if (params.evaluatorId?.trim()) and.push({ evaluatorId: params.evaluatorId.trim() });
    if (params.search?.trim()) {
      const q = params.search.trim();
      and.push({
        application: {
          ...LIVE,
          OR: [
            { applicationNo: { contains: q, mode: 'insensitive' } },
            { startupName: { contains: q, mode: 'insensitive' } },
          ],
        },
      });
    }

    const rows = await prisma.pitchEvaluation.findMany({
      where: { AND: and },
      select: {
        ...evaluationSelect,
        application: {
          select: {
            id: true,
            applicationNo: true,
            startupName: true,
            mainSector: true,
            pceState: { select: { evaluationStatus: true, pitchStatus: true } },
          },
        },
      },
      orderBy: [{ updatedAt: 'desc' }],
    });

    return {
      items: rows.map((r) => ({ ...r, evaluatorName: evaluatorName(r.evaluator) })),
      total: rows.length,
      completedCount: rows.filter((r) => COUNTED.includes(r.state as any)).length,
      pendingCount: rows.filter((r) => EDITABLE.includes(r.state as any)).length,
    };
  }

  // ── Section 28: consolidated ──────────────────────────────────────────────

  /**
   * One row per application that has reached evaluation, with the panel's
   * figures and both scores side by side.
   */
  static async consolidated(params: {
    search?: string;
    panelId?: string;
    schemeId?: string;
    evaluationStatus?: string;
  }) {
    const and: Prisma.StartupApplicationWhereInput[] = [
      LIVE,
      // Only what is actually in the evaluation stage, so the screen is not a
      // second copy of the full application list.
      {
        OR: [
          { pitchEvaluations: { some: {} } },
          { pceState: { pitchStatus: 'COMPLETED' } },
          { pceState: { evaluationStatus: { in: ['IN_PROGRESS', 'COMPLETED'] } } },
        ],
      },
    ];

    if (params.search?.trim()) {
      const q = params.search.trim();
      and.push({
        OR: [
          { applicationNo: { contains: q, mode: 'insensitive' } },
          { startupName: { contains: q, mode: 'insensitive' } },
        ],
      });
    }
    if (params.panelId?.trim()) {
      and.push({ panelAllocations: { some: { panelId: params.panelId.trim() } } });
    }
    if (params.evaluationStatus?.trim()) {
      and.push({ pceState: { evaluationStatus: params.evaluationStatus.trim() as any } });
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
        mainSector: true,
        scheme: { select: { id: true, name: true, code: true } },
        pceState: {
          select: {
            schemeStatus: true,
            pitchStatus: true,
            evaluationStatus: true,
            provisionalScheme: { select: { id: true, name: true, code: true } },
            finalScheme: { select: { id: true, name: true, code: true } },
          },
        },
        reviews: { select: { totalScore: true } },
        finalSelection: { select: { decision: true, grantApproved: true } },
        pitchEvaluations: { select: evaluationSelect },
        panelAllocations: {
          select: {
            panel: {
              select: {
                id: true,
                name: true,
                members: { select: { role: true, evaluator: { select: { id: true } } } },
              },
            },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    return {
      items: rows.map((r) => ({
        id: r.id,
        applicationNo: r.applicationNo,
        startupName: r.startupName,
        mainSector: r.mainSector,
        currentScheme:
          r.pceState?.finalScheme ?? r.pceState?.provisionalScheme ?? r.scheme ?? null,
        isSchemeAssigned: !!r.pceState && r.pceState.schemeStatus !== 'NOT_ASSIGNED',
        pceState: r.pceState,
        finalSelection: r.finalSelection,
        panels: (r.panelAllocations ?? []).map((a) => a.panel).filter(Boolean),
        // Section 28 wants the preliminary and the pitch score side by side.
        preliminaryScore: this.averageOf(
          (r.reviews ?? [])
            .map((v) => Number(v.totalScore))
            .filter((n) => Number.isFinite(n) && n > 0),
        ),
        evaluations: (r.pitchEvaluations ?? []).map((e) => ({
          ...e,
          evaluatorName: evaluatorName(e.evaluator),
        })),
        summary: this.summarise(r.pitchEvaluations ?? [], r.panelAllocations),
      })),
      total: rows.length,
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Which evaluator this write belongs to.
   *
   * An admin may record on behalf of a named evaluator - a jury member who
   * scored on paper. Anyone else is only ever themselves, so a passed
   * evaluatorId from a non-admin is ignored rather than trusted.
   */
  private static async resolveActingEvaluator(
    input: { evaluatorId?: string },
    actor: { userId: string; isAdmin: boolean },
  ) {
    if (actor.isAdmin && input.evaluatorId) {
      const exists = await prisma.evaluator.findUnique({
        where: { id: input.evaluatorId },
        select: { id: true },
      });
      if (!exists) throw new NotFoundError('Evaluator not found');
      return input.evaluatorId;
    }
    const self = await this.resolveEvaluator(actor.userId);
    return self.id;
  }

  /**
   * Keep the application's evaluation status in step with its evaluations.
   *
   * Derived rather than set by the caller: nothing submitted is Pending, some
   * submitted is In Progress, and every seated evaluator submitted is
   * Completed. A status set by hand drifts the moment an evaluation reopens.
   */
  private static async syncApplicationEvaluationStatus(applicationId: string) {
    const [evaluations, allocations] = await Promise.all([
      prisma.pitchEvaluation.findMany({
        where: { applicationId },
        select: { evaluatorId: true, state: true },
      }),
      prisma.panelApplication.findMany({
        where: { applicationId, panel: { deletedAt: null } },
        select: { panel: { select: { members: { select: { evaluatorId: true } } } } },
      }),
    ]);

    const expected = new Set<string>();
    allocations.forEach((a) =>
      (a.panel?.members ?? []).forEach((m) => expected.add(m.evaluatorId)),
    );
    const done = new Set(
      evaluations.filter((e) => COUNTED.includes(e.state as any)).map((e) => e.evaluatorId),
    );

    const status =
      done.size === 0
        ? 'PENDING'
        : expected.size > 0 && done.size >= expected.size
          ? 'COMPLETED'
          : 'IN_PROGRESS';

    // Created if absent, because allocating an application to a panel does not
    // create one: an application can reach evaluation without ever having been
    // through scheme assignment or scheduling. Updating blind would throw
    // P2025, and swallowing that would leave the dashboard counts and the
    // consolidated filter silently reporting nothing.
    await PceService.ensureState(applicationId);
    await prisma.applicationPceState.update({
      where: { applicationId },
      data: { evaluationStatus: status as any },
    });
  }
}

export default EvaluationsService;
