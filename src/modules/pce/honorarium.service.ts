import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { BadRequestError, NotFoundError } from '../../common/utils/apiError';
import { LIVE } from './pce.constants';

/**
 * Sections 32 and 33: evaluator honorarium, and an evaluator's activity record.
 *
 * Total payable is stored rather than derived on read. Once something is paid,
 * editing the travel allowance must not silently change what the record says
 * was paid - so the total is computed on write and the parts are kept beside
 * it for the audit trail.
 *
 * Applications evaluated is likewise stored. It is suggested from the
 * evaluations actually submitted, but an operator can correct it: a jury member
 * may have heard an application that was later withdrawn, and they are still
 * owed for it.
 */

const SETTLED = new Set(['PAID']);

const evaluatorRef = {
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
} as const;

const schemeRef = { id: true, name: true, code: true } as const;

const evaluatorName = (e: any) =>
  [e?.firstName, e?.middleName, e?.lastName].filter(Boolean).join(' ').trim() || '—';

const money = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
};

export class HonorariumService {
  // ── Section 32 ────────────────────────────────────────────────────────────

  static async list(params: {
    search?: string;
    evaluatorId?: string;
    schemeId?: string;
    panelId?: string;
    status?: string;
    from?: string;
    to?: string;
  }) {
    const and: Prisma.EvaluatorHonorariumWhereInput[] = [{ evaluator: LIVE }];

    if (params.evaluatorId?.trim()) and.push({ evaluatorId: params.evaluatorId.trim() });
    if (params.schemeId?.trim()) and.push({ schemeId: params.schemeId.trim() });
    if (params.panelId?.trim()) and.push({ panelId: params.panelId.trim() });
    if (params.status?.trim()) and.push({ status: params.status.trim() as any });

    if (params.search?.trim()) {
      const q = params.search.trim();
      and.push({
        evaluator: {
          ...LIVE,
          OR: [
            { firstName: { contains: q, mode: 'insensitive' } },
            { lastName: { contains: q, mode: 'insensitive' } },
            { organization: { contains: q, mode: 'insensitive' } },
          ],
        },
      });
    }

    const range = this.dateRange(params.from, params.to);
    if (range) and.push({ pitchDate: range });

    const rows = await prisma.evaluatorHonorarium.findMany({
      where: { AND: and },
      select: {
        id: true,
        pitchDate: true,
        applicationsEvaluated: true,
        honorariumAmount: true,
        travelAllowance: true,
        otherAllowance: true,
        totalPayable: true,
        status: true,
        paymentDate: true,
        transactionRef: true,
        remarks: true,
        createdAt: true,
        updatedAt: true,
        evaluator: { select: evaluatorRef },
        scheme: { select: schemeRef },
        panel: { select: { id: true, name: true, pitchDate: true } },
      },
      orderBy: [{ pitchDate: 'desc' }, { createdAt: 'desc' }],
    });

    const items = rows.map((r) => ({ ...r, evaluatorName: evaluatorName(r.evaluator) }));

    // Totals over exactly what is listed, so the figures match the rows.
    const sum = (pick: (r: typeof items[number]) => number) =>
      Math.round(items.reduce((n, r) => n + pick(r), 0) * 100) / 100;

    return {
      items,
      total: items.length,
      totals: {
        honorarium: sum((r) => Number(r.honorariumAmount ?? 0)),
        travel: sum((r) => Number(r.travelAllowance ?? 0)),
        other: sum((r) => Number(r.otherAllowance ?? 0)),
        payable: sum((r) => Number(r.totalPayable ?? 0)),
        paid: sum((r) => (SETTLED.has(r.status) ? Number(r.totalPayable ?? 0) : 0)),
        outstanding: sum((r) => (SETTLED.has(r.status) ? 0 : Number(r.totalPayable ?? 0))),
      },
      counts: {
        pending: items.filter((r) => r.status === 'PENDING').length,
        processing: items.filter((r) => r.status === 'PROCESSING').length,
        paid: items.filter((r) => r.status === 'PAID').length,
        cancelled: items.filter((r) => r.status === 'CANCELLED').length,
      },
    };
  }

  /**
   * How many applications this evaluator actually evaluated, for the given
   * panel or scheme. Offered as a suggestion when raising a honorarium so the
   * figure is not typed from memory.
   */
  static async evaluatedCount(params: {
    evaluatorId: string;
    panelId?: string;
    schemeId?: string;
  }) {
    const where: Prisma.PitchEvaluationWhereInput = {
      evaluatorId: params.evaluatorId,
      state: { in: ['SUBMITTED', 'LOCKED'] },
      application: LIVE,
      ...(params.panelId ? { panelId: params.panelId } : {}),
      ...(params.schemeId
        ? {
            application: {
              ...LIVE,
              OR: [
                { pceState: { finalSchemeId: params.schemeId } },
                { pceState: { provisionalSchemeId: params.schemeId } },
              ],
            },
          }
        : {}),
    };
    const count = await prisma.pitchEvaluation.count({ where });
    return { count };
  }

  static async create(
    input: {
      evaluatorId: string;
      schemeId?: string | null;
      panelId?: string | null;
      pitchDate?: string | null;
      applicationsEvaluated?: number | null;
      honorariumAmount?: number | null;
      travelAllowance?: number | null;
      otherAllowance?: number | null;
      remarks?: string | null;
    },
    actorId: string,
  ) {
    const evaluator = await prisma.evaluator.findUnique({
      where: { id: input.evaluatorId },
      select: { id: true },
    });
    if (!evaluator) throw new NotFoundError('Evaluator not found');

    const honorarium = money(input.honorariumAmount);
    const travel = money(input.travelAllowance);
    const other = money(input.otherAllowance);

    if (honorarium + travel + other <= 0) {
      throw new BadRequestError('Enter at least one amount before raising a payment');
    }

    return prisma.evaluatorHonorarium.create({
      data: {
        evaluatorId: input.evaluatorId,
        schemeId: input.schemeId || null,
        panelId: input.panelId || null,
        pitchDate: input.pitchDate ? new Date(input.pitchDate) : null,
        applicationsEvaluated: Math.max(0, Number(input.applicationsEvaluated) || 0),
        honorariumAmount: honorarium,
        travelAllowance: travel,
        otherAllowance: other,
        // Computed here, never on read.
        totalPayable: Math.round((honorarium + travel + other) * 100) / 100,
        remarks: input.remarks ?? null,
        createdBy: actorId,
      },
      select: { id: true, totalPayable: true },
    });
  }

  static async update(
    id: string,
    input: {
      schemeId?: string | null;
      panelId?: string | null;
      pitchDate?: string | null;
      applicationsEvaluated?: number | null;
      honorariumAmount?: number | null;
      travelAllowance?: number | null;
      otherAllowance?: number | null;
      remarks?: string | null;
    },
  ) {
    const existing = await prisma.evaluatorHonorarium.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        honorariumAmount: true,
        travelAllowance: true,
        otherAllowance: true,
      },
    });
    if (!existing) throw new NotFoundError('Payment record not found');

    const touchesAmounts =
      input.honorariumAmount !== undefined ||
      input.travelAllowance !== undefined ||
      input.otherAllowance !== undefined;

    // A paid record is a statement of what was paid. Correcting the amounts
    // afterwards would make it disagree with the transaction it references.
    if (touchesAmounts && SETTLED.has(existing.status)) {
      throw new BadRequestError(
        'This payment is already marked paid, so its amounts cannot be changed. Cancel it and raise a new one if it was wrong.',
      );
    }

    const honorarium =
      input.honorariumAmount !== undefined
        ? money(input.honorariumAmount)
        : Number(existing.honorariumAmount ?? 0);
    const travel =
      input.travelAllowance !== undefined
        ? money(input.travelAllowance)
        : Number(existing.travelAllowance ?? 0);
    const other =
      input.otherAllowance !== undefined
        ? money(input.otherAllowance)
        : Number(existing.otherAllowance ?? 0);

    return prisma.evaluatorHonorarium.update({
      where: { id },
      data: {
        ...(input.schemeId !== undefined ? { schemeId: input.schemeId || null } : {}),
        ...(input.panelId !== undefined ? { panelId: input.panelId || null } : {}),
        ...(input.pitchDate !== undefined
          ? { pitchDate: input.pitchDate ? new Date(input.pitchDate) : null }
          : {}),
        ...(input.applicationsEvaluated !== undefined
          ? { applicationsEvaluated: Math.max(0, Number(input.applicationsEvaluated) || 0) }
          : {}),
        ...(touchesAmounts
          ? {
              honorariumAmount: honorarium,
              travelAllowance: travel,
              otherAllowance: other,
              totalPayable: Math.round((honorarium + travel + other) * 100) / 100,
            }
          : {}),
        ...(input.remarks !== undefined ? { remarks: input.remarks } : {}),
      },
      select: { id: true, totalPayable: true },
    });
  }

  /** Section 36's Pending / Processing / Paid progression. */
  static async setStatus(
    id: string,
    input: { status: string; paymentDate?: string | null; transactionRef?: string | null },
  ) {
    const existing = await prisma.evaluatorHonorarium.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!existing) throw new NotFoundError('Payment record not found');

    // A transaction reference is what makes "paid" verifiable later.
    if (input.status === 'PAID' && !input.transactionRef?.trim()) {
      throw new BadRequestError('A UTR or transaction reference is required to mark a payment paid');
    }

    return prisma.evaluatorHonorarium.update({
      where: { id },
      data: {
        status: input.status as any,
        transactionRef: input.transactionRef?.trim() || null,
        paymentDate:
          input.status === 'PAID'
            ? input.paymentDate
              ? new Date(input.paymentDate)
              : new Date()
            : null,
      },
      select: { id: true, status: true, paymentDate: true },
    });
  }

  static async remove(id: string) {
    const existing = await prisma.evaluatorHonorarium.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!existing) throw new NotFoundError('Payment record not found');
    if (SETTLED.has(existing.status)) {
      throw new BadRequestError(
        'A paid record cannot be deleted. Mark it cancelled instead so the payment history stays intact.',
      );
    }
    await prisma.evaluatorHonorarium.delete({ where: { id } });
    return { id };
  }

  // ── Section 33: evaluator activity history ────────────────────────────────

  /**
   * One evaluator's whole involvement: committees, panels, pitch sessions,
   * what they scored and what they were paid.
   */
  static async activity(evaluatorId: string) {
    const evaluator = await prisma.evaluator.findUnique({
      where: { id: evaluatorId },
      select: {
        ...evaluatorRef,
        sectors: true,
        status: true,
        committeeSeats: {
          select: {
            id: true,
            role: true,
            joinedAt: true,
            leftAt: true,
            committee: {
              select: {
                id: true,
                name: true,
                type: true,
                status: true,
                scheme: { select: schemeRef },
              },
            },
          },
          orderBy: { joinedAt: 'desc' },
        },
        panelSeats: {
          select: {
            id: true,
            role: true,
            panel: {
              select: {
                id: true,
                name: true,
                status: true,
                pitchDate: true,
                session: true,
                evaluationStage: true,
                scheme: { select: schemeRef },
                _count: { select: { allocations: true } },
              },
            },
          },
        },
        pitchEvaluations: {
          select: {
            id: true,
            totalScore: true,
            recommendation: true,
            state: true,
            submittedAt: true,
            grantRecommended: true,
            recommendedGrantAmount: true,
            recommendedScheme: { select: schemeRef },
            panel: { select: { id: true, name: true } },
            application: {
              select: { id: true, applicationNo: true, startupName: true, mainSector: true },
            },
            schedule: { select: { presentationDate: true, session: true } },
          },
          orderBy: { updatedAt: 'desc' },
        },
        honorariums: {
          select: {
            id: true,
            pitchDate: true,
            totalPayable: true,
            status: true,
            paymentDate: true,
            transactionRef: true,
            scheme: { select: schemeRef },
            panel: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!evaluator) throw new NotFoundError('Evaluator not found');

    const counted = (evaluator.pitchEvaluations ?? []).filter(
      (e) => e.state === 'SUBMITTED' || e.state === 'LOCKED',
    );
    const scores = counted.map((e) => Number(e.totalScore)).filter((n) => Number.isFinite(n));

    // Schemes they have touched, from every direction - committees, panels and
    // the applications they scored.
    const schemes = new Map<string, any>();
    const addScheme = (s: any) => {
      if (s?.id) schemes.set(s.id, s);
    };
    (evaluator.committeeSeats ?? []).forEach((c) => addScheme(c.committee?.scheme));
    (evaluator.panelSeats ?? []).forEach((p) => addScheme(p.panel?.scheme));

    const paid = (evaluator.honorariums ?? []).filter((h) => h.status === 'PAID');

    return {
      evaluator: { ...evaluator, fullName: evaluatorName(evaluator) },
      summary: {
        committees: (evaluator.committeeSeats ?? []).length,
        activeCommittees: (evaluator.committeeSeats ?? []).filter((c) => !c.leftAt).length,
        panels: (evaluator.panelSeats ?? []).length,
        schemes: schemes.size,
        /** Distinct pitching days they sat on. */
        pitchingSessions: new Set(
          (evaluator.panelSeats ?? [])
            .map((p) => p.panel?.pitchDate)
            .filter(Boolean)
            .map((d) => new Date(d as Date).toDateString()),
        ).size,
        applicationsEvaluated: counted.length,
        evaluationsInProgress:
          (evaluator.pitchEvaluations ?? []).length - counted.length,
        averageScoreGiven: scores.length
          ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
          : null,
        schemeRecommendations: counted.filter((e) => e.recommendedScheme).length,
        grantRecommendations: counted.filter((e) => e.grantRecommended).length,
        totalPaid: Math.round(paid.reduce((n, h) => n + Number(h.totalPayable ?? 0), 0) * 100) / 100,
        totalOutstanding:
          Math.round(
            (evaluator.honorariums ?? [])
              .filter((h) => h.status === 'PENDING' || h.status === 'PROCESSING')
              .reduce((n, h) => n + Number(h.totalPayable ?? 0), 0) * 100,
          ) / 100,
      },
      schemes: Array.from(schemes.values()),
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  static dateRange(from?: string, to?: string) {
    const gte = from ? new Date(from) : null;
    const lte = to ? new Date(to) : null;
    if (gte && !Number.isNaN(gte.getTime())) gte.setHours(0, 0, 0, 0);
    if (lte && !Number.isNaN(lte.getTime())) lte.setHours(23, 59, 59, 999);
    const valid = (d: Date | null) => !!d && !Number.isNaN(d.getTime());
    if (!valid(gte) && !valid(lte)) return undefined;
    return {
      ...(valid(gte) ? { gte: gte as Date } : {}),
      ...(valid(lte) ? { lte: lte as Date } : {}),
    };
  }
}

export default HonorariumService;
