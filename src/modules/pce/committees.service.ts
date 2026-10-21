import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { BadRequestError, NotFoundError } from '../../common/utils/apiError';
import { LIVE } from './pce.constants';
import { MandatesService } from './mandates.service';
import { sanitiseMemberCategories } from './expertCategories';

/**
 * Section 11: scheme-wise committee management.
 *
 * Committees are "preferably" linked to a scheme, so schemeId is optional - a
 * Final Selection committee can legitimately span schemes, and forcing a link
 * would mean inventing a scheme to hold it.
 *
 * Membership is by Evaluator for everyone, internal and external alike. The
 * spec lists "Internal Members" and "External Members" as separate fields, but
 * they are the same kind of thing differing by one attribute: an internal
 * member is an Evaluator with affiliation INTERNAL. Two membership tables, or
 * two string columns, would mean a person on three committees is recorded
 * three times with no way to tell it is one person.
 */

const memberInclude = {
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
    },
  },
} satisfies Prisma.CommitteeMemberInclude;

const fullInclude = {
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
  members: {
    where: { leftAt: null },
    include: memberInclude,
    orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
  },
} satisfies Prisma.CommitteeInclude;

/**
 * Membership in the shape the compliance check takes.
 *
 * Categories come from the membership rather than from the Evaluator: the
 * mandate asks what this person counts as *here*. An older row whose categories
 * were never chosen falls back to the person's own list so the committee does
 * not silently become non-compliant, and `categoriesFromProfile` marks it so the
 * screen can ask for an explicit choice.
 */
const membersFor = (members: any[]) =>
  (members ?? []).map((m) => {
    const own = m.expertCategories ?? [];
    const fromProfile = own.length === 0;
    return {
      evaluatorId: m.evaluator?.id ?? m.evaluatorId ?? '',
      name: [m.evaluator?.firstName, m.evaluator?.middleName, m.evaluator?.lastName]
        .filter(Boolean)
        .join(' ')
        .trim(),
      categories: fromProfile ? (m.evaluator?.expertCategories ?? []) : own,
      categoriesFromProfile: fromProfile,
    };
  });

/** Only one chairperson is meaningful, so a new one replaces the old. */
const CHAIR = 'CHAIRPERSON';

export class CommitteesService {
  static async list(params: {
    search?: string;
    schemeId?: string;
    type?: string;
    status?: string;
    includeExpired?: string | boolean;
  }) {
    const and: Prisma.CommitteeWhereInput[] = [LIVE];

    if (params.search?.trim()) {
      and.push({ name: { contains: params.search.trim(), mode: 'insensitive' } });
    }
    if (params.schemeId?.trim()) and.push({ schemeId: params.schemeId.trim() });
    if (params.type?.trim()) and.push({ type: params.type.trim() as any });
    if (params.status?.trim()) and.push({ status: params.status.trim() as any });

    const committees = await prisma.committee.findMany({
      where: { AND: and },
      include: fullInclude,
      orderBy: [{ createdAt: 'desc' }],
    });

    // Validity is a date range, so whether a committee is currently in force
    // is derived rather than stored - a stored flag would go stale the day
    // after it was written.
    const now = Date.now();
    return {
      items: committees.map((c) => {
        const from = c.validFrom ? new Date(c.validFrom).getTime() : -Infinity;
        const until = c.validUntil ? new Date(c.validUntil).getTime() : Infinity;
        return {
          ...c,
          chairperson: c.members.find((m) => m.role === CHAIR) ?? null,
          internalCount: c.members.filter((m) => m.evaluator?.affiliation === 'INTERNAL').length,
          externalCount: c.members.filter((m) => m.evaluator?.affiliation === 'EXTERNAL').length,
          memberCount: c.members.length,
          // Derived, never stored: a stored flag goes stale the moment a
          // member leaves or the mandate itself is edited.
          compliance: MandatesService.evaluateCompliance(c.mandate ?? null, membersFor(c.members)),
          isCurrentlyValid: c.status === 'ACTIVE' && now >= from && now <= until,
        };
      }),
      total: committees.length,
    };
  }

  static async getById(id: string) {
    const committee = await prisma.committee.findUnique({
      where: { id },
      include: {
        ...fullInclude,
        // The full record shows past members too, which is the committee's
        // own history - section 36 lists "Committee History" as a screen.
        members: { include: memberInclude, orderBy: [{ joinedAt: 'desc' }] },
      },
    });
    if (!committee) throw new NotFoundError('Committee not found');
    return committee;
  }

  static async create(
    input: {
      name: string;
      type: string;
      schemeId?: string | null;
      mandateId?: string | null;
      purpose?: string | null;
      validFrom?: string | null;
      validUntil?: string | null;
      remarks?: string | null;
      status?: string;
      members?: Array<{ evaluatorId: string; role?: string; remarks?: string | null; expertCategories?: string[] }>;
    },
    actorId: string,
  ) {
    this.assertValidityOrder(input.validFrom, input.validUntil);
    const members = this.dedupeMembers(input.members);

    const committee = await prisma.committee.create({
      data: {
        name: input.name.trim(),
        type: input.type as any,
        schemeId: input.schemeId || null,
        mandateId: input.mandateId || null,
        purpose: input.purpose ?? null,
        validFrom: input.validFrom ? new Date(input.validFrom) : null,
        validUntil: input.validUntil ? new Date(input.validUntil) : null,
        remarks: input.remarks ?? null,
        status: (input.status as any) ?? 'ACTIVE',
        createdBy: actorId,
        ...(members.length
          ? {
              members: {
                create: members.map((m) => ({
                  evaluatorId: m.evaluatorId,
                  role: (m.role as any) ?? 'MEMBER',
                  remarks: m.remarks ?? null,
                  // One or two categories, named per membership. Required when a
                  // seat is created: a member counting towards nothing cannot be
                  // checked against the scheme's mandate at all.
                  expertCategories: sanitiseMemberCategories(
                    m.expertCategories,
                    `Expert category for member ${members.indexOf(m) + 1}`,
                  ),
                })),
              },
            }
          : {}),
      },
      include: fullInclude,
    });

    return committee;
  }

  static async update(
    id: string,
    input: {
      name?: string;
      type?: string;
      schemeId?: string | null;
      mandateId?: string | null;
      purpose?: string | null;
      validFrom?: string | null;
      validUntil?: string | null;
      remarks?: string | null;
      status?: string;
    },
  ) {
    const existing = await prisma.committee.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundError('Committee not found');

    this.assertValidityOrder(input.validFrom, input.validUntil);

    return prisma.committee.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.type !== undefined ? { type: input.type as any } : {}),
        ...(input.schemeId !== undefined ? { schemeId: input.schemeId || null } : {}),
        ...(input.mandateId !== undefined ? { mandateId: input.mandateId || null } : {}),
        ...(input.purpose !== undefined ? { purpose: input.purpose } : {}),
        ...(input.validFrom !== undefined
          ? { validFrom: input.validFrom ? new Date(input.validFrom) : null }
          : {}),
        ...(input.validUntil !== undefined
          ? { validUntil: input.validUntil ? new Date(input.validUntil) : null }
          : {}),
        ...(input.remarks !== undefined ? { remarks: input.remarks } : {}),
        ...(input.status !== undefined ? { status: input.status as any } : {}),
      },
      include: fullInclude,
    });
  }

  /** Soft delete, so a committee that has already evaluated stays referenceable. */
  static async remove(id: string) {
    const existing = await prisma.committee.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundError('Committee not found');
    await prisma.committee.delete({ where: { id } });
    return { id };
  }

  // ── Members ───────────────────────────────────────────────────────────────

  static async addMembers(
    committeeId: string,
    members: Array<{ evaluatorId: string; role?: string; remarks?: string | null; expertCategories?: string[] }>,
  ) {
    const committee = await prisma.committee.findUnique({
      where: { id: committeeId },
      select: { id: true },
    });
    if (!committee) throw new NotFoundError('Committee not found');

    const wanted = this.dedupeMembers(members);
    if (wanted.length === 0) throw new BadRequestError('No members selected');

    const evaluators = await prisma.evaluator.findMany({
      where: { id: { in: wanted.map((m) => m.evaluatorId) } },
      select: { id: true },
    });
    const valid = new Set(evaluators.map((e) => e.id));

    // Someone already on the committee and never removed is not added again;
    // the unique constraint would reject it and take the whole batch with it.
    const existing = await prisma.committeeMember.findMany({
      where: { committeeId, evaluatorId: { in: Array.from(valid) } },
      select: { id: true, evaluatorId: true, leftAt: true },
    });
    const existingByEvaluator = new Map(existing.map((e) => [e.evaluatorId, e]));

    const added: string[] = [];
    const rejoined: string[] = [];
    const skipped: Array<{ evaluatorId: string; reason: string }> = [];

    for (const m of wanted) {
      if (!valid.has(m.evaluatorId)) {
        skipped.push({ evaluatorId: m.evaluatorId, reason: 'Evaluator not found' });
        continue;
      }
      const prior = existingByEvaluator.get(m.evaluatorId);
      if (prior && !prior.leftAt) {
        skipped.push({ evaluatorId: m.evaluatorId, reason: 'Already a member' });
        continue;
      }

      // Checked here so one bad selection is reported against that person
      // instead of rejecting everybody added in the same batch.
      let cats: string[];
      try {
        cats = sanitiseMemberCategories(m.expertCategories);
      } catch (e: any) {
        skipped.push({ evaluatorId: m.evaluatorId, reason: e?.message ?? 'Invalid expert category' });
        continue;
      }
      if (prior) {
        // Was a member before and left. The row is reinstated rather than
        // duplicated, because [committeeId, evaluatorId] is unique.
        await prisma.committeeMember.update({
          where: { id: prior.id },
          data: {
            leftAt: null,
            joinedAt: new Date(),
            role: (m.role as any) ?? 'MEMBER',
            remarks: m.remarks ?? null,
            expertCategories: cats,
          },
        });
        rejoined.push(m.evaluatorId);
        continue;
      }
      await prisma.committeeMember.create({
        data: {
          committeeId,
          evaluatorId: m.evaluatorId,
          role: (m.role as any) ?? 'MEMBER',
          remarks: m.remarks ?? null,
          expertCategories: cats,
        },
      });
      added.push(m.evaluatorId);
    }

    // A committee has one chair; if this batch named one, demote any other.
    const newChair = wanted.find((m) => m.role === CHAIR && valid.has(m.evaluatorId));
    if (newChair) await this.enforceSingleChair(committeeId, newChair.evaluatorId);

    return {
      addedCount: added.length,
      rejoinedCount: rejoined.length,
      skippedCount: skipped.length,
      skipped,
    };
  }

  static async updateMember(
    memberId: string,
    input: { role?: string; remarks?: string | null; expertCategories?: string[] },
  ) {
    const member = await prisma.committeeMember.findUnique({
      where: { id: memberId },
      select: { id: true, committeeId: true, evaluatorId: true },
    });
    if (!member) throw new NotFoundError('Committee member not found');

    const updated = await prisma.committeeMember.update({
      where: { id: memberId },
      data: {
        ...(input.role !== undefined ? { role: input.role as any } : {}),
        ...(input.remarks !== undefined ? { remarks: input.remarks } : {}),
        ...(input.expertCategories !== undefined
          ? { expertCategories: sanitiseMemberCategories(input.expertCategories) }
          : {}),
      },
      include: memberInclude,
    });

    if (input.role === CHAIR) {
      await this.enforceSingleChair(member.committeeId, member.evaluatorId);
    }
    return updated;
  }

  /**
   * Remove someone from a committee.
   *
   * Recorded as a leaving date rather than deleted: who sat on a committee
   * when is part of what makes an evaluation defensible later, and section 33
   * expects an evaluator's committee history to be available.
   */
  static async removeMember(memberId: string) {
    const member = await prisma.committeeMember.findUnique({
      where: { id: memberId },
      select: { id: true },
    });
    if (!member) throw new NotFoundError('Committee member not found');

    return prisma.committeeMember.update({
      where: { id: memberId },
      data: { leftAt: new Date() },
      include: memberInclude,
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private static async enforceSingleChair(committeeId: string, chairEvaluatorId: string) {
    await prisma.committeeMember.updateMany({
      where: {
        committeeId,
        role: CHAIR as any,
        leftAt: null,
        evaluatorId: { not: chairEvaluatorId },
      },
      data: { role: 'MEMBER' as any },
    });
  }

  private static assertValidityOrder(from?: string | null, until?: string | null) {
    if (!from || !until) return;
    const a = new Date(from).getTime();
    const b = new Date(until).getTime();
    if (Number.isNaN(a) || Number.isNaN(b)) return;
    if (b < a) throw new BadRequestError('Valid Until cannot be earlier than Valid From');
  }

  /** The picker can send the same evaluator twice; the unique index would not. */
  private static dedupeMembers(members?: Array<{ evaluatorId: string; role?: string; remarks?: string | null; expertCategories?: string[] }>) {
    const seen = new Map<
      string,
      { evaluatorId: string; role?: string; remarks?: string | null; expertCategories?: string[] }
    >();
    (members ?? []).forEach((m) => {
      if (!m?.evaluatorId) return;
      // A later entry wins, so naming someone chair after listing them as a
      // member does what it looks like it does.
      seen.set(m.evaluatorId, m);
    });
    return Array.from(seen.values());
  }
}

export default CommitteesService;
