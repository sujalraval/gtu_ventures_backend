import prisma from '../../lib/prisma';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../common/utils/apiError';
import { sendEmail } from '../../common/utils/mailer';
import { sanitiseCategories } from './expertCategories';

/**
 * Evaluator portal access, and the evaluator's own profile.
 *
 * Access is granted by an administrator, never self-registered: requestOTP only
 * auto-creates accounts for the startup portal, and the EVALUATOR portal is
 * gated on an existing user for exactly this reason.
 *
 * No password is set here. verifyOTP needs none, so an evaluator can sign in by
 * email code the moment access is granted, and may set a password later through
 * the existing forgot-password flow. Generating one and emailing it would put a
 * credential in an inbox for no benefit.
 */

/** What an evaluator may change about their own record. */
const SELF_EDITABLE = [
  'firstName',
  'middleName',
  'lastName',
  'mobile',
  'personalEmail',
  'organization',
  'designation',
  'city',
  'state',
  'country',
  'areaOfExpertise',
  'industryExperience',
  'academicExpertise',
  'specialization',
  'shortProfile',
] as const;

const profileSelect = {
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
  createdAt: true,
  updatedAt: true,
} as const;

const fullName = (e: any) =>
  [e?.firstName, e?.middleName, e?.lastName].filter(Boolean).join(' ').trim() || '—';

export class EvaluatorAccessService {
  // ── Administrator side ────────────────────────────────────────────────────

  /**
   * Give an evaluator a login.
   *
   * Reuses an existing User when one already has that email - an internal
   * expert who is already a staff member should not end up with two accounts -
   * and only creates one when there is none.
   */
  static async grant(evaluatorId: string, opts: { notify?: boolean } = {}) {
    const evaluator = await prisma.evaluator.findUnique({
      where: { id: evaluatorId },
      select: {
        id: true,
        userId: true,
        firstName: true,
        middleName: true,
        lastName: true,
        officialEmail: true,
        personalEmail: true,
        status: true,
      },
    });
    if (!evaluator) throw new NotFoundError('Evaluator not found');
    if (evaluator.userId) {
      return { alreadyGranted: true, userId: evaluator.userId };
    }
    if (evaluator.status !== 'ACTIVE') {
      throw new BadRequestError('Only an active evaluator can be given portal access.');
    }

    const email = (evaluator.officialEmail || evaluator.personalEmail || '').trim().toLowerCase();
    if (!email) {
      throw new BadRequestError(
        'This evaluator has no email address, so there is nothing to sign in with.',
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, role: true, name: true },
    });

    let userId: string;
    let reusedExisting = false;

    if (existingUser) {
      // Their role is left alone on purpose: demoting a staff member to EXPERT
      // because they also sit on a jury would cost them their real access.
      userId = existingUser.id;
      reusedExisting = true;
    } else {
      const created = await prisma.user.create({
        data: { email, name: fullName(evaluator), role: 'EXPERT' },
        select: { id: true },
      });
      userId = created.id;
    }

    // One evaluator record per user: the column is unique, so a clash means
    // this user is already another evaluator.
    try {
      await prisma.evaluator.update({ where: { id: evaluatorId }, data: { userId } });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new BadRequestError(
          'That email is already linked to a different evaluator record.',
        );
      }
      throw e;
    }

    if (opts.notify !== false) {
      await this.sendAccessEmail(email, fullName(evaluator)).catch(() => undefined);
    }

    return { alreadyGranted: false, userId, reusedExistingUser: reusedExisting, email };
  }

  /**
   * Remove portal access.
   *
   * Unlinks rather than deleting the user: their evaluations stay attributed,
   * and a user who is also staff keeps the account they log in with.
   */
  static async revoke(evaluatorId: string) {
    const evaluator = await prisma.evaluator.findUnique({
      where: { id: evaluatorId },
      select: { id: true, userId: true },
    });
    if (!evaluator) throw new NotFoundError('Evaluator not found');
    if (!evaluator.userId) return { alreadyRevoked: true };

    await prisma.evaluator.update({ where: { id: evaluatorId }, data: { userId: null } });
    return { alreadyRevoked: false };
  }

  private static async sendAccessEmail(email: string, name: string) {
    const base = (process.env.APP_URL || '').replace(/\/$/, '');
    const link = base ? `${base}/evaluator/login` : 'the evaluator portal';
    const html = `
<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:560px;color:#0f172a">
  <p>Dear ${name},</p>
  <p>
    You have been given access to the GUSEC evaluator portal, where you can see
    the pitches you are assigned to and record your evaluations.
  </p>
  <p>
    Sign in with this email address at
    ${base ? `<a href="${link}">${link}</a>` : '<strong>the evaluator portal</strong>'}.
    Choose "Email code" and we will send you a one-time code &mdash; no password
    is needed. You can set one later if you prefer.
  </p>
  <p style="color:#64748b;font-size:12px;margin-top:20px">
    If you were not expecting this, you can ignore it; nothing happens until you
    sign in.
  </p>
</div>`.trim();
    await sendEmail(email, 'Your GUSEC evaluator portal access', html);
  }

  // ── Evaluator's own profile ───────────────────────────────────────────────

  /** The Evaluator record behind the signed-in user. */
  private static async self(userId: string) {
    const evaluator = await prisma.evaluator.findFirst({
      where: { userId, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!evaluator) {
      throw new ForbiddenError(
        'Your account is not linked to an evaluator record. Contact the incubation team.',
      );
    }
    return evaluator;
  }

  static async getMyProfile(userId: string) {
    const { id } = await this.self(userId);
    const [evaluator, documents, bank] = await Promise.all([
      prisma.evaluator.findUnique({ where: { id }, select: profileSelect }),
      prisma.evaluatorDocument.findMany({
        where: { evaluatorId: id, deletedAt: null },
        orderBy: { uploadedAt: 'desc' },
      }),
      prisma.evaluatorBankDetail.findUnique({ where: { evaluatorId: id } }),
    ]);

    return {
      ...evaluator,
      fullName: fullName(evaluator),
      documents,
      // Their own payment details, shown in full: they are the owner of this
      // data, and the pce_evaluator_bank permission governs who *else* sees it.
      bankDetail: bank ? { ...bank, masked: false } : null,
    };
  }

  /**
   * Update own profile.
   *
   * Only the fields in SELF_EDITABLE. Deliberately excluded: affiliation, type,
   * expertCategories, status and the official email - those decide which
   * committee mandates this person satisfies and whether they can act at all,
   * so they stay with the administrator rather than with the evaluator.
   */
  static async updateMyProfile(userId: string, input: Record<string, any>) {
    const { id } = await this.self(userId);

    const data: Record<string, any> = {};
    for (const key of SELF_EDITABLE) {
      if (input[key] === undefined) continue;
      const value = typeof input[key] === 'string' ? input[key].trim() : input[key];
      data[key] = value === '' ? null : value;
    }

    // Sectors are a claim about their own expertise, so they may set them; the
    // mandate categories derived from them are not.
    if (Array.isArray(input.sectors)) {
      data.sectors = input.sectors.filter(Boolean);
    }
    if (input.expertCategories !== undefined) {
      // Silently ignored rather than rejected: a client sending the whole
      // profile back should not fail, but must not be able to widen which
      // mandates it satisfies.
      delete data.expertCategories;
    }

    if (!data.firstName && input.firstName !== undefined) {
      throw new BadRequestError('First name cannot be empty');
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestError('Nothing to update');
    }

    await prisma.evaluator.update({ where: { id }, data });
    return this.getMyProfile(userId);
  }

  /** Their own bank details. The payee maintains these. */
  static async saveMyBankDetail(userId: string, input: Record<string, any>) {
    const { id } = await this.self(userId);

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
      updatedBy: userId,
    };

    const saved = await prisma.evaluatorBankDetail.upsert({
      where: { evaluatorId: id },
      create: { evaluatorId: id, ...data },
      update: data,
    });
    return { ...saved, masked: false };
  }

  static async addMyDocument(
    userId: string,
    input: { type?: string; title?: string | null; fileName?: string | null; fileUrl: string },
  ) {
    const { id } = await this.self(userId);
    if (!input.fileUrl?.trim()) throw new BadRequestError('Upload a file first');

    return prisma.evaluatorDocument.create({
      data: {
        evaluatorId: id,
        type: (input.type as any) ?? 'OTHER',
        title: input.title ?? null,
        fileName: input.fileName ?? null,
        fileUrl: input.fileUrl.trim(),
        uploadedBy: userId,
      },
    });
  }

  /** Only their own, so one evaluator cannot remove another's paperwork. */
  static async removeMyDocument(userId: string, documentId: string) {
    const { id } = await this.self(userId);
    const doc = await prisma.evaluatorDocument.findFirst({
      where: { id: documentId, evaluatorId: id },
      select: { id: true },
    });
    if (!doc) throw new NotFoundError('Document not found');

    await prisma.evaluatorDocument.delete({ where: { id: documentId } });
    return { id: documentId };
  }

  /** Exposed for the admin form, which may set categories. */
  static sanitiseCategories = sanitiseCategories;
}

export default EvaluatorAccessService;
