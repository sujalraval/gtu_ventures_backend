import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { BadRequestError, NotFoundError } from '../../common/utils/apiError';
import { PceService } from './pce.service';
import { LIVE, APPROVED_DECISIONS } from './pce.constants';

/**
 * Section 31: the final onboarding dashboard.
 *
 * The rule the spec closes on is enforced here and nowhere else matters:
 * nothing is marked Onboarding Completed without an approved final scheme on
 * record. It is checked at the moment of completion rather than only hidden in
 * the UI, because that is the state the whole module exists to guarantee.
 *
 * The document checklist is seeded from the scheme's own requiredDocuments, so
 * what an onboarding startup must produce comes from the scheme it was
 * approved under rather than a list hardcoded here.
 */

const APPROVED = new Set<string>(APPROVED_DECISIONS);

/** The sequence section 31 lays out. */
const SEQUENCE = [
  'NOT_STARTED',
  'SELECTED',
  'SCHEME_CONFIRMED',
  'DOCUMENTS_PENDING',
  'VERIFICATION_PENDING',
  'AGREEMENT_PENDING',
  'FINAL_APPROVAL_PENDING',
  'COMPLETED',
] as const;

const schemeRef = { id: true, name: true, code: true } as const;

const recordInclude = {
  documents: { where: { deletedAt: null }, orderBy: { uploadedAt: 'asc' } },
  application: {
    select: {
      id: true,
      applicationNo: true,
      startupName: true,
      fullName: true,
      primaryEmail: true,
      primaryMobile: true,
      mainSector: true,
      isRegistered: true,
      legalStatus: true,
      cin: true,
      pan: true,
      dpiitNumber: true,
      scheme: { select: schemeRef },
      pceState: {
        select: {
          schemeStatus: true,
          finalScheme: { select: schemeRef },
          provisionalScheme: { select: schemeRef },
        },
      },
      finalSelection: {
        select: {
          decision: true,
          finalScore: true,
          grantApproved: true,
          sanctionedGrantAmount: true,
          grantConditions: true,
          decidedAt: true,
          finalScheme: { select: schemeRef },
        },
      },
    },
  },
} satisfies Prisma.OnboardingRecordInclude;

export class OnboardingService {
  /** Section 31: the dashboard listing. */
  static async list(params: { search?: string; status?: string; schemeId?: string }) {
    const and: Prisma.OnboardingRecordWhereInput[] = [{ application: LIVE }];

    if (params.status?.trim()) {
      const v = params.status.trim();
      if (v === 'IN_PROGRESS_ANY') {
        and.push({
          status: {
            in: [
              'DOCUMENTS_PENDING',
              'VERIFICATION_PENDING',
              'AGREEMENT_PENDING',
              'FINAL_APPROVAL_PENDING',
            ] as any,
          },
        });
      } else if (v === 'PENDING_ANY') {
        and.push({ status: { in: ['NOT_STARTED', 'SELECTED', 'SCHEME_CONFIRMED'] as any } });
      } else {
        and.push({ status: v as any });
      }
    }
    if (params.search?.trim()) {
      const q = params.search.trim();
      and.push({
        application: {
          ...LIVE,
          OR: [
            { applicationNo: { contains: q, mode: 'insensitive' } },
            { startupName: { contains: q, mode: 'insensitive' } },
            { fullName: { contains: q, mode: 'insensitive' } },
          ],
        },
      });
    }
    if (params.schemeId?.trim()) {
      and.push({ application: { pceState: { finalSchemeId: params.schemeId.trim() } } });
    }

    const rows = await prisma.onboardingRecord.findMany({
      where: { AND: and },
      include: recordInclude,
      orderBy: { updatedAt: 'desc' },
    });

    const actorIds = rows
      .flatMap((r) => [r.verifiedBy, r.approvedBy, r.mentorId])
      .filter((v): v is string => !!v);
    const actors = await this.resolveActors(actorIds);

    return {
      items: rows.map((r) => this.present(r, actors)),
      total: rows.length,
    };
  }

  static async getByApplication(applicationId: string) {
    const record = await prisma.onboardingRecord.findUnique({
      where: { applicationId },
      include: recordInclude,
    });
    if (!record) throw new NotFoundError('This application has not entered onboarding');

    const actors = await this.resolveActors(
      [record.verifiedBy, record.approvedBy, record.mentorId].filter((v): v is string => !!v),
    );
    return this.present(record, actors);
  }

  /**
   * Begin onboarding, seeding the document checklist from the scheme.
   *
   * Only for an approved application: onboarding a startup the committee has
   * not selected would put a row on the dashboard that should not be there.
   */
  static async start(applicationId: string) {
    const application = await prisma.startupApplication.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        finalSelection: { select: { decision: true } },
        pceState: { select: { finalSchemeId: true, schemeStatus: true } },
      },
    });
    if (!application) throw new NotFoundError('Application not found');

    const decision = application.finalSelection?.decision;
    if (!decision || !APPROVED.has(decision)) {
      throw new BadRequestError(
        'Only an application approved by the final committee can begin onboarding.',
      );
    }

    const existing = await prisma.onboardingRecord.findUnique({
      where: { applicationId },
      select: { id: true, status: true, _count: { select: { documents: true } } },
    });

    const record =
      existing ??
      (await prisma.onboardingRecord.create({
        data: { applicationId, status: 'SELECTED' },
        select: { id: true, status: true, _count: { select: { documents: true } } },
      }));

    // Seeded once. Re-running must not duplicate a checklist an operator has
    // already been working through.
    if (record._count.documents === 0 && application.pceState?.finalSchemeId) {
      const scheme = await prisma.scheme.findUnique({
        where: { id: application.pceState.finalSchemeId },
        select: { requiredDocuments: true },
      });
      const required = Array.isArray(scheme?.requiredDocuments)
        ? (scheme!.requiredDocuments as Array<{ name?: string; mandatory?: boolean }>)
        : [];
      const rows = required
        .filter((d) => d?.name?.trim())
        .map((d) => ({
          onboardingId: record.id,
          name: String(d.name).trim(),
          isRequired: d.mandatory !== false,
        }));
      if (rows.length > 0) {
        await prisma.onboardingDocument.createMany({ data: rows });
      }
    }

    const next = record.status === 'NOT_STARTED' ? 'SELECTED' : record.status;
    await this.setStatus(applicationId, next as any);

    return this.getByApplication(applicationId);
  }

  static async update(
    applicationId: string,
    input: {
      status?: string;
      incubationStartDate?: string | null;
      mentorId?: string | null;
      agreementStatus?: string | null;
      kycVerified?: boolean;
      bankDetailsVerified?: boolean;
      registrationVerified?: boolean;
      remarks?: string | null;
    },
    actorId: string,
  ) {
    const record = await prisma.onboardingRecord.findUnique({
      where: { applicationId },
      select: { id: true, status: true },
    });
    if (!record) throw new NotFoundError('This application has not entered onboarding');

    // Completion has its own gate, so it cannot be reached by setting the
    // status directly.
    if (input.status === 'COMPLETED') {
      throw new BadRequestError(
        'Use the complete action to finish onboarding; it checks the final scheme and the outstanding requirements.',
      );
    }

    const verifying =
      input.kycVerified || input.bankDetailsVerified || input.registrationVerified;

    await prisma.onboardingRecord.update({
      where: { id: record.id },
      data: {
        ...(input.status !== undefined ? { status: input.status as any } : {}),
        ...(input.incubationStartDate !== undefined
          ? {
              incubationStartDate: input.incubationStartDate
                ? new Date(input.incubationStartDate)
                : null,
            }
          : {}),
        ...(input.mentorId !== undefined ? { mentorId: input.mentorId || null } : {}),
        ...(input.agreementStatus !== undefined
          ? { agreementStatus: input.agreementStatus }
          : {}),
        ...(input.kycVerified !== undefined ? { kycVerified: input.kycVerified } : {}),
        ...(input.bankDetailsVerified !== undefined
          ? { bankDetailsVerified: input.bankDetailsVerified }
          : {}),
        ...(input.registrationVerified !== undefined
          ? { registrationVerified: input.registrationVerified }
          : {}),
        ...(input.remarks !== undefined ? { remarks: input.remarks } : {}),
        ...(verifying ? { verifiedBy: actorId, documentsVerifiedAt: new Date() } : {}),
      },
    });

    if (input.status !== undefined) await this.setStatus(applicationId, input.status as any);
    return this.getByApplication(applicationId);
  }

  // ── Documents ─────────────────────────────────────────────────────────────

  static async addDocument(
    applicationId: string,
    input: { name: string; fileUrl?: string | null; fileName?: string | null; isRequired?: boolean },
  ) {
    const record = await prisma.onboardingRecord.findUnique({
      where: { applicationId },
      select: { id: true },
    });
    if (!record) throw new NotFoundError('This application has not entered onboarding');
    if (!input.name?.trim()) throw new BadRequestError('A document name is required');

    return prisma.onboardingDocument.create({
      data: {
        onboardingId: record.id,
        name: input.name.trim(),
        fileUrl: input.fileUrl ?? null,
        fileName: input.fileName ?? null,
        isRequired: input.isRequired !== false,
      },
    });
  }

  static async updateDocument(
    documentId: string,
    input: {
      fileUrl?: string | null;
      fileName?: string | null;
      isVerified?: boolean;
      remarks?: string | null;
    },
    actorId: string,
  ) {
    const doc = await prisma.onboardingDocument.findUnique({
      where: { id: documentId },
      select: { id: true, onboarding: { select: { applicationId: true } } },
    });
    if (!doc) throw new NotFoundError('Document not found');

    const updated = await prisma.onboardingDocument.update({
      where: { id: documentId },
      data: {
        ...(input.fileUrl !== undefined ? { fileUrl: input.fileUrl } : {}),
        ...(input.fileName !== undefined ? { fileName: input.fileName } : {}),
        ...(input.remarks !== undefined ? { remarks: input.remarks } : {}),
        ...(input.isVerified !== undefined
          ? {
              isVerified: input.isVerified,
              // Cleared when unverified, so a stale verifier is never shown
              // against a document that is no longer accepted.
              verifiedBy: input.isVerified ? actorId : null,
              verifiedAt: input.isVerified ? new Date() : null,
            }
          : {}),
      },
    });

    return updated;
  }

  static async removeDocument(documentId: string) {
    const doc = await prisma.onboardingDocument.findUnique({
      where: { id: documentId },
      select: { id: true },
    });
    if (!doc) throw new NotFoundError('Document not found');
    await prisma.onboardingDocument.delete({ where: { id: documentId } });
    return { id: documentId };
  }

  // ── Completion ────────────────────────────────────────────────────────────

  /** What is still outstanding, so the UI can show it before completion fails. */
  static async outstanding(applicationId: string) {
    const record = await prisma.onboardingRecord.findUnique({
      where: { applicationId },
      include: {
        documents: { where: { deletedAt: null } },
        application: {
          select: {
            pceState: { select: { schemeStatus: true, finalSchemeId: true } },
            finalSelection: { select: { decision: true } },
          },
        },
      },
    });
    if (!record) throw new NotFoundError('This application has not entered onboarding');

    const state = record.application?.pceState;
    const decision = record.application?.finalSelection?.decision;

    const blockers: string[] = [];

    // The rule the whole module exists to guarantee.
    if (state?.schemeStatus !== 'FINAL_APPROVED' || !state?.finalSchemeId) {
      blockers.push('The final scheme has not been approved');
    }
    if (!decision || !APPROVED.has(decision)) {
      blockers.push('The final committee has not approved this application');
    }

    const unverified = (record.documents ?? []).filter((d) => d.isRequired && !d.isVerified);
    if (unverified.length > 0) {
      blockers.push(
        `${unverified.length} required document${
          unverified.length === 1 ? '' : 's'
        } not verified: ${unverified.map((d) => d.name).join(', ')}`,
      );
    }

    if (!record.kycVerified) blockers.push('KYC not verified');
    if (!record.bankDetailsVerified) blockers.push('Bank details not verified');
    if (!record.registrationVerified) blockers.push('Startup registration details not verified');
    if (!record.agreementStatus?.trim()) blockers.push('Agreement status not recorded');
    if (!record.incubationStartDate) blockers.push('Incubation start date not set');

    return { blockers, canComplete: blockers.length === 0 };
  }

  static async complete(applicationId: string, actorId: string) {
    const { blockers } = await this.outstanding(applicationId);
    if (blockers.length > 0) {
      throw new BadRequestError(
        `Onboarding cannot be completed yet. ${blockers.join('. ')}.`,
      );
    }

    const now = new Date();
    await prisma.onboardingRecord.update({
      where: { applicationId },
      data: { status: 'COMPLETED', approvedBy: actorId, approvedAt: now, completedAt: now },
    });
    await this.setStatus(applicationId, 'COMPLETED');

    return this.getByApplication(applicationId);
  }

  /**
   * Who can be named as a mentor (section 31).
   *
   * OnboardingRecord.mentorId is a User id - the same ids the name resolver
   * reads - so this lists users who are mentors either by role or by having a
   * mentor profile, rather than inventing a separate register.
   */
  static async mentorOptions() {
    const users = await prisma.user.findMany({
      where: {
        deletedAt: null,
        OR: [{ role: 'MENTOR' }, { mentorProfile: { isNot: null } }],
      },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: 'asc' },
    });
    return {
      items: users.map((u) => ({
        id: u.id,
        name: u.name?.trim() || u.email,
        email: u.email,
        role: u.role,
      })),
      total: users.length,
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Keep ApplicationPceState in step, so the dashboard counts stay honest. */
  private static async setStatus(applicationId: string, status: string) {
    await PceService.ensureState(applicationId);
    await prisma.applicationPceState.update({
      where: { applicationId },
      data: { onboardingStatus: status as any },
    });
  }

  private static present(record: any, actors: Map<string, string>) {
    const app = record.application;
    const docs = record.documents ?? [];
    const required = docs.filter((d: any) => d.isRequired);

    return {
      ...record,
      application: app,
      finalScheme: app?.pceState?.finalScheme ?? null,
      isSchemeFinalised: app?.pceState?.schemeStatus === 'FINAL_APPROVED',
      finalSelection: app?.finalSelection ?? null,
      documentCount: docs.length,
      requiredCount: required.length,
      verifiedCount: required.filter((d: any) => d.isVerified).length,
      verifiedByName: record.verifiedBy ? actors.get(record.verifiedBy) ?? null : null,
      approvedByName: record.approvedBy ? actors.get(record.approvedBy) ?? null : null,
      mentorName: record.mentorId ? actors.get(record.mentorId) ?? null : null,
      /** Where this sits in section 31's sequence, for a progress indicator. */
      stepIndex: Math.max(0, SEQUENCE.indexOf(record.status)),
      stepCount: SEQUENCE.length - 1,
    };
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

export default OnboardingService;
