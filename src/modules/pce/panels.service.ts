import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { BadRequestError, NotFoundError } from '../../common/utils/apiError';
import { sanitiseMemberCategories } from './expertCategories';
import { LIVE } from './pce.constants';
import { MandatesService } from './mandates.service';

/**
 * Section 15: evaluator / jury panel management.
 *
 * Several panels can sit on one pitching day, each taking a slice of the
 * applications - "Panel A - FinTech & AI", "Panel B - HealthTech". A panel is
 * therefore a working group for a date and a set of sectors, not a permanent
 * body; that is what Committee is for.
 *
 * Allocation is what makes a panel mean anything: an evaluator sees only the
 * applications reaching them through PanelApplication, so the Online Jury
 * Portal in section 16 is built directly on this table.
 */

const memberSelect = {
  id: true,
  role: true,
  createdAt: true,
  /** What this person counts as on this panel, as opposed to in general. */
  expertCategories: true,
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
      officialEmail: true,
      personalEmail: true,
      sectors: true,
      expertCategories: true,
      status: true,
    },
  },
} satisfies Prisma.PanelMemberSelect;

const allocationSelect = {
  id: true,
  allocatedAt: true,
  remarks: true,
  application: {
    select: {
      id: true,
      applicationNo: true,
      startupName: true,
      fullName: true,
      mainSector: true,
      status: true,
      pceState: {
        select: {
          pitchStatus: true,
          evaluationStatus: true,
          provisionalScheme: { select: { id: true, name: true, code: true } },
          finalScheme: { select: { id: true, name: true, code: true } },
        },
      },
    },
  },
} satisfies Prisma.PanelApplicationSelect;

const CHAIR = 'CHAIRPERSON';

/** Membership in the shape the compliance check takes. */
const panelMembersFor = (members: any[]) =>
  (members ?? []).map((m) => ({
    evaluatorId: m.evaluator?.id ?? '',
    name: [m.evaluator?.firstName, m.evaluator?.middleName, m.evaluator?.lastName]
      .filter(Boolean)
      .join(' ')
      .trim(),
    // From the membership, which is what the mandate asks about. An older row
    // whose categories were never chosen falls back to the person's own list, so
    // an existing committee does not turn non-compliant the day this ships.
    categories: (m.expertCategories?.length ? m.expertCategories : m.evaluator?.expertCategories) ?? [],
    categoriesFromProfile: !(m.expertCategories?.length),
  }));

const evaluatorName = (e: any) =>
  [e?.firstName, e?.middleName, e?.lastName].filter(Boolean).join(' ').trim() || '—';

export class PanelsService {
  static async list(params: {
    search?: string;
    schemeId?: string;
    status?: string;
    pitchDate?: string;
    session?: string;
  }) {
    const and: Prisma.EvaluationPanelWhereInput[] = [LIVE];

    if (params.search?.trim()) {
      and.push({ name: { contains: params.search.trim(), mode: 'insensitive' } });
    }
    if (params.schemeId?.trim()) and.push({ schemeId: params.schemeId.trim() });
    if (params.status?.trim()) and.push({ status: params.status.trim() as any });
    if (params.session?.trim()) and.push({ session: params.session.trim() as any });

    if (params.pitchDate?.trim()) {
      const d = new Date(params.pitchDate.trim());
      if (!Number.isNaN(d.getTime())) {
        const from = new Date(d);
        from.setHours(0, 0, 0, 0);
        const to = new Date(d);
        to.setHours(23, 59, 59, 999);
        and.push({ pitchDate: { gte: from, lte: to } });
      }
    }

    const panels = await prisma.evaluationPanel.findMany({
      where: { AND: and },
      select: {
        id: true,
        name: true,
        evaluationStage: true,
        pitchDate: true,
        session: true,
        sectors: true,
        status: true,
        remarks: true,
        createdAt: true,
        scheme: { select: { id: true, name: true, code: true } },
        mandate: {
          select: {
            id: true,
            name: true,
            minMembers: true,
            maxMembers: true,
            requirements: { select: { category: true, minCount: true, isMandatory: true } },
          },
        },
        members: { select: memberSelect, orderBy: [{ role: 'asc' }] },
        _count: { select: { allocations: true, schedules: true, evaluations: true } },
      },
      orderBy: [{ pitchDate: 'desc' }, { name: 'asc' }],
    });

    return {
      items: panels.map((p) => ({
        ...p,
        chairperson: p.members.find((m) => m.role === CHAIR) ?? null,
        memberCount: p.members.length,
        compliance: MandatesService.evaluateCompliance(p.mandate ?? null, panelMembersFor(p.members)),
        allocationCount: p._count.allocations,
        scheduleCount: p._count.schedules,
        evaluationCount: p._count.evaluations,
      })),
      total: panels.length,
    };
  }

  static async getById(id: string) {
    const panel = await prisma.evaluationPanel.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        schemeId: true,
        evaluationStage: true,
        pitchDate: true,
        session: true,
        sectors: true,
        status: true,
        remarks: true,
        createdAt: true,
        scheme: { select: { id: true, name: true, code: true } },
        mandate: {
          select: {
            id: true,
            name: true,
            minMembers: true,
            maxMembers: true,
            requirements: { select: { category: true, minCount: true, isMandatory: true } },
          },
        },
        members: { select: memberSelect, orderBy: [{ role: 'asc' }] },
        allocations: { select: allocationSelect, orderBy: { allocatedAt: 'desc' } },
      },
    });
    if (!panel) throw new NotFoundError('Panel not found');
    return {
      ...panel,
      members: panel.members.map((m) => ({ ...m, evaluatorName: evaluatorName(m.evaluator) })),
    };
  }

  static async create(
    input: {
      name: string;
      schemeId?: string | null;
      mandateId?: string | null;
      sessionId?: string | null;
      requiredEvaluators?: number | null;
      evaluationStage?: string | null;
      pitchDate?: string | null;
      session?: string | null;
      sectors?: string[];
      status?: string;
      remarks?: string | null;
      members?: Array<{ evaluatorId: string; role?: string; expertCategories?: string[] }>;
    },
    actorId: string,
  ) {
    const members = this.dedupe(input.members);
    await this.assertSession(input.sessionId);
    await this.assertRequiredEvaluators(input.mandateId, input.requiredEvaluators);

    return prisma.evaluationPanel.create({
      data: {
        name: input.name.trim(),
        schemeId: input.schemeId || null,
        mandateId: input.mandateId || null,
        sessionId: input.sessionId || null,
        requiredEvaluators: input.requiredEvaluators ?? null,
        evaluationStage: input.evaluationStage ?? null,
        pitchDate: input.pitchDate ? new Date(input.pitchDate) : null,
        session: (input.session as any) || null,
        sectors: Array.isArray(input.sectors) ? input.sectors.filter(Boolean) : [],
        status: (input.status as any) ?? 'DRAFT',
        remarks: input.remarks ?? null,
        createdBy: actorId,
        ...(members.length
          ? {
              members: {
                create: members.map((m) => ({
                  evaluatorId: m.evaluatorId,
                  role: (m.role as any) ?? 'MEMBER',
                  // One or two, per seat: this is what the panel's mandate is
                  // checked against, not the person's whole profile.
                  expertCategories: sanitiseMemberCategories(
                    m.expertCategories,
                    `Expert category for member ${members.indexOf(m) + 1}`,
                  ),
                })),
              },
            }
          : {}),
      },
      select: { id: true, name: true },
    });
  }

  static async update(
    id: string,
    input: {
      name?: string;
      schemeId?: string | null;
      mandateId?: string | null;
      sessionId?: string | null;
      requiredEvaluators?: number | null;
      evaluationStage?: string | null;
      pitchDate?: string | null;
      session?: string | null;
      sectors?: string[];
      status?: string;
      remarks?: string | null;
    },
  ) {
    const existing = await prisma.evaluationPanel.findUnique({
      where: { id },
      select: { id: true, mandateId: true, requiredEvaluators: true },
    });
    if (!existing) throw new NotFoundError('Panel not found');
    await this.assertSession(input.sessionId);
    // Either field alone can create the conflict, so both are resolved against
    // what the panel already holds before the pair is checked.
    await this.assertRequiredEvaluators(
      input.mandateId !== undefined ? input.mandateId : existing.mandateId,
      input.requiredEvaluators !== undefined
        ? input.requiredEvaluators
        : existing.requiredEvaluators,
    );

    return prisma.evaluationPanel.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.schemeId !== undefined ? { schemeId: input.schemeId || null } : {}),
        ...(input.mandateId !== undefined ? { mandateId: input.mandateId || null } : {}),
        ...(input.sessionId !== undefined ? { sessionId: input.sessionId || null } : {}),
        ...(input.requiredEvaluators !== undefined
          ? { requiredEvaluators: input.requiredEvaluators ?? null }
          : {}),
        ...(input.evaluationStage !== undefined
          ? { evaluationStage: input.evaluationStage }
          : {}),
        ...(input.pitchDate !== undefined
          ? { pitchDate: input.pitchDate ? new Date(input.pitchDate) : null }
          : {}),
        ...(input.session !== undefined ? { session: (input.session as any) || null } : {}),
        ...(input.sectors !== undefined
          ? { sectors: Array.isArray(input.sectors) ? input.sectors.filter(Boolean) : [] }
          : {}),
        ...(input.status !== undefined ? { status: input.status as any } : {}),
        ...(input.remarks !== undefined ? { remarks: input.remarks } : {}),
      },
      select: { id: true, name: true },
    });
  }

  /**
   * Soft delete. A panel that has already evaluated something must stay
   * resolvable, because PitchEvaluation points at it.
   */
  static async remove(id: string) {
    const existing = await prisma.evaluationPanel.findUnique({
      where: { id },
      select: { id: true, _count: { select: { evaluations: true, schedules: true } } },
    });
    if (!existing) throw new NotFoundError('Panel not found');

    await prisma.evaluationPanel.delete({ where: { id } });
    return {
      id,
      hadEvaluations: existing._count.evaluations > 0,
      hadSchedules: existing._count.schedules > 0,
    };
  }

  // ── Members ───────────────────────────────────────────────────────────────

  static async addMembers(
    panelId: string,
    members: Array<{ evaluatorId: string; role?: string; expertCategories?: string[] }>,
  ) {
    const panel = await prisma.evaluationPanel.findUnique({
      where: { id: panelId },
      select: { id: true },
    });
    if (!panel) throw new NotFoundError('Panel not found');

    const wanted = this.dedupe(members);
    if (wanted.length === 0) throw new BadRequestError('No evaluators selected');

    const valid = new Set(
      (
        await prisma.evaluator.findMany({
          where: { id: { in: wanted.map((m) => m.evaluatorId) } },
          select: { id: true },
        })
      ).map((e) => e.id),
    );

    const already = new Set(
      (
        await prisma.panelMember.findMany({
          where: { panelId, evaluatorId: { in: Array.from(valid) } },
          select: { evaluatorId: true },
        })
      ).map((m) => m.evaluatorId),
    );

    const added: string[] = [];
    const skipped: Array<{ evaluatorId: string; reason: string }> = [];

    for (const m of wanted) {
      if (!valid.has(m.evaluatorId)) {
        skipped.push({ evaluatorId: m.evaluatorId, reason: 'Evaluator not found' });
        continue;
      }
      if (already.has(m.evaluatorId)) {
        skipped.push({ evaluatorId: m.evaluatorId, reason: 'Already on this panel' });
        continue;
      }

      // Per person, so one bad selection does not reject the whole batch.
      let cats: string[];
      try {
        cats = sanitiseMemberCategories(m.expertCategories);
      } catch (e: any) {
        skipped.push({
          evaluatorId: m.evaluatorId,
          reason: e?.message ?? 'Invalid expert category',
        });
        continue;
      }

      await prisma.panelMember.create({
        data: {
          panelId,
          evaluatorId: m.evaluatorId,
          role: (m.role as any) ?? 'MEMBER',
          expertCategories: cats,
        },
      });
      added.push(m.evaluatorId);
    }

    const newChair = wanted.find((m) => m.role === CHAIR && valid.has(m.evaluatorId));
    if (newChair) await this.enforceSingleChair(panelId, newChair.evaluatorId);

    return { addedCount: added.length, skippedCount: skipped.length, skipped };
  }

  static async updateMember(
    memberId: string,
    input: { role?: string; expertCategories?: string[] },
  ) {
    const member = await prisma.panelMember.findUnique({
      where: { id: memberId },
      select: { id: true, panelId: true, evaluatorId: true },
    });
    if (!member) throw new NotFoundError('Panel member not found');

    const updated = await prisma.panelMember.update({
      where: { id: memberId },
      data: {
        ...(input.role !== undefined ? { role: input.role as any } : {}),
        ...(input.expertCategories !== undefined
          ? { expertCategories: sanitiseMemberCategories(input.expertCategories) }
          : {}),
      },
      select: memberSelect,
    });

    if (input.role === CHAIR) {
      await this.enforceSingleChair(member.panelId, member.evaluatorId);
    }
    return updated;
  }

  /**
   * Remove an evaluator from a panel.
   *
   * Refused once they have scored something through it - deleting the seat
   * would leave an evaluation attributed to a panel the evaluator was never
   * on. Section 27 expects a submitted evaluation to stand.
   */
  static async removeMember(memberId: string) {
    const member = await prisma.panelMember.findUnique({
      where: { id: memberId },
      select: { id: true, panelId: true, evaluatorId: true },
    });
    if (!member) throw new NotFoundError('Panel member not found');

    const scored = await prisma.pitchEvaluation.count({
      where: { panelId: member.panelId, evaluatorId: member.evaluatorId },
    });
    if (scored > 0) {
      throw new BadRequestError(
        'This evaluator has already submitted an evaluation through this panel, so their seat cannot be removed.',
      );
    }

    await prisma.panelMember.delete({ where: { id: memberId } });
    return { id: memberId };
  }

  // ── Application allocation ────────────────────────────────────────────────

  static async allocate(
    panelId: string,
    applicationIds: string[],
    actorId: string,
    remarks?: string | null,
  ) {
    const panel = await prisma.evaluationPanel.findUnique({
      where: { id: panelId },
      select: { id: true },
    });
    if (!panel) throw new NotFoundError('Panel not found');

    const ids = Array.from(new Set((applicationIds ?? []).filter(Boolean)));
    if (ids.length === 0) throw new BadRequestError('No applications selected');

    const applications = await prisma.startupApplication.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    const valid = new Set(applications.map((a) => a.id));

    const already = new Set(
      (
        await prisma.panelApplication.findMany({
          where: { panelId, applicationId: { in: Array.from(valid) } },
          select: { applicationId: true },
        })
      ).map((a) => a.applicationId),
    );

    const allocated: string[] = [];
    const skipped: Array<{ applicationId: string; reason: string }> = [];

    for (const id of ids) {
      if (!valid.has(id)) {
        skipped.push({ applicationId: id, reason: 'Application not found' });
        continue;
      }
      if (already.has(id)) {
        skipped.push({ applicationId: id, reason: 'Already allocated to this panel' });
        continue;
      }
      await prisma.panelApplication.create({
        data: { panelId, applicationId: id, allocatedBy: actorId, remarks: remarks ?? null },
      });
      allocated.push(id);
    }

    return { allocatedCount: allocated.length, skippedCount: skipped.length, skipped };
  }

  static async deallocate(allocationId: string) {
    const allocation = await prisma.panelApplication.findUnique({
      where: { id: allocationId },
      select: { id: true, panelId: true, applicationId: true },
    });
    if (!allocation) throw new NotFoundError('Allocation not found');

    // An application already evaluated by this panel must keep its link, or
    // the evaluation loses the context it was made in.
    const scored = await prisma.pitchEvaluation.count({
      where: { panelId: allocation.panelId, applicationId: allocation.applicationId },
    });
    if (scored > 0) {
      throw new BadRequestError(
        'This panel has already evaluated the application, so the allocation cannot be removed.',
      );
    }

    await prisma.panelApplication.delete({ where: { id: allocationId } });
    return { id: allocationId };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * A panel may only sit on a session that exists. Checked explicitly rather
   * than left to the foreign key, so the caller gets 404 instead of a 500.
   */
  /**
   * A panel may not require fewer acceptances than its mandate's minimum.
   *
   * Both numbers are enforced, in different places: requiredEvaluators decides
   * the headcount check, while the mandate's minMembers is enforced inside the
   * compliance evaluation. Setting the first below the second therefore produced
   * a panel that could never confirm - the headcount read "2 of 2 met" while the
   * blocker said "needs at least 3 members", and no amount of accepting fixed
   * it. Refused at the point the number is entered instead.
   */
  private static async assertRequiredEvaluators(
    mandateId?: string | null,
    requiredEvaluators?: number | null,
  ) {
    if (!mandateId || requiredEvaluators == null) return;

    const mandate = await prisma.schemeCommitteeMandate.findFirst({
      where: { id: mandateId, deletedAt: null },
      select: { name: true, minMembers: true },
    });
    if (!mandate) return; // assertMandate's job, not this one's.

    if (requiredEvaluators < mandate.minMembers) {
      throw new BadRequestError(
        `This panel requires ${requiredEvaluators} evaluator(s), but the mandate ` +
          `"${mandate.name}" needs at least ${mandate.minMembers}. A panel cannot ` +
          `confirm below its mandate's minimum, so raise the required count or ` +
          `change the mandate.`,
      );
    }
  }

  private static async assertSession(sessionId?: string | null) {
    if (!sessionId) return;
    const found = await prisma.pitchingSession.findFirst({
      where: { id: sessionId, deletedAt: null },
      select: { id: true },
    });
    if (!found) throw new NotFoundError('Pitching session not found');
  }

  private static async enforceSingleChair(panelId: string, chairEvaluatorId: string) {
    await prisma.panelMember.updateMany({
      where: { panelId, role: CHAIR as any, evaluatorId: { not: chairEvaluatorId } },
      data: { role: 'MEMBER' as any },
    });
  }

  private static dedupe(members?: Array<{ evaluatorId: string; role?: string; expertCategories?: string[] }>) {
    const seen = new Map<
      string,
      { evaluatorId: string; role?: string; expertCategories?: string[] }
    >();
    (members ?? []).forEach((m) => {
      if (m?.evaluatorId) seen.set(m.evaluatorId, m);
    });
    return Array.from(seen.values());
  }
}

export default PanelsService;
