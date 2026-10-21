import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { BadRequestError, NotFoundError } from '../../common/utils/apiError';
import { LIVE } from './pce.constants';
import { sanitiseCategories } from './expertCategories';

/**
 * Sections 12-14: the evaluator / expert master.
 *
 * Collected once and reused, which is why this is a master record rather than
 * details re-entered per panel.
 *
 * An Evaluator is not a User. Most are external experts who must never get a
 * portal login, and creating User rows for them would put outsiders into the
 * admin user lists and the role system. userId is therefore optional and set
 * only when portal access is deliberately granted (section 16, a later phase).
 *
 * Bank and payment details (section 13) live in their own table and are only
 * ever returned to a caller holding the pce_evaluator_bank permission. The
 * service is the gate, not the UI - hiding a field on a page still ships it in
 * the response.
 */

/** Everything except the bank detail, which is fetched deliberately. */
const listSelect = {
  id: true,
  code: true,
  userId: true,
  firstName: true,
  middleName: true,
  lastName: true,
  mobile: true,
  personalEmail: true,
  officialEmail: true,
  organization: true,
  designation: true,
  affiliation: true,
  type: true,
  city: true,
  state: true,
  country: true,
  sectors: true,
  expertCategories: true,
  areaOfExpertise: true,
  industryExperience: true,
  academicExpertise: true,
  specialization: true,
  shortProfile: true,
  status: true,
  remarks: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.EvaluatorSelect;

const fullName = (e: { firstName: string; middleName?: string | null; lastName?: string | null }) =>
  [e.firstName, e.middleName, e.lastName].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

/**
 * Last four digits only.
 *
 * What gets returned when the caller may see that an account exists but not
 * what it is - enough to confirm a record is on file, not enough to transact.
 */
const maskTail = (v?: string | null, keep = 4) => {
  const s = String(v ?? '').trim();
  if (!s) return null;
  if (s.length <= keep) return '•'.repeat(s.length);
  return `${'•'.repeat(Math.min(8, s.length - keep))}${s.slice(-keep)}`;
};

export class EvaluatorsService {
  static async list(params: {
    search?: string;
    affiliation?: string;
    type?: string;
    status?: string;
    sector?: string;
  }) {
    const and: Prisma.EvaluatorWhereInput[] = [LIVE];

    if (params.search?.trim()) {
      const q = params.search.trim();
      and.push({
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { organization: { contains: q, mode: 'insensitive' } },
          { officialEmail: { contains: q, mode: 'insensitive' } },
          { personalEmail: { contains: q, mode: 'insensitive' } },
          { mobile: { contains: q, mode: 'insensitive' } },
          { code: { contains: q, mode: 'insensitive' } },
        ],
      });
    }
    if (params.affiliation?.trim()) and.push({ affiliation: params.affiliation.trim() as any });
    if (params.type?.trim()) and.push({ type: params.type.trim() as any });
    if (params.status?.trim()) and.push({ status: params.status.trim() as any });
    if (params.sector?.trim()) and.push({ sectors: { has: params.sector.trim() } });

    const rows = await prisma.evaluator.findMany({
      where: { AND: and },
      select: {
        ...listSelect,
        _count: { select: { documents: true, committeeSeats: true, panelSeats: true } },
        // Whether payment details exist at all is not itself sensitive, and
        // the list needs it to show which records are incomplete.
        bankDetail: { select: { id: true, updatedAt: true } },
      },
      orderBy: [{ firstName: 'asc' }],
    });

    return {
      items: rows.map((e) => ({
        ...e,
        fullName: fullName(e),
        hasBankDetail: !!e.bankDetail,
        bankDetail: undefined,
      })),
      total: rows.length,
    };
  }

  static async getById(id: string, canSeeBank: boolean) {
    const evaluator = await prisma.evaluator.findUnique({
      where: { id },
      select: {
        ...listSelect,
        documents: {
          where: { deletedAt: null },
          orderBy: { uploadedAt: 'desc' },
        },
        committeeSeats: {
          include: {
            committee: {
              select: {
                id: true,
                name: true,
                type: true,
                status: true,
                scheme: { select: { id: true, name: true, code: true } },
              },
            },
          },
          orderBy: { joinedAt: 'desc' },
        },
        bankDetail: true,
      },
    });
    if (!evaluator) throw new NotFoundError('Evaluator not found');

    return {
      ...evaluator,
      fullName: fullName(evaluator),
      hasBankDetail: !!evaluator.bankDetail,
      bankDetail: this.presentBank(evaluator.bankDetail, canSeeBank),
    };
  }

  static async create(
    input: Record<string, any>,
    actorId: string,
  ) {
    if (!input.firstName?.trim()) throw new BadRequestError('First name is required');

    // At least one way to reach them, or the record cannot be used to invite
    // anyone to anything.
    if (!input.officialEmail?.trim() && !input.personalEmail?.trim() && !input.mobile?.trim()) {
      throw new BadRequestError('Provide at least a mobile number or an email address');
    }

    try {
      return await prisma.evaluator.create({
        data: {
          ...this.writableFields(input),
          // Stated again so the required field is present for the type, not
          // merely likely to be: writableFields only copies what was sent.
          firstName: input.firstName.trim(),
          code: input.code?.trim() || null,
          createdBy: actorId,
        },
        select: listSelect,
      });
    } catch (e: any) {
      this.rethrowCodeClash(e, input.code);
    }
  }

  static async update(id: string, input: Record<string, any>) {
    const existing = await prisma.evaluator.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundError('Evaluator not found');

    try {
      return await prisma.evaluator.update({
        where: { id },
        data: {
          ...this.writableFields(input),
          ...(input.code !== undefined ? { code: input.code?.trim() || null } : {}),
        },
        select: listSelect,
      });
    } catch (e: any) {
      this.rethrowCodeClash(e, input.code);
    }
  }

  /** Soft delete: an evaluator who has scored something must stay resolvable. */
  static async remove(id: string) {
    const existing = await prisma.evaluator.findUnique({
      where: { id },
      select: { id: true, _count: { select: { pitchEvaluations: true } } },
    });
    if (!existing) throw new NotFoundError('Evaluator not found');

    await prisma.evaluator.delete({ where: { id } });
    return { id, hadEvaluations: existing._count.pitchEvaluations > 0 };
  }

  // ── Section 13: bank and payment details ──────────────────────────────────

  /**
   * Returned shape depends on the caller's rights.
   *
   * Without pce_evaluator_bank the figures are masked rather than omitted, so
   * the UI can still say a record is on file without disclosing it.
   */
  private static presentBank(bank: any, canSee: boolean) {
    if (!bank) return null;
    if (canSee) return { ...bank, masked: false };
    return {
      id: bank.id,
      evaluatorId: bank.evaluatorId,
      accountHolderName: bank.accountHolderName ?? null,
      bankName: bank.bankName ?? null,
      branch: bank.branch ?? null,
      accountType: bank.accountType ?? null,
      accountNumber: maskTail(bank.accountNumber),
      ifscCode: maskTail(bank.ifscCode, 3),
      pan: maskTail(bank.pan, 4),
      gstNumber: maskTail(bank.gstNumber, 4),
      upiId: null,
      paymentRemarks: null,
      updatedAt: bank.updatedAt,
      masked: true,
    };
  }

  static async getBankDetail(evaluatorId: string, canSeeBank: boolean) {
    const evaluator = await prisma.evaluator.findUnique({
      where: { id: evaluatorId },
      select: { id: true, bankDetail: true },
    });
    if (!evaluator) throw new NotFoundError('Evaluator not found');
    return this.presentBank(evaluator.bankDetail, canSeeBank);
  }

  static async upsertBankDetail(evaluatorId: string, input: Record<string, any>, actorId: string) {
    const evaluator = await prisma.evaluator.findUnique({
      where: { id: evaluatorId },
      select: { id: true },
    });
    if (!evaluator) throw new NotFoundError('Evaluator not found');

    const data = {
      accountHolderName: input.accountHolderName?.trim() || null,
      bankName: input.bankName?.trim() || null,
      accountNumber: input.accountNumber?.trim() || null,
      ifscCode: input.ifscCode?.trim()?.toUpperCase() || null,
      branch: input.branch?.trim() || null,
      accountType: input.accountType?.trim() || null,
      pan: input.pan?.trim()?.toUpperCase() || null,
      gstNumber: input.gstNumber?.trim()?.toUpperCase() || null,
      upiId: input.upiId?.trim() || null,
      paymentRemarks: input.paymentRemarks ?? null,
      updatedBy: actorId,
    };

    const saved = await prisma.evaluatorBankDetail.upsert({
      where: { evaluatorId },
      create: { evaluatorId, ...data },
      update: data,
    });

    // The caller just wrote it, so it is theirs to read back in full.
    return { ...saved, masked: false };
  }

  // ── Section 14: documents ─────────────────────────────────────────────────

  static async addDocument(
    evaluatorId: string,
    input: {
      type?: string;
      title?: string | null;
      fileName?: string | null;
      fileUrl: string;
      fileSize?: number | null;
      mimeType?: string | null;
    },
    actorId: string,
  ) {
    const evaluator = await prisma.evaluator.findUnique({
      where: { id: evaluatorId },
      select: { id: true },
    });
    if (!evaluator) throw new NotFoundError('Evaluator not found');
    if (!input.fileUrl?.trim()) throw new BadRequestError('Upload a file first');

    return prisma.evaluatorDocument.create({
      data: {
        evaluatorId,
        type: (input.type as any) ?? 'OTHER',
        title: input.title ?? null,
        fileName: input.fileName ?? null,
        fileUrl: input.fileUrl.trim(),
        fileSize: input.fileSize ?? null,
        mimeType: input.mimeType ?? null,
        uploadedBy: actorId,
      },
    });
  }

  static async removeDocument(documentId: string) {
    const doc = await prisma.evaluatorDocument.findUnique({
      where: { id: documentId },
      select: { id: true },
    });
    if (!doc) throw new NotFoundError('Document not found');
    await prisma.evaluatorDocument.delete({ where: { id: documentId } });
    return { id: documentId };
  }

  /** Section 36: the Evaluator Documents screen, across every evaluator. */
  static async listDocuments(params: { evaluatorId?: string; type?: string }) {
    const rows = await prisma.evaluatorDocument.findMany({
      where: {
        deletedAt: null,
        ...(params.evaluatorId ? { evaluatorId: params.evaluatorId } : {}),
        ...(params.type ? { type: params.type as any } : {}),
        // A document belonging to a deleted evaluator should not be listed.
        evaluator: LIVE,
      },
      include: {
        evaluator: {
          select: {
            id: true,
            firstName: true,
            middleName: true,
            lastName: true,
            affiliation: true,
            organization: true,
          },
        },
      },
      orderBy: { uploadedAt: 'desc' },
    });

    return {
      items: rows.map((d) => ({
        ...d,
        evaluatorName: d.evaluator ? fullName(d.evaluator) : '—',
      })),
      total: rows.length,
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Only the fields a caller is allowed to set.
   *
   * Spreading the request body into Prisma would let a caller set userId and
   * hand an external expert a portal account, or move the record's audit
   * fields. Everything writable is named here.
   */
  private static writableFields(input: Record<string, any>) {
    const text = (v: unknown) => {
      const s = typeof v === 'string' ? v.trim() : v;
      return s === '' ? null : (s as any);
    };
    const out: Record<string, any> = {};
    const assign = (key: string, value: any) => {
      if (input[key] !== undefined) out[key] = value;
    };

    assign('firstName', String(input.firstName ?? '').trim());
    assign('middleName', text(input.middleName));
    assign('lastName', text(input.lastName));
    assign('mobile', text(input.mobile));
    assign('personalEmail', text(input.personalEmail)?.toLowerCase?.() ?? null);
    assign('officialEmail', text(input.officialEmail)?.toLowerCase?.() ?? null);
    assign('organization', text(input.organization));
    assign('designation', text(input.designation));
    assign('affiliation', input.affiliation);
    assign('type', input.type);
    assign('city', text(input.city));
    assign('state', text(input.state));
    assign('country', text(input.country));
    assign('sectors', Array.isArray(input.sectors) ? input.sectors.filter(Boolean) : undefined);
    // Validated against the shared vocabulary, so an unknown category cannot
    // be stored and then never satisfy any mandate.
    assign('expertCategories', sanitiseCategories(input.expertCategories));
    assign('areaOfExpertise', text(input.areaOfExpertise));
    assign('industryExperience', text(input.industryExperience));
    assign('academicExpertise', text(input.academicExpertise));
    assign('specialization', text(input.specialization));
    assign('shortProfile', text(input.shortProfile));
    assign('status', input.status);
    assign('remarks', text(input.remarks));

    // Guard against an empty update wiping the required name.
    if (out.firstName === '') delete out.firstName;
    if (out.sectors === undefined) delete out.sectors;
    // Only sent when the caller actually supplied the field, so a partial
    // update cannot blank an evaluator's categories by omission.
    if (input.expertCategories === undefined) delete out.expertCategories;

    return out;
  }

  /**
   * Translate the unique-index violation on `code` into something readable.
   *
   * Checked by the database rather than by a query first: Evaluator.code is
   * unique across every row including soft-deleted ones, so a pre-check that
   * filtered deleted rows out would miss a clash - and would still lose a race
   * between two concurrent creates.
   */
  private static rethrowCodeClash(e: any, code: unknown): never {
    const target = e?.meta?.target;
    const onCode = Array.isArray(target)
      ? target.includes('code')
      : String(target ?? '').includes('code');
    if (e?.code === 'P2002' && onCode) {
      throw new BadRequestError(
        `Evaluator code "${String(code ?? '').trim()}" is already in use`,
      );
    }
    throw e;
  }
}

export default EvaluatorsService;
