import prisma from '../../lib/prisma';
import { NotFoundError, BadRequestError } from '../../common/utils/apiError';
import { AgreementTemplatesService } from '../agreement-templates/agreement-templates.service';
import { ApplicationsService } from '../applications/applications.service';
import { AgreementStatus } from '@prisma/client';

export class AgreementsService {
  /**
   * Generates a new agreement record with a full, self-contained snapshot
   * by reading all section configs directly from the template's stored clauses.
   */
  static async generateAgreement(applicationId: string, templateId: string, metadata: any = {}, status: AgreementStatus = AgreementStatus.DRAFT, overrides: any = {}) {
    // 1. Fetch all required data sources
    const application = await ApplicationsService.getById(applicationId);
    if (!application) throw new NotFoundError('Application not found');

    const template = await AgreementTemplatesService.getTemplateById(templateId);
    if (!template) throw new NotFoundError('Template not found');

    const center = await prisma.incubationCenter.findFirst();
    if (!center) throw new NotFoundError('No active center profile found. Please set up the Center Profile first.');

    // 2. Build the Snapshot Variables — reads everything from template clauses
    const variables = this.mapVariables(application, center, metadata, template, overrides);

    // 3. Extract indexing columns from the built snapshot (not raw metadata)
    const a1Meta = variables.agreementMetadata;
    const a4Meta = (variables.sectionA4 as any)?.metadata || {};
    const sanctionedAmount = (application as any).grantAllocation?.sanctionedAmount || 0;
    const incubationStartDate = a1Meta.validityStart ? new Date(a1Meta.validityStart) : null;
    const incubationDuration = a4Meta.durationMonths || 12;

    const data: any = {
      agreementNumber: a1Meta.agreementId || `AG-${Date.now()}`,
      title: a1Meta.agreementFor || `Incubation & Grant Agreement - ${(application as any).startupName}`,
      description: metadata.description || '',
      executionDate: a1Meta.agreementDate ? new Date(a1Meta.agreementDate) : new Date(),
      validityStart: incubationStartDate,
      validityEnd: a1Meta.validityEnd ? new Date(a1Meta.validityEnd) : null,
      status: status,
      version: 1,

      undertakingNumber: `UND-${Date.now()}`,
      undertakingDate: new Date(),

      incubationType: a4Meta.incubationType || 'Physical',
      incubationStartDate,
      incubationDuration,

      sanctionedAmount,
      disbursementMode: (application as any).grantAllocation?.grant?.disbursementMode || 'Bank Transfer',

      variables: variables as any,
      workflowStatus: this.initWorkflowStatus(),

      applicationId,
      templateId,
      schemeId: (application as any).schemeId,
      centerProfileId: center.id,
    };

    // 4. Check for existing record to update or create
    try {
      // Find if an agreement already exists for this template/application combo that isn't yet signed
      const existing = await prisma.generatedAgreement.findFirst({
        where: { 
          applicationId, 
          templateId,
          status: { in: [AgreementStatus.DRAFT, AgreementStatus.ACTIVE, AgreementStatus.NEGOTIATING] }
        }
      });

      if (existing) {
        return await prisma.generatedAgreement.update({
          where: { id: existing.id },
          data,
          include: {
            application: { select: { applicationNo: true, startupName: true } },
            template: { select: { name: true } },
            scheme: { select: { name: true } },
            centerProfile: { select: { name: true } },
          }
        });
      }

      const agreement = await prisma.generatedAgreement.create({
        data,
        include: {
          application: { select: { applicationNo: true, startupName: true } },
          template: { select: { name: true } },
          scheme: { select: { name: true } },
          centerProfile: { select: { name: true } },
        }
      });

      return agreement;
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new BadRequestError(`An agreement with number ${a1Meta.agreementId} already exists. Check A1 metadata.`);
      }
      throw error;
    }
  }

  /**
   * Fetches all generated agreements for the dashboard table.
   */
  static async getAllAgreements() {
    const agreements = await prisma.generatedAgreement.findMany({
      include: {
        application: {
          include: {
            formB: {
              include: { founders: true }
            },
            scheme: { select: { name: true } },
            grantAllocation: {
              include: {
                grant: true,
                tranches: true
              }
            }
          }
        },
        template: { select: { name: true, version: true } },
        scheme: { select: { name: true } },
        centerProfile: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Flatten for the frontend dashboard table
    return agreements.map((a: any) => ({
      id: a.id,
      agreementNumber: a.agreementNumber,
      title: a.title,
      status: a.status,
      version: a.version,
      startupName: a.application?.startupName || 'N/A',
      applicationId: a.applicationId,
      templateName: a.template?.name || 'N/A',
      schemeName: a.scheme?.name || 'N/A',
      generatedAt: a.createdAt?.toISOString().split('T')[0] || 'N/A',
      signedBy: null,
      signedAt: null,
      variables: a.variables,
      workflowStatus: a.workflowStatus,
      application: a.application,
    }));
  }

  static async getAgreementById(id: string) {
    const agreement = await prisma.generatedAgreement.findUnique({
      where: { id },
      include: {
        application: true,
        template: true,
        scheme: true,
        centerProfile: true
      }
    });

    if (!agreement) throw new NotFoundError('Agreement not found');
    return agreement;
  }

  static async getAgreementsByApplication(applicationId: string) {
    return await prisma.generatedAgreement.findMany({
      where: { applicationId },
      include: {
        template: true,
        scheme: true,
        centerProfile: true,
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async updateStatus(id: string, status: AgreementStatus) {
    const agreement = await prisma.generatedAgreement.update({
      where: { id },
      data: { status }
    });

    if (status === AgreementStatus.APPROVED || status === AgreementStatus.EXECUTED) {
      await prisma.startupApplication.update({
        where: { id: agreement.applicationId },
        data: { isFormCApproved: true }
      });
    }

    return agreement;
  }

  static async updateVariables(id: string, variables: any) {
    return await prisma.generatedAgreement.update({
      where: { id },
      data: {
        variables,
        status: AgreementStatus.ACTIVE
      }
    });
  }

  static async respondToAgreement(applicationId: string, action: 'ACCEPT' | 'REVISE', feedback?: string, clauseNotes?: Record<string, string>) {
    const agreement = await prisma.generatedAgreement.findFirst({
      where: { applicationId },
      orderBy: { createdAt: 'desc' }
    });

    if (!agreement) throw new NotFoundError('No agreement found for this application');

    return await prisma.$transaction(async (tx) => {
      // 1. Update main application linkage tracking
      await tx.startupApplication.update({
        where: { id: applicationId },
        data: { isFormCSubmitted: true }
      });

      // 2. Update the specific Agreement's state and lock workflow
      if (action === 'ACCEPT') {
        return await tx.generatedAgreement.update({
          where: { id: agreement.id },
          data: {
            status: AgreementStatus.UNDER_REVIEW, // Set to UNDER_REVIEW to lock from user re-entry
            workflowStatus: {
              ...(agreement.workflowStatus as any || {}),
              startupDecision: 'ACCEPTED',
              submittedAt: new Date(),
              clauseNotes: clauseNotes || {}
            }
          }
        });
      } else {
        return await tx.generatedAgreement.update({
          where: { id: agreement.id },
          data: {
            status: AgreementStatus.NEGOTIATING,
            workflowStatus: {
              ...(agreement.workflowStatus as any || {}),
              startupDecision: 'REVISION_REQUESTED',
              startupFeedback: feedback || '',
              feedbackAt: new Date(),
              clauseNotes: clauseNotes || {}
            }
          }
        });
      }
    });
  }

  static async approveAgreementReview(agreementId: string) {
    const agreement = await prisma.generatedAgreement.findUnique({
      where: { id: agreementId },
      include: { application: true }
    });

    if (!agreement) throw new NotFoundError('Agreement not found');

    // 1. Update Agreement Status to SIGNED or APPROVED
    const updatedAgreement = await prisma.generatedAgreement.update({
      where: { id: agreementId },
      data: {
        status: AgreementStatus.ACTIVE,
        workflowStatus: {
          ...(agreement.workflowStatus as any || {}),
          adminApprovedAt: new Date(),
          isFinalized: true
        }
      }
    });

    // 2. Unlock Form D for the startup
    await prisma.startupApplication.update({
      where: { id: agreement.applicationId },
      data: {
        isFormCApproved: true
      }
    });

    return updatedAgreement;
  }

  /**
   * Builds a complete, self-contained snapshot by reading ALL section configs
   * directly from the template's stored clauses. The 'metadata' param is only
   * used as a last-resort override — the template is the source of truth.
   */
  private static mapVariables(app: any, center: any, metadata: any, template: any, overrides: any = {}) {
    // ── Clause helpers ────────────────────────────────────────────────────
    const findClause = (pCode: string, sCode: string) =>
      template.parts
        ?.find((p: any) => p.code === pCode)
        ?.sections?.find((s: any) => s.code === sCode)
        ?.clauses?.[0];

    const safeParse = (content?: string, fallback: any = []) => {
      if (!content) return fallback;
      try { return JSON.parse(content); } catch { return fallback; }
    };

    // ── Parse each section from template clauses ──────────────────────────
    const a1Meta  = safeParse(findClause('A', 'A1')?.content, {});
    const a4Config = safeParse(findClause('A', 'A4')?.content, {});
    const a6Config = safeParse(findClause('A', 'A6')?.content, {});
    const a11Config = safeParse(findClause('A', 'A11')?.content, {});

    const primaryFounder = app.formB?.founders?.[0] || {};

    return {
      // ── A1: Agreement Metadata ──────────────────────────────────────────
      agreementMetadata: {
        agreementId: (a1Meta.agreementId && a1Meta.agreementId !== "[AUTO-GENERATED]") ? a1Meta.agreementId : (metadata.agreementId || `AG-${Date.now()}`),
        agreementFor: a1Meta.agreementFor || metadata.agreementFor || 'Incubation & Grant',
        agreementDate: a1Meta.agreementDate || new Date().toISOString().split('T')[0],
        version: a1Meta.version || '1.0',
        validityStart: a1Meta.validityStart || '',
        validityEnd: a1Meta.validityEnd || '',
        schemeName: app.scheme?.name || a1Meta.schemeName || 'N/A',
        applicationNo: app.applicationNo || a1Meta.applicationNo || 'N/A',
      },

      // ── A2: First Party (Centre) ────────────────────────────────────────
      firstParty: {
        name: center.name,
        universityName: center.universityName,
        address: center.address,
        authorizedSignatory: center.authorizedSignatory,
        designation: center.designation,
        email: center.email,
        mobile: center.mobile,
        officialSealUrl: center.officialSealUrl || null,
      },

      // ── A2: Second Party (Startup) ──────────────────────────────────────
      secondParty: {
        startupName: app.startupName,
        registrationNo: app.cin || 'N/A',
        legalStatus: app.legalStatus || 'N/A',
        dateOfIncorporation: app.incorporationDate || null,
        registeredAddress: app.addressLine || 'N/A',
        founderName: primaryFounder.name || app.fullName || 'N/A',
        email: primaryFounder.email || app.email || 'N/A',
        mobile: primaryFounder.mobile || app.mobile || 'N/A',
        whatsappNo: primaryFounder.whatsapp || app.whatsapp || 'N/A',
        dpiitNo: app.dpiitNumber || 'N/A',
        panGst: `${primaryFounder.pan || app.pan || 'N/A'} / ${app.gstin || 'N/A'}`,
      },

      // ── A3: Scope ────────────────────────────────────────────────────────
      sectionA3: {
        scope: overrides.scopeText || findClause('A', 'A3')?.content || '',
      },

      // ── A4: Incubation Support ───────────────────────────────────────────
      sectionA4: {
        options: overrides.a4Options || Array.isArray(a4Config) ? a4Config : (a4Config.options || []),
        metadata: overrides.a4Metadata || Array.isArray(a4Config) ? {} : (a4Config.metadata || {}),
      },

      // ── A5: Grant Details ────────────────────────────────────────────────
      grantDetails: {
        grantType: app.grantAllocation?.grant?.name || 'N/A',
        sanctionedAmount: app.grantAllocation?.sanctionedAmount || 0,
        disbursementMode: app.grantAllocation?.grant?.disbursementMode || 'N/A',
        ucRequired: app.grantAllocation?.grant?.ucMandatory ?? true,
        tranches: app.grantAllocation?.tranches || [],
        disbursementSchedule: (app.grantAllocation?.tranches || []).map((t: any) => ({
          milestone: t.releaseCondition || t.milestone,
          percentage: (app.grantAllocation?.sanctionedAmount > 0) ? `${Math.round((t.amount / app.grantAllocation.sanctionedAmount) * 100)}%` : "0%",
          amount: new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(t.amount),
          status: t.status
        }))
      },

      // ── A6: Roles & Responsibilities ─────────────────────────────────────
      sectionA6: {
        centreOptions: overrides.a6CentreOptions || a6Config.centre || [],
        startupOptions: overrides.a6StartupOptions || a6Config.startup || [],
      },

      // ── A8: IP & Confidentiality ─────────────────────────────────────────
      sectionA8: {
        clauses: overrides.a8Options || safeParse(findClause('A', 'A8')?.content),
      },

      // ── A9: Termination ──────────────────────────────────────────────────
      sectionA9: {
        items: overrides.a9Options || safeParse(findClause('A', 'A9')?.content),
      },

      // ── A10: Legal Clauses ───────────────────────────────────────────────
      sectionA10: {
        items: overrides.a10Options || safeParse(findClause('A', 'A10')?.content),
      },

      // ── A11: Witnesses ───────────────────────────────────────────────────
      sectionA11: {
        witness1: a11Config.witness1 || '',
        witness2: a11Config.witness2 || '',
      },

      // ── B1: Undertaking Metadata ─────────────────────────────────────────
      sectionB1: {
        undertakingId: `UND-${Date.now()}`,
        undertakingDate: new Date().toISOString().split('T')[0],
      },

      // ── B2: Undertaking Statement ────────────────────────────────────────
      sectionB2: {
        undertakingText: overrides.undertakingText || findClause('B', 'B2')?.content || '',
      },

      // ── B3: Declarations ─────────────────────────────────────────────────
      sectionB3: {
        declarations: overrides.b3Options || safeParse(findClause('B', 'B3')?.content),
      },

      // ── B4: Penalty Clauses ──────────────────────────────────────────────
      sectionB4: {
        penalties: overrides.b4Options || safeParse(findClause('B', 'B4')?.content),
      },

      // ── B5: Signatory ────────────────────────────────────────────────────
      sectionB5: {
        signatory: {
          name: app.formB?.authorityName || primaryFounder.name || app.fullName || 'N/A',
          designation: app.formB?.authorityDesignation || 'Founder',
          email: app.formB?.authorityEmail || primaryFounder.email || app.email || 'N/A',
          mobile: primaryFounder.mobile || app.mobile || 'N/A',
          idProofUploaded: !!(app.founderIdProof || primaryFounder.govtId),
        },
      },
    };
  }

  /**
   * Flattens the snapshot for the placeholder regex hydration engine.
   */
  private static flattenVariables(vars: any): Record<string, string> {
    return {
      startup_name: vars.secondParty?.startupName || '',
      agreement_id: vars.agreementMetadata?.agreementId || '',
      agreement_date: vars.agreementMetadata?.agreementDate || '',
      agreement_for: vars.agreementMetadata?.agreementFor || '',
      founder_name: vars.secondParty?.founderName || '',
      sanctioned_amount: String(vars.grantDetails?.sanctionedAmount || 0),
      first_party_name: vars.firstParty?.name || '',
      center_head: vars.firstParty?.authorizedSignatory || '',
      application_no: vars.agreementMetadata?.applicationNo || '',
      scheme_name: vars.agreementMetadata?.schemeName || '',
    };
  }

  private static initWorkflowStatus() {
    return {
      startupApproved: { completed: true, updatedAt: new Date() },
      schemeGrantSelected: { completed: true, updatedAt: new Date() },
      agreementGenerated: { completed: true, updatedAt: new Date() },
      adminReview: { completed: false, updatedAt: null },
      digitalSignature: { completed: false, updatedAt: null },
      pdfLocked: { completed: false, updatedAt: null },
      undertakingLinked: { completed: false, updatedAt: null },
      storedInRepository: { completed: false, updatedAt: null },
    };
  }
}
