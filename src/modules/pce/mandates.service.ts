import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { BadRequestError, NotFoundError } from '../../common/utils/apiError';
import { LIVE } from './pce.constants';
import {
  EXPERT_CATEGORIES,
  expertCategoryLabel,
  isExpertCategory,
  sanitiseCategories,
} from './expertCategories';

/**
 * Scheme committee mandates.
 *
 * A scheme states how many committees it needs and how each must be composed,
 * so every scheme can differ rather than one hardcoded structure applying to
 * all of them.
 *
 * Compliance is computed, never stored. A stored "compliant" flag goes stale
 * the moment a member leaves or a mandate is edited, and the thing that must be
 * true is a property of the current membership - so it is derived on read and
 * re-derived at the moment it actually gates something.
 */

/**
 * How one category requirement stands against an actual membership.
 *
 * `have` counts distinct members carrying that category. One person counted
 * towards two categories is deliberate: a mandate asking for an industry expert
 * and an investor may be satisfied by someone who is both, and
 * `sharedMembers` reports where that happened so an administrator can see it
 * rather than discover it later.
 */
export interface CategoryCompliance {
  category: string;
  label: string;
  required: number;
  isMandatory: boolean;
  have: number;
  met: boolean;
  shortfall: number;
}

export interface MandateCompliance {
  mandateId: string | null;
  mandateName: string | null;
  memberCount: number;
  minMembers: number | null;
  maxMembers: number | null;
  sizeOk: boolean;
  categories: CategoryCompliance[];
  /** Members counted towards more than one required category. */
  sharedMembers: Array<{ evaluatorId: string; name: string; categories: string[] }>;
  /** Everything outstanding, in words, for a UI to list. */
  blockers: string[];
  isCompliant: boolean;
}

const mandateInclude = {
  requirements: { orderBy: { category: 'asc' } },
  scheme: { select: { id: true, name: true, code: true } },
  _count: { select: { committees: true, panels: true } },
} satisfies Prisma.SchemeCommitteeMandateInclude;

const evaluatorName = (e: any) =>
  [e?.firstName, e?.middleName, e?.lastName].filter(Boolean).join(' ').trim() || '—';

export class MandatesService {
  /** The vocabulary a mandate's requirements are drawn from. */
  static categories() {
    return { categories: EXPERT_CATEGORIES };
  }

  // ── Mandate configuration ─────────────────────────────────────────────────

  static async list(params: { schemeId?: string; includeInactive?: string | boolean }) {
    const includeInactive =
      params.includeInactive === true || params.includeInactive === 'true';

    const mandates = await prisma.schemeCommitteeMandate.findMany({
      where: {
        ...LIVE,
        ...(params.schemeId?.trim() ? { schemeId: params.schemeId.trim() } : {}),
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: mandateInclude,
      orderBy: [{ schemeId: 'asc' }, { sequence: 'asc' }],
    });

    return {
      items: mandates.map((m) => ({
        ...m,
        requirements: m.requirements.map((r) => ({
          ...r,
          label: expertCategoryLabel(r.category),
        })),
        committeeCount: m._count.committees,
        panelCount: m._count.panels,
      })),
      total: mandates.length,
    };
  }

  /**
   * Per scheme: how many committees its mandates require, and how many exist.
   *
   * The spec lists "number of committees required" as a mandate parameter.
   * It is derived from the mandates rather than stored as a separate number,
   * which cannot then disagree with the mandates themselves.
   */
  static async schemeRollup(schemeId?: string) {
    const mandates = await prisma.schemeCommitteeMandate.findMany({
      where: {
        ...LIVE,
        isActive: true,
        ...(schemeId?.trim() ? { schemeId: schemeId.trim() } : {}),
      },
      select: {
        id: true,
        name: true,
        scheme: { select: { id: true, name: true, code: true } },
        _count: { select: { committees: true } },
      },
      orderBy: [{ schemeId: 'asc' }, { sequence: 'asc' }],
    });

    const byScheme = new Map<string, any>();
    for (const m of mandates) {
      const key = m.scheme?.id ?? 'none';
      const row =
        byScheme.get(key) ??
        { scheme: m.scheme, required: 0, formed: 0, unformed: [] as string[] };
      row.required += 1;
      if (m._count.committees > 0) row.formed += 1;
      else row.unformed.push(m.name);
      byScheme.set(key, row);
    }

    return {
      items: Array.from(byScheme.values()).map((r) => ({
        ...r,
        isComplete: r.formed >= r.required,
      })),
    };
  }

  static async getById(id: string) {
    const mandate = await prisma.schemeCommitteeMandate.findUnique({
      where: { id },
      include: mandateInclude,
    });
    if (!mandate) throw new NotFoundError('Mandate not found');
    return {
      ...mandate,
      requirements: mandate.requirements.map((r) => ({
        ...r,
        label: expertCategoryLabel(r.category),
      })),
    };
  }

  static async create(
    input: {
      schemeId: string;
      name: string;
      type?: string;
      minMembers?: number;
      maxMembers?: number | null;
      purpose?: string | null;
      remarks?: string | null;
      sequence?: number;
      requirements?: Array<{
        category: string;
        minCount?: number;
        isMandatory?: boolean;
        remarks?: string | null;
      }>;
    },
    actorId: string,
  ) {
    const scheme = await prisma.scheme.findUnique({
      where: { id: input.schemeId },
      select: { id: true },
    });
    if (!scheme) throw new NotFoundError('Scheme not found');

    const { minMembers, maxMembers, requirements } = this.validate(input);

    try {
      return await prisma.schemeCommitteeMandate.create({
        data: {
          schemeId: input.schemeId,
          name: input.name.trim(),
          type: (input.type as any) ?? 'PITCH_EVALUATION',
          minMembers,
          maxMembers,
          purpose: input.purpose ?? null,
          remarks: input.remarks ?? null,
          sequence: Number(input.sequence) || 1,
          createdBy: actorId,
          ...(requirements.length ? { requirements: { create: requirements } } : {}),
        },
        include: mandateInclude,
      });
    } catch (e: any) {
      throw this.rethrowNameClash(e, input.name);
    }
  }

  static async update(
    id: string,
    input: {
      name?: string;
      type?: string;
      minMembers?: number;
      maxMembers?: number | null;
      purpose?: string | null;
      remarks?: string | null;
      sequence?: number;
      isActive?: boolean;
      /** When present, replaces the requirement set wholesale. */
      requirements?: Array<{
        category: string;
        minCount?: number;
        isMandatory?: boolean;
        remarks?: string | null;
      }>;
    },
  ) {
    const existing = await prisma.schemeCommitteeMandate.findUnique({
      where: { id },
      select: { id: true, minMembers: true, maxMembers: true },
    });
    if (!existing) throw new NotFoundError('Mandate not found');

    const merged = {
      name: input.name ?? 'unchanged',
      minMembers: input.minMembers ?? existing.minMembers,
      maxMembers: input.maxMembers !== undefined ? input.maxMembers : existing.maxMembers,
      requirements: input.requirements,
    };
    const { minMembers, maxMembers, requirements } = this.validate(merged as any, !!input.requirements);

    try {
      return await prisma.$transaction(async (tx) => {
        if (input.requirements) {
          // Replaced rather than merged: a requirement removed from the mandate
          // has to disappear, and matching rows up by category would leave
          // whatever the caller omitted silently in place.
          await tx.mandateCategoryRequirement.deleteMany({ where: { mandateId: id } });
          if (requirements.length) {
            await tx.mandateCategoryRequirement.createMany({
              data: requirements.map((r) => ({ ...r, mandateId: id })),
            });
          }
        }

        return tx.schemeCommitteeMandate.update({
          where: { id },
          data: {
            ...(input.name !== undefined ? { name: input.name.trim() } : {}),
            ...(input.type !== undefined ? { type: input.type as any } : {}),
            ...(input.minMembers !== undefined ? { minMembers } : {}),
            ...(input.maxMembers !== undefined ? { maxMembers } : {}),
            ...(input.purpose !== undefined ? { purpose: input.purpose } : {}),
            ...(input.remarks !== undefined ? { remarks: input.remarks } : {}),
            ...(input.sequence !== undefined ? { sequence: Number(input.sequence) || 1 } : {}),
            ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          },
          include: mandateInclude,
        });
      });
    } catch (e: any) {
      throw this.rethrowNameClash(e, input.name);
    }
  }

  /**
   * Soft delete. Committees and panels formed under a mandate keep pointing at
   * it (the FK is SET NULL only on a hard delete), so the composition a
   * committee was judged against stays readable.
   */
  static async remove(id: string) {
    const existing = await prisma.schemeCommitteeMandate.findUnique({
      where: { id },
      select: { id: true, _count: { select: { committees: true, panels: true } } },
    });
    if (!existing) throw new NotFoundError('Mandate not found');

    await prisma.schemeCommitteeMandate.delete({ where: { id } });
    return {
      id,
      hadCommittees: existing._count.committees > 0,
      hadPanels: existing._count.panels > 0,
    };
  }

  /**
   * Copy every mandate from one scheme to another.
   *
   * Schemes in the same programme usually share a committee structure, and
   * re-entering eight category minimums per scheme is where mistakes come from.
   */
  static async copyToScheme(fromSchemeId: string, toSchemeId: string, actorId: string) {
    if (fromSchemeId === toSchemeId) {
      throw new BadRequestError('Choose a different scheme to copy into');
    }

    const [source, target] = await Promise.all([
      prisma.schemeCommitteeMandate.findMany({
        where: { ...LIVE, schemeId: fromSchemeId },
        include: { requirements: true },
        orderBy: { sequence: 'asc' },
      }),
      prisma.scheme.findUnique({ where: { id: toSchemeId }, select: { id: true } }),
    ]);
    if (!target) throw new NotFoundError('Target scheme not found');
    if (source.length === 0) throw new BadRequestError('That scheme has no mandates to copy');

    const existingNames = new Set(
      (
        await prisma.schemeCommitteeMandate.findMany({
          where: { ...LIVE, schemeId: toSchemeId },
          select: { name: true },
        })
      ).map((m) => m.name),
    );

    let copied = 0;
    const skipped: string[] = [];

    for (const m of source) {
      // The unique index is [schemeId, name], so a clash is a skip rather than
      // a failure that abandons the rest of the copy.
      if (existingNames.has(m.name)) {
        skipped.push(m.name);
        continue;
      }
      await prisma.schemeCommitteeMandate.create({
        data: {
          schemeId: toSchemeId,
          name: m.name,
          type: m.type,
          minMembers: m.minMembers,
          maxMembers: m.maxMembers,
          purpose: m.purpose,
          remarks: m.remarks,
          sequence: m.sequence,
          createdBy: actorId,
          requirements: {
            create: m.requirements.map((r) => ({
              category: r.category,
              minCount: r.minCount,
              isMandatory: r.isMandatory,
              remarks: r.remarks,
            })),
          },
        },
      });
      copied++;
    }

    return { copiedCount: copied, skippedCount: skipped.length, skipped };
  }

  // ── Compliance ────────────────────────────────────────────────────────────

  /**
   * Whether a membership satisfies a mandate.
   *
   * Pure: it takes the mandate and the members and returns the verdict, so the
   * same function answers for a committee, a panel, and a hypothetical
   * membership the UI is still assembling.
   */
  static evaluateCompliance(
    mandate: {
      id: string;
      name: string;
      minMembers: number;
      maxMembers: number | null;
      requirements: Array<{ category: string; minCount: number; isMandatory: boolean }>;
    } | null,
    members: Array<{ evaluatorId: string; name: string; categories: string[] }>,
  ): MandateCompliance {
    const memberCount = members.length;

    if (!mandate) {
      return {
        mandateId: null,
        mandateName: null,
        memberCount,
        minMembers: null,
        maxMembers: null,
        sizeOk: true,
        categories: [],
        sharedMembers: [],
        blockers: [],
        // No mandate means nothing to fail against.
        isCompliant: true,
      };
    }

    const blockers: string[] = [];

    const min = Number(mandate.minMembers) || 0;
    const max = mandate.maxMembers == null ? null : Number(mandate.maxMembers);
    const sizeOk = memberCount >= min && (max == null || memberCount <= max);
    if (memberCount < min) {
      blockers.push(`Needs at least ${min} members; has ${memberCount}`);
    }
    if (max != null && memberCount > max) {
      blockers.push(`Allows at most ${max} members; has ${memberCount}`);
    }

    const required = mandate.requirements.filter((r) => r.isMandatory && r.minCount > 0);

    const categories: CategoryCompliance[] = mandate.requirements.map((r) => {
      const have = members.filter((m) => m.categories.includes(r.category)).length;
      const need = r.isMandatory ? Number(r.minCount) || 0 : 0;
      const met = have >= need;
      if (r.isMandatory && !met) {
        blockers.push(
          `Needs ${need} ${expertCategoryLabel(r.category)}${need === 1 ? '' : 's'}; has ${have}`,
        );
      }
      return {
        category: r.category,
        label: expertCategoryLabel(r.category),
        required: need,
        isMandatory: r.isMandatory,
        have,
        met,
        shortfall: Math.max(0, need - have),
      };
    });

    // Who is doing double duty. Surfaced rather than hidden, because a
    // committee that technically satisfies five categories with three people
    // may not be what the scheme intended.
    const requiredKeys = new Set(required.map((r) => r.category));
    const sharedMembers = members
      .map((m) => ({
        evaluatorId: m.evaluatorId,
        name: m.name,
        categories: m.categories.filter((c) => requiredKeys.has(c)),
      }))
      .filter((m) => m.categories.length > 1);

    return {
      mandateId: mandate.id,
      mandateName: mandate.name,
      memberCount,
      minMembers: min,
      maxMembers: max,
      sizeOk,
      categories,
      sharedMembers,
      blockers,
      isCompliant: blockers.length === 0,
    };
  }

  /** Compliance for a saved committee. */
  static async committeeCompliance(committeeId: string): Promise<MandateCompliance> {
    const committee = await prisma.committee.findUnique({
      where: { id: committeeId },
      select: {
        id: true,
        mandateId: true,
        members: {
          where: { leftAt: null },
          select: {
            // The membership's own categories, which is what compliance reads.
            expertCategories: true,
            evaluator: {
              select: {
                id: true,
                firstName: true,
                middleName: true,
                lastName: true,
                expertCategories: true,
              },
            },
          },
        },
      },
    });
    if (!committee) throw new NotFoundError('Committee not found');

    return this.evaluateCompliance(
      await this.loadMandate(committee.mandateId),
      (committee.members ?? []).map((m) => ({
        evaluatorId: m.evaluator.id,
        name: evaluatorName(m.evaluator),
        // The membership's own categories decide compliance; the evaluator's
        // list is only a fallback for rows written before they were recorded.
        categories: (m.expertCategories?.length
          ? m.expertCategories
          : m.evaluator.expertCategories) ?? [],
        categoriesFromProfile: !(m.expertCategories?.length),
      })),
    );
  }

  /**
   * Compliance for a panel.
   *
   * `confirmedOnly` counts only evaluators who accepted their invitation,
   * which is what the spec means by a panel being confirmed. Counting assigned
   * members would call a panel ready before anyone agreed to sit on it.
   */
  static async panelCompliance(
    panelId: string,
    opts: { confirmedOnly?: boolean } = {},
  ): Promise<MandateCompliance> {
    const panel = await prisma.evaluationPanel.findUnique({
      where: { id: panelId },
      select: {
        id: true,
        mandateId: true,
        members: {
          select: {
            evaluatorId: true,
            // The membership's own categories, which is what compliance reads.
            expertCategories: true,
            evaluator: {
              select: {
                id: true,
                firstName: true,
                middleName: true,
                lastName: true,
                expertCategories: true,
              },
            },
          },
        },
      },
    });
    if (!panel) throw new NotFoundError('Panel not found');

    let seats = panel.members ?? [];

    if (opts.confirmedOnly) {
      const accepted = await prisma.pitchInvitation.findMany({
        where: { panelId, status: 'ACCEPTED', evaluatorId: { not: null } },
        select: { evaluatorId: true },
      });
      const ok = new Set(accepted.map((a) => a.evaluatorId as string));
      seats = seats.filter((m) => ok.has(m.evaluatorId));
    }

    return this.evaluateCompliance(
      await this.loadMandate(panel.mandateId),
      seats.map((m) => ({
        evaluatorId: m.evaluator.id,
        name: evaluatorName(m.evaluator),
        // The membership's own categories decide compliance; the evaluator's
        // list is only a fallback for rows written before they were recorded.
        categories: (m.expertCategories?.length
          ? m.expertCategories
          : m.evaluator.expertCategories) ?? [],
        categoriesFromProfile: !(m.expertCategories?.length),
      })),
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private static async loadMandate(mandateId: string | null) {
    if (!mandateId) return null;
    const m = await prisma.schemeCommitteeMandate.findUnique({
      where: { id: mandateId },
      select: {
        id: true,
        name: true,
        minMembers: true,
        maxMembers: true,
        requirements: { select: { category: true, minCount: true, isMandatory: true } },
      },
    });
    return m;
  }

  private static validate(
    input: {
      name: string;
      minMembers?: number;
      maxMembers?: number | null;
      requirements?: Array<{
        category: string;
        minCount?: number;
        isMandatory?: boolean;
        remarks?: string | null;
      }>;
    },
    requirementsProvided = true,
  ) {
    const minMembers = Math.max(1, Number(input.minMembers) || 1);
    const maxMembers =
      input.maxMembers === null || input.maxMembers === undefined
        ? null
        : Math.max(1, Number(input.maxMembers));

    if (maxMembers != null && maxMembers < minMembers) {
      throw new BadRequestError(
        'The maximum committee size cannot be smaller than the minimum.',
      );
    }

    const seen = new Set<string>();
    const requirements = (requirementsProvided ? input.requirements ?? [] : []).map((r) => {
      const category = String(r.category ?? '').trim().toUpperCase();
      if (!isExpertCategory(category)) {
        throw new BadRequestError(`"${r.category}" is not a known expert category`);
      }
      if (seen.has(category)) {
        throw new BadRequestError(
          `${expertCategoryLabel(category)} is listed twice; combine it into one requirement.`,
        );
      }
      seen.add(category);
      const isMandatory = r.isMandatory !== false;
      return {
        category,
        // An optional category carries no minimum, so a zero cannot masquerade
        // as a requirement nothing can satisfy.
        minCount: isMandatory ? Math.max(1, Number(r.minCount) || 1) : 0,
        isMandatory,
        remarks: r.remarks ?? null,
      };
    });

    // The mandatory minimums cannot exceed the committee's own ceiling, or no
    // membership could ever satisfy it.
    const mandatoryTotal = requirements
      .filter((r) => r.isMandatory)
      .reduce((n, r) => n + r.minCount, 0);
    if (maxMembers != null && mandatoryTotal > maxMembers) {
      throw new BadRequestError(
        `The required categories add up to ${mandatoryTotal} members, which is more than the maximum of ${maxMembers}. No committee could satisfy this.`,
      );
    }

    return { minMembers, maxMembers, requirements };
  }

  private static rethrowNameClash(e: any, name?: string) {
    const target = e?.meta?.target;
    const onName = Array.isArray(target)
      ? target.includes('name')
      : String(target ?? '').includes('name');
    if (e?.code === 'P2002' && onName) {
      return new BadRequestError(
        `This scheme already has a mandate called "${String(name ?? '').trim()}".`,
      );
    }
    return e;
  }

  /** Helper for sanitising an evaluator's categories from a request. */
  static sanitiseCategories = sanitiseCategories;
}

export default MandatesService;
