import { ApplicationStatus, LegalStatus, StartupStage, Prisma, ApplicationLevel } from '@prisma/client';
import prisma from '../../lib/prisma';
import fs from 'fs';
import { BadRequestError, NotFoundError } from '../../common/utils/apiError';
import { config } from '../../common/config/env';
import { sendEmail } from '../../common/utils/mailer';
import { sseManager } from '../../lib/sseManager';

export class ApplicationsService {
  static async getByUserId(userId: string) {
    const application = await prisma.startupApplication.findUnique({
      where: { userId },
      include: { 
        scheme: true,
        formB: {
          include: {
            founders: true,
            ipRecords: true,
            fundingRecords: true,
            awards: true,
            shareholders: true
          }
        },
        formC: true,
        grantAllocation: {
          include: {
            grant: true,
            tranches: {
              orderBy: {
                installmentNo: 'asc'
              }
            }
          }
        }
      }
    });

    if (!application) return null;

    // Map sector and sub-sector names
    const sectors = await prisma.sector.findMany({
      include: { subSectors: true }
    });
    const sectorMap = new Map(sectors.map((s: any) => [s.id, s.name]));
    const subSectorMap = new Map(sectors.flatMap((s: any) => s.subSectors).map((ss: any) => [ss.id, ss.name]));

    // Calculate forms completed
    const forms = [
      application.isFormASubmitted,
      application.isFormBSubmitted,
      application.isFormCSubmitted,
      application.isFormDSubmitted,
      application.isFormESubmitted,
      application.isFormFSubmitted,
      application.isFormGSubmitted,
      application.isFormHSubmitted,
    ];
    const formsCompleted = forms.filter(Boolean).length;

    return {
      ...application,
      mainSectorName: sectorMap.get(application.mainSector) || application.mainSector,
      subSectorNames: application.subSectors.map((id: any) => subSectorMap.get(id) || id),
      formsCompleted
    };
  }

  static async getById(id: string) {
    const application = await prisma.startupApplication.findUnique({
      where: { id },
      include: { 
        scheme: true, 
        user: true,
        formB: {
          include: {
            founders: true,
            ipRecords: true,
            fundingRecords: true,
            awards: true,
            shareholders: true
          }
        },
        formC: true,
        grantAllocation: {
          include: {
            grant: true,
            tranches: {
              orderBy: {
                installmentNo: 'asc'
              }
            },
            utilisationCertificates: true
          }
        },
        reviews: {
          include: {
            reviewer: {
              select: { id: true, name: true, email: true, role: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        assignedTo: {
          select: { id: true, name: true, email: true }
        },
        cohort: {
          select: { id: true, name: true, status: true, startDate: true, endDate: true }
        },
        generatedAgreements: {
          orderBy: { createdAt: 'desc' },
          take: 3
        }
      }
    });
    if (!application) throw new NotFoundError('Application not found');

    // Map sector and sub-sector names
    const sectors = await prisma.sector.findMany({
      include: { subSectors: true }
    });
    const sectorMap = new Map(sectors.map((s: any) => [s.id, s.name]));
    const subSectorMap = new Map(sectors.flatMap((s: any) => s.subSectors).map((ss: any) => [ss.id, ss.name]));

    return {
      ...application,
      mainSectorName: sectorMap.get(application.mainSector || "") || application.mainSector || "N/A",
      subSectorNames: (application.subSectors || []).map((sid: any) => subSectorMap.get(sid) || sid)
    };
  }

  static async submitFormA(userId: string, data: any) {
    const isDraft = !!data.isDraft;

    // Check if application already exists and its status
    const existingApplication = await prisma.startupApplication.findUnique({
      where: { userId }
    });

    if (!isDraft && existingApplication && 
        existingApplication.status !== ApplicationStatus.DRAFT && 
        existingApplication.status !== ApplicationStatus.RE_SUBMISSION_REQUIRED) {
      throw new BadRequestError(`Application already submitted with status: ${existingApplication.status}. You cannot re-submit until requested.`);
    }

    // Backend Validation for Registration Details - Skip if Draft
    if (!isDraft && data.isRegistered && data.legalStatus && data.legalStatus !== 'NOT_REGISTERED') {
      const requiredFields = ['cin', 'incorporationDate', 'pan'];
      for (const field of requiredFields) {
        if (!data[field]) {
          throw new BadRequestError(`Registration detail '${field}' is required for a registered startup.`);
        }
      }
      if (!data.registrationCert) {
        throw new BadRequestError(`Company Registration Certificate is mandatory for registered startups.`);
      }
    }

    // GST Validation - Skip if Draft
    if (!isDraft && data.isRegistered && data.legalStatus && data.legalStatus !== 'NOT_REGISTERED' && data.hasGstin === 'yes') {
      if (!data.gstin) {
        throw new BadRequestError(`GST Number is required when 'Has GST' is Yes.`);
      }
      if (!data.gstCert) {
        throw new BadRequestError(`GST Certificate is mandatory when 'Has GST' is Yes.`);
      }
    }

    // DPIIT Validation - Skip if Draft
    if (!isDraft && data.dpiitRegistered === 'yes') {
      if (!data.dpiitNumber || !data.dpiitDate) {
        throw new BadRequestError(`DPIIT Number and Date are required when DPIIT Registered is Yes.`);
      }
      if (!data.dpiitCert) {
        throw new BadRequestError(`DPIIT Certificate is mandatory when DPIIT Registered is Yes.`);
      }
    }

    // Generate Application No if it doesn't exist and not a draft
    let applicationNo = existingApplication?.applicationNo || null;
    if (!applicationNo && !isDraft) {
      const currentYear = new Date().getFullYear();
      
      // Production-ready logic: Find the maximum sequence number for the current year
      // instead of using count(), which breaks if records are deleted.
      const lastApplication = await prisma.startupApplication.findFirst({
        where: {
          applicationNo: {
            startsWith: `GU-${currentYear}-`
          }
        },
        orderBy: {
          applicationNo: 'desc'
        },
        select: {
          applicationNo: true
        }
      });

      let nextNumber = 1;
      if (lastApplication?.applicationNo) {
        const parts = lastApplication.applicationNo.split('-');
        const lastSeq = parseInt(parts[parts.length - 1]);
        if (!isNaN(lastSeq)) {
          nextNumber = lastSeq + 1;
        }
      }
      
      applicationNo = `GU-${currentYear}-${nextNumber.toString().padStart(4, '0')}`;
    }

    // Map Frontend fields to Backend Schema
    // Extract main fields for specific mapping and exclude non-persistable/automatic fields
    const {
      scheme,
      dateOfBirth,
      problemStatement,
      innovationDescription,
      stage,
      legalStatus,
      additionalDocs,
      isDraft: _isDraft, // Exclude from rest
      // Exclude automatic/hidden fields that might cause Prisma validation errors during revision update
      id,
      applicationNo: _appNo,
      userId: _uId,
      createdAt,
      updatedAt,
      version,
      isFormASubmitted: _isA,
      isFormBSubmitted: _isB,
      isFormCSubmitted: _isC,
      isFormDSubmitted: _isD,
      isFormESubmitted: _isE,
      isFormFSubmitted: _isF,
      isFormGSubmitted: _isG,
      isFormHSubmitted: _isH,
      reviewedBy,
      rejectionReason,
      approvedAt,
      deletedAt,
      assignedToId,
      isDeclared,
      ...rest
    } = data;

    // Prepare mapped data including handling empty strings for required fields to avoid Prisma errors
    const mappedData: any = {
      // Step 1: Scheme
      schemeId: scheme || existingApplication?.schemeId || '00000000-0000-0000-0000-000000000000',
      
      // Step 2: Founder Details
      fullName: rest.fullName || existingApplication?.fullName || '',
      designation: rest.designation || existingApplication?.designation || '',
      email: rest.email || existingApplication?.email || '',
      mobile: rest.mobile || existingApplication?.mobile || '',
      whatsapp: rest.whatsapp || existingApplication?.whatsapp || '',
      aadhaar: rest.aadhaar || existingApplication?.aadhaar || '',
      gender: rest.gender || existingApplication?.gender || '',
      dob: dateOfBirth ? new Date(dateOfBirth) : (existingApplication?.dob || new Date()),
      highestQualification: rest.highestQualification || existingApplication?.highestQualification || '',
      fromInstitution: rest.fromInstitution || existingApplication?.fromInstitution || '',
      addressLine: rest.addressLine || existingApplication?.addressLine || '',
      locality: rest.locality || existingApplication?.locality || '',
      city: rest.city || existingApplication?.city || '',
      district: rest.district || existingApplication?.district || '',
      state: rest.state || existingApplication?.state || '',
      pinCode: rest.pinCode || existingApplication?.pinCode || '',
      
      // Step 3: Startup Details
      startupName: rest.startupName || existingApplication?.startupName || '',
      mainSector: rest.mainSector || existingApplication?.mainSector || '',
      subSectors: rest.subSectors || existingApplication?.subSectors || [],
      stage: (stage ? (stage as string)?.toUpperCase().replace(/-/g, '_') : existingApplication?.stage || 'IDEA') as StartupStage,
      briefAbout: rest.briefAbout || existingApplication?.briefAbout || '',
      problemStmt: problemStatement || existingApplication?.problemStmt || '',
      solution: innovationDescription || existingApplication?.solution || '',
      revenueModel: rest.revenueModel || existingApplication?.revenueModel || [],
      marketSize: rest.marketSize || existingApplication?.marketSize || '',
      ipStatus: rest.ipStatus || existingApplication?.ipStatus || '',
      lookingFor: rest.lookingFor || existingApplication?.lookingFor || [],
      website: rest.website || existingApplication?.website || '',
      
      // Step 4: Registration Details
      isRegistered: !!(rest.isRegistered || (rest.cin && rest.cin !== "") || (legalStatus && legalStatus !== 'NOT_REGISTERED' && legalStatus !== "")),
      legalStatus: (legalStatus && legalStatus !== "" ? (legalStatus as string)?.toUpperCase() : (existingApplication?.legalStatus || null)) as LegalStatus,
      cin: rest.cin === "" ? null : (rest.cin || existingApplication?.cin),
      pan: rest.pan === "" ? null : (rest.pan || existingApplication?.pan),
      hasGstin: rest.hasGstin || existingApplication?.hasGstin || "no",
      gstin: rest.gstin === "" ? null : (rest.gstin || existingApplication?.gstin),
      dpiitRegistered: rest.dpiitRegistered || existingApplication?.dpiitRegistered || "no",
      dpiitNumber: rest.dpiitNumber === "" ? null : (rest.dpiitNumber || existingApplication?.dpiitNumber),
      
      // Step 5: Communication Details
      primaryEmail: rest.primaryEmail || existingApplication?.primaryEmail || '',
      primaryMobile: rest.primaryMobile || existingApplication?.primaryMobile || '',
      primaryWhatsapp: rest.primaryWhatsapp || existingApplication?.primaryWhatsapp || '',
      
      // Step 6: Documents (Strings as URLs)
      pitchDeck: rest.pitchDeck || existingApplication?.pitchDeck || null,
      founderIdProof: rest.founderIdProof || existingApplication?.founderIdProof || null,
      registrationCert: rest.registrationCert || existingApplication?.registrationCert || null,
      dpiitCert: rest.dpiitCert || existingApplication?.dpiitCert || null,
      gstCert: rest.gstCert || existingApplication?.gstCert || null,
      patentDocs: rest.patentDocs || existingApplication?.patentDocs || null,
      financialStatements: rest.financialStatements || existingApplication?.financialStatements || null,
      additionalDocs: additionalDocs || existingApplication?.additionalDocs || null,

      // Metadata/Status
      isMobileVerified: !!data.isMobileVerified,
      isEmailVerified: !!data.isEmailVerified,
      isAadhaarVerified: !!data.isAadhaarVerified,
      currentLevel: isDraft ? (existingApplication?.currentLevel || 'SCREENING') : 'SCREENING' as any,
    };

    try {
      const savedApplication = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // 1. Upsert Startup Application
        const application = await tx.startupApplication.upsert({
          where: { userId },
          update: {
            ...mappedData,
            status: isDraft ? (existingApplication?.status || ApplicationStatus.DRAFT) : ApplicationStatus.SUBMITTED,
            isFormASubmitted: isDraft ? (existingApplication?.isFormASubmitted || false) : true,
            revisionForm: isDraft ? existingApplication?.revisionForm : null, // CLEAR revision flag on successful submission
            incorporationDate: data.incorporationDate ? new Date(data.incorporationDate) : (isDraft ? existingApplication?.incorporationDate : undefined),
            dpiitDate: data.dpiitDate ? new Date(data.dpiitDate) : (isDraft ? existingApplication?.dpiitDate : undefined),
            applicationNo: applicationNo || undefined
          },
          create: {
            ...mappedData,
            userId,
            applicationNo,
            email: rest.email || '', // Founder email could still be founder's own
            primaryEmail: rest.primaryEmail || '', // This comes from backend-controlled user data normally
            status: isDraft ? ApplicationStatus.DRAFT : ApplicationStatus.SUBMITTED,
            isFormASubmitted: !isDraft,
            revisionForm: null,
            incorporationDate: data.incorporationDate ? new Date(data.incorporationDate) : null,
            dpiitDate: data.dpiitDate ? new Date(data.dpiitDate) : null,
          }
        });

        // 2. Sync to Startup Profile - only if not draft or if we have a name
        if (!isDraft || data.startupName) {
            await tx.startupProfile.upsert({
              where: { userId },
              update: {
                companyName: data.startupName || undefined,
                industry: data.mainSector || undefined,
                stage: stage ? (data.stage as string)?.toUpperCase().replace(/-/g, '_') : undefined,
              },
              create: {
                userId,
                companyName: data.startupName || '',
                industry: data.mainSector || '',
                stage: stage ? (data.stage as string)?.toUpperCase().replace(/-/g, '_') : 'IDEA',
              }
            });
        }

        return application;
      });

      // 3. Flag Duplicates (Post-transaction)
      if (!isDraft && savedApplication) {
        await this.checkForDuplicates(savedApplication.id, savedApplication.cin, savedApplication.pan);
      }

      return savedApplication;
    } catch (error: any) {
      // Catch Prisma duplicate/null constraint errors and re-throw as user-friendly BadRequestError
      if (error.code === 'P2002') {
        const target = error.meta?.target;
        const field = Array.isArray(target) ? target[0] : (target || 'field');
        
        // Map common technical field names to user-friendly names
        const fieldMap: Record<string, string> = {
          applicationNo: 'Application Number',
          userId: 'User Account',
          email: 'Email Address',
          mobile: 'Mobile Number'
        };

        const friendlyField = fieldMap[field as string] || field;
        throw new BadRequestError(`A startup with this ${friendlyField} already exists. Please check for duplicate entries.`);
      }
      if (error.code === 'P2011') {
        const field = error.meta?.constraint?.[0] || 'field';
        throw new BadRequestError(`Required field '${field}' is missing in the application.`);
      }
      throw error;
    }
  }

  static async submitFormB(data: any) {
    const { 
      applicationId, 
      founders, 
      ipRecords = [], 
      fundingRecords = [],
      awards = [], 
      shareholders = [], 
      // Extract startup info to sync back to main application
      startupName,
      cin,
      incorporationDate,
      legalStatus,
      pan,
      hasGstin,
      gstin,
      dpiitRegistered,
      dpiitNumber,
      dpiitDate,
      registeredAddress,
      website,
      sector,
      stage,
      isDraft = false,
      ...formBData 
    } = data;

    // 1. Verify application exists and is approved
    const application = await prisma.startupApplication.findUnique({
      where: { id: applicationId },
      include: { user: true }
    });

    if (!application) throw new NotFoundError('Application not found');
    if (application.status !== ApplicationStatus.APPROVED && 
        application.status !== ApplicationStatus.SELECTED_FOR_PITCH &&
        application.status !== ApplicationStatus.RE_SUBMISSION_REQUIRED) {
      throw new BadRequestError('Form B can only be submitted for approved or selected applications');
    }

    try {
      const savedFormB = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // 2. Sync core startup info back to main application
        await tx.startupApplication.update({
          where: { id: applicationId },
          data: {
            startupName: startupName || application.startupName,
            cin: cin !== undefined ? cin : application.cin,
            incorporationDate: (incorporationDate && !isNaN(Date.parse(incorporationDate))) ? new Date(incorporationDate) : application.incorporationDate,
            legalStatus: legalStatus !== undefined ? legalStatus : application.legalStatus,
            pan: pan !== undefined ? pan : application.pan,
            hasGstin: hasGstin !== undefined ? hasGstin : application.hasGstin,
            gstin: gstin !== undefined ? gstin : application.gstin,
            dpiitRegistered: dpiitRegistered !== undefined ? dpiitRegistered : application.dpiitRegistered,
            dpiitNumber: dpiitNumber !== undefined ? dpiitNumber : application.dpiitNumber,
            dpiitDate: (dpiitDate && !isNaN(Date.parse(dpiitDate))) ? new Date(dpiitDate) : application.dpiitDate,
            website: website || application.website,
            addressLine: registeredAddress || application.addressLine,
            mainSector: sector || application.mainSector,
            stage: stage ? (stage as string).toUpperCase().replace(/-/g, '_') as StartupStage : application.stage,
            isFormBSubmitted: isDraft ? application.isFormBSubmitted : true,
            status: isDraft ? application.status : ApplicationStatus.UNDER_REVIEW,
            revisionForm: isDraft ? application.revisionForm : null,
          }
        });

        // 3. Create or Update Form B base record
        // Force authorityEmail to be the registration email (primaryEmail)
        const formB = await tx.applicationFormB.upsert({
          where: { applicationId },
          update: { 
            ...formBData, 
            authorityEmail: application.primaryEmail || application.user?.email || application.email 
          },
          create: { 
            ...formBData, 
            applicationId, 
            authorityEmail: application.primaryEmail || application.user?.email || application.email 
          }
        });

        // 4. nested arrays: Delete and Re-create
        await tx.applicationFounder.deleteMany({ where: { formBId: formB.id } });
        await tx.applicationIP.deleteMany({ where: { formBId: formB.id } });
        await tx.applicationAward.deleteMany({ where: { formBId: formB.id } });
        await tx.applicationShareholder.deleteMany({ where: { formBId: formB.id } });
        await tx.applicationFunding.deleteMany({ where: { formBId: formB.id } });

        // 5. Batch create new records
        if (founders && founders.length > 0) {
          await tx.applicationFounder.createMany({
            data: founders.map((f: any) => {
              const { id, ...founderData } = f; // Remove frontend-only IDs
              return { ...founderData, formBId: formB.id };
            })
          });
        }

        if (ipRecords && ipRecords.length > 0) {
          await tx.applicationIP.createMany({
            data: ipRecords.map((ip: any) => {
              const { id, ...ipData } = ip;
              return { 
                ...ipData, 
                formBId: formB.id,
                filingDate: (ip.filingDate && !isNaN(Date.parse(ip.filingDate))) ? new Date(ip.filingDate) : null 
              };
            })
          });
        }

        if (fundingRecords && fundingRecords.length > 0) {
          await tx.applicationFunding.createMany({
            data: fundingRecords.map((fr: any) => {
              const { id, ...frData } = fr;
              return { 
                ...frData, 
                formBId: formB.id,
                fundingDate: (fr.fundingDate && !isNaN(Date.parse(fr.fundingDate))) ? new Date(fr.fundingDate) : null 
              };
            })
          });
        }

        if (awards && awards.length > 0) {
          await tx.applicationAward.createMany({
            data: awards.map((a: any) => {
              const { id, ...awardData } = a;
              return { ...awardData, formBId: formB.id };
            })
          });
        }

        if (shareholders && shareholders.length > 0) {
          await tx.applicationShareholder.createMany({
            data: shareholders.map((sh: any) => {
              const { id, ...shData } = sh;
              return { 
                ...shData, 
                formBId: formB.id,
                percentage: parseFloat(sh.percentage) || 0
              };
            })
          });
        }

        return formB;
      });

      // 6. Duplicate check (Post-transaction)
      if (!isDraft) {
        await this.checkForDuplicates(
          applicationId, 
          cin !== undefined ? cin : application.cin, 
          pan !== undefined ? pan : application.pan
        );
      }

      return savedFormB;
    } catch (error: any) {
      console.error("FORM B SUBMISSION ERROR DETAILS:", {
        message: error.message,
        code: error.code,
        meta: error.meta,
        stack: error.stack
      });
      throw error;
    }
  }

  static async submitFormC(data: any) {
    const { applicationId, ...formCData } = data;

    const application = await prisma.startupApplication.findUnique({
      where: { id: applicationId }
    });

    if (!application) throw new NotFoundError('Application not found');
    if (!application.isFormBSubmitted) {
      throw new BadRequestError('Form C can only be submitted after Form B is completed');
    }

    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Create or Update Form C record
      const formC = await tx.applicationFormC.upsert({
        where: { applicationId },
        update: {
          ...formCData,
          agreementDate: formCData.agreementDate ? new Date(formCData.agreementDate) : undefined,
          incubationStartDate: formCData.incubationStartDate ? new Date(formCData.incubationStartDate) : undefined,
          undertakingSignedAt: formCData.isUndertakingSigned ? new Date() : undefined,
        },
        create: {
          ...formCData,
          applicationId,
          agreementDate: formCData.agreementDate ? new Date(formCData.agreementDate) : null,
          incubationStartDate: formCData.incubationStartDate ? new Date(formCData.incubationStartDate) : null,
          undertakingSignedAt: formCData.isUndertakingSigned ? new Date() : null,
        }
      });

      // 2. Update main application flag
      await tx.startupApplication.update({
        where: { id: applicationId },
        data: { 
          isFormCSubmitted: true,
          status: ApplicationStatus.UNDER_REVIEW,
          revisionForm: null,
        }
      });

      return formC;
    });
  }

  static async updateStatus(id: string, status: string, adminId: string, reason?: string) {
    const formattedStatus = status.toUpperCase() as ApplicationStatus;
    
    const updateData: any = {
      status: formattedStatus,
      reviewedBy: adminId,
      revisionForm: null,
      rejectionReason: formattedStatus === ApplicationStatus.REJECTED || formattedStatus === ApplicationStatus.HOLD ? reason : undefined,
      approvedAt: formattedStatus === ApplicationStatus.APPROVED ? new Date() : undefined,
    };

    let applicationRecord: any = null;
    let justApprovedFormC = false;

    // If Accept is clicked from the main page, we need to know which form was just "accepted"
    // to unlock the next one. We determine this by finding the highest submitted but unapproved form.
    if (formattedStatus === ApplicationStatus.APPROVED) {
      applicationRecord = await prisma.startupApplication.findUnique({ where: { id } });
      if (applicationRecord) {
        if (applicationRecord.isFormGSubmitted && !applicationRecord.isFormGApproved) updateData.isFormGApproved = true;
        else if (applicationRecord.isFormFSubmitted && !applicationRecord.isFormFApproved) updateData.isFormFApproved = true;
        else if (applicationRecord.isFormESubmitted && !applicationRecord.isFormEApproved) updateData.isFormEApproved = true;
        else if (applicationRecord.isFormDSubmitted && !applicationRecord.isFormDApproved) updateData.isFormDApproved = true;
        else if (applicationRecord.isFormCSubmitted && !applicationRecord.isFormCApproved) {
          updateData.isFormCApproved = true;
          justApprovedFormC = true;
        }
        else if (applicationRecord.isFormBSubmitted && !applicationRecord.isFormBApproved) updateData.isFormBApproved = true;
        else if (applicationRecord.isFormASubmitted && !applicationRecord.isFormAApproved) updateData.isFormAApproved = true;
      }
    }

    const application = await (prisma.startupApplication as any).update({
      where: { id },
      data: updateData
    });

    if (justApprovedFormC && applicationRecord) {
      try {
        const existing = await prisma.webStartup.findFirst({ where: { name: application.startupName } });
        if (!existing) {
          await prisma.webStartup.create({
            data: {
              name: application.startupName,
              logoPath: applicationRecord.logoUrl || null,
              sector: applicationRecord.industry || applicationRecord.sector || null,
              stage: applicationRecord.stage || null,
              email: application.email || null,
              phone: application.mobile || null,
              website: applicationRecord.website || null,
              problem: applicationRecord.problemStatement || null,
              publishState: "PUBLISHED",
              registered: "GTU Innovation Council",
            }
          });
          console.log(`[Form C Approval] Automatically created WebStartup for ${application.startupName}`);
        }
      } catch (err) {
        console.error(`[Form C Approval] Failed to create WebStartup for ${application.startupName}`, err);
      }
    }

    // Send email notification
    try {
      const recommendation = formattedStatus === ApplicationStatus.APPROVED ? 'ACCEPT' : 
                             formattedStatus === ApplicationStatus.REJECTED ? 'REJECT' : 
                             formattedStatus === ApplicationStatus.SELECTED_FOR_PITCH ? 'SELECTED_FOR_PITCH' :
                             formattedStatus === ApplicationStatus.HOLD ? 'HOLD' :
                             formattedStatus === ApplicationStatus.RE_SUBMISSION_REQUIRED ? 'REVISE' : 'UPDATE';

      const subject = `Application Update: ${application.startupName}`;
      const html = this.generateReviewEmailTemplate(application.startupName, recommendation, reason);
      
      const targetEmail = application.primaryEmail || application.user?.email || application.email;
      await sendEmail(targetEmail, subject, html);
    } catch (emailError) {
      console.error('Failed to send status update email:', emailError);
    }

    return application;
  }

  static async approveApplication(id: string, adminId: string) {
    return this.updateStatus(id, ApplicationStatus.APPROVED, adminId);
  }

  static async rejectApplication(id: string, adminId: string, reason: string) {
    return this.updateStatus(id, ApplicationStatus.REJECTED, adminId, reason);
  }

  static async markAsGraduated(id: string, adminId: string) {
    const app = await prisma.startupApplication.findUnique({
      where: { id },
      include: { user: { select: { email: true } } },
    });

    if (!app) throw new NotFoundError('Application not found');
    if (app.status !== ApplicationStatus.APPROVED) {
      throw new BadRequestError('Only APPROVED startups can be graduated');
    }
    if (app.graduatedAt) {
      throw new BadRequestError('Startup has already been graduated');
    }

    const updated = await (prisma.startupApplication as any).update({
      where: { id },
      data: {
        graduatedAt: new Date(),
        graduatedBy: adminId,
      },
    });

    // Send congratulatory email — non-blocking
    const targetEmail = app.primaryEmail || app.user?.email || app.email;
    if (targetEmail) {
      sendEmail(
        targetEmail,
        `Congratulations on Graduating from GTU — ${app.startupName}`,
        this.generateGraduationEmailTemplate(app.startupName)
      ).catch(err => console.error('[graduation] email failed:', err));
    }

    return updated;
  }

  static async revokeGraduation(id: string, adminId: string) {
    const app = await (prisma.startupApplication as any).findUnique({ where: { id } });
    if (!app) throw new NotFoundError('Application not found');
    if (!app.graduatedAt) throw new BadRequestError('Startup is not currently graduated');

    return (prisma.startupApplication as any).update({
      where: { id },
      data: { graduatedAt: null, graduatedBy: null },
    });
  }

  private static generateGraduationEmailTemplate(startupName: string): string {
    return `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#f9fafb;border-radius:12px;">
        <div style="background:#fff;border-radius:10px;padding:32px;border:1px solid #e5e7eb;">
          <h2 style="color:#059669;margin:0 0 8px;">🎓 Congratulations, ${startupName}!</h2>
          <p style="color:#374151;line-height:1.6;">
            We are thrilled to announce that <strong>${startupName}</strong> has officially graduated from the
            <strong>GTU Incubation Program</strong>.
          </p>
          <p style="color:#374151;line-height:1.6;">
            As an alumni, you now have access to the Alumni Portal where you can:
          </p>
          <ul style="color:#374151;line-height:2;">
            <li>Share your success stories with the community</li>
            <li>Refer new startups to future cohorts</li>
            <li>Submit annual KPI updates</li>
            <li>Stay connected with fellow alumni</li>
          </ul>
          <p style="color:#6b7280;font-size:13px;margin-top:24px;">
            Thank you for being a part of the GTU ecosystem. We look forward to celebrating your continued success.
          </p>
          <p style="color:#6b7280;font-size:13px;">— The GTU Team</p>
        </div>
      </div>
    `;
  }

  static async updateVerificationStatus(userId: string, status: { isEmailVerified?: boolean, isMobileVerified?: boolean }) {
    // Check if application exists before updating
    const application = await prisma.startupApplication.findUnique({ where: { userId } });
    if (!application) return null;

    return await prisma.startupApplication.update({
      where: { userId },
      data: status
    });
  }

  static async checkForDuplicates(applicationId: string, cin?: string | null, pan?: string | null) {
    if (!cin && !pan) return;
    
    const orConditions: any[] = [];
    if (cin && cin.trim() !== '') orConditions.push({ cin });
    if (pan && pan.trim() !== '') orConditions.push({ pan });
    
    if (orConditions.length === 0) return;

    // Find other applications with the same CIN or PAN
    const duplicates = await prisma.startupApplication.findMany({
      where: {
        id: { not: applicationId },
        OR: orConditions,
        status: { not: ApplicationStatus.DRAFT }
      },
      select: { id: true }
    });

    if (duplicates.length > 0) {
      await prisma.startupApplication.update({
        where: { id: applicationId },
        data: {
          isDuplicateFlagged: true,
          duplicateApplicationIds: duplicates.map(d => d.id)
        }
      });
    } else {
      await prisma.startupApplication.update({
        where: { id: applicationId },
        data: {
          isDuplicateFlagged: false,
          duplicateApplicationIds: []
        }
      });
    }
  }

  static async assignEvaluator(applicationId: string, evaluatorId: string) {
    const application = await prisma.startupApplication.update({
      where: { id: applicationId },
      data: {
        assignedToId: evaluatorId,
        status: ApplicationStatus.UNDER_REVIEW
      },
      include: { assignedTo: true }
    });
    // Push SSE event to the assigned staff member
    sseManager.send(evaluatorId, 'notification', {
      type: 'assignment',
      title: 'New Application Assigned',
      description: `${application.startupName} has been assigned to you for review.`,
      link: '/staff/reviews/assigned',
    });
    return application;
  }

  static async updateVerifiedDocs(applicationId: string, verifiedDocs: any) {
    console.log(`[DEBUG] Updating VerifiedDocs for App ${applicationId}:`, JSON.stringify(verifiedDocs, null, 2));
    return await prisma.startupApplication.update({
      where: { id: applicationId },
      data: { verifiedDocs }
    });
  }

  static async submitReview(applicationId: string, reviewerId: string, data: any) {
    console.log('[DEBUG] submitReview Payload:', JSON.stringify(data, null, 2));
    const {
      screeningScore = 0,
      businessScore = 0,
      marketScore = 0,
      innovationScore = 0,
      feasibilityScore = 0,
      totalScore = 0,
      uspNote,
      comments,
      recommendation,
      level,
      revisionForm
    } = data;

    console.log('[DEBUG] Processing Review Details:', {
      applicationId,
      reviewerId,
      level,
      recommendation,
      screeningScore,
      businessScore,
      totalScore,
      revisionForm
    });

    let updatedApplication: any;

    try {
      updatedApplication = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // 1. Fetch Reviewer details to check role
        const reviewer = await tx.user.findUnique({ where: { id: reviewerId } });
        const isSuperAdmin = reviewer?.role === 'SUPER_ADMIN';
        
        // If Super Admin reviews, we record it at CEO level to update the correct column
        const effectiveLevel = isSuperAdmin ? 'CEO' : level;

        // 2. Create the review record
        try {
          await tx.applicationReview.create({
            data: {
              applicationId,
              reviewerId,
              level: effectiveLevel as any,
              screeningScore: Number(screeningScore),
              businessScore: Number(businessScore),
              marketScore: Number(marketScore),
              innovationScore: Number(innovationScore),
              feasibilityScore: Number(feasibilityScore),
              totalScore: Number(totalScore),
              uspNote,
              comments,
              recommendation
            }
          });
        } catch (err: any) {
          console.error('[ERROR] ApplicationReview.create failed. Payload highlights:', {
            applicationId,
            reviewerId,
            effectiveLevel,
            recommendation
          });
          console.error('[ERROR] Prisma error details:', {
            code: err.code,
            message: err.message,
            stack: err.stack,
            meta: err.meta
          });
          throw err;
        }

        // 3. Update application status and level
        const application = await tx.startupApplication.findUnique({
          where: { id: applicationId },
          include: { user: true }
        });

        if (!application) throw new NotFoundError('Application not found');

        let nextStatus: ApplicationStatus = application.status;
        let nextLevel = application.currentLevel;

        if (recommendation === 'ACCEPT' || recommendation === 'SELECTED_FOR_PITCH') {
          // If Super Admin approves, it goes directly to APPROVED status
          if (isSuperAdmin || effectiveLevel === 'CEO') {
            nextStatus = (recommendation === 'SELECTED_FOR_PITCH') ? ApplicationStatus.SELECTED_FOR_PITCH : ApplicationStatus.APPROVED;
            nextLevel = 'CEO' as any;
          } else {
            // Standard promotion logic for regular admins/staff
            if (level === 'SCREENING') nextLevel = 'LEVEL_1' as any;
            else if (level === 'LEVEL_1') nextLevel = 'LEVEL_2' as any;
            else if (level === 'LEVEL_2') nextLevel = 'LEVEL_3' as any;
            else if (level === 'LEVEL_3') nextLevel = 'CEO' as any;
            
            // Determine status based on stage
            if (level === 'SCREENING') {
              nextStatus = ApplicationStatus.SUBMITTED;
            } else {
              nextStatus = ApplicationStatus.UNDER_REVIEW;
            }
          }
        } else if (recommendation === 'REVISE' || recommendation === 'USP') {
          // Handle revision request
          nextStatus = ApplicationStatus.RE_SUBMISSION_REQUIRED;
          // Keep the level as is, don't promote
        } else if (recommendation === 'REJECT') {
          nextStatus = ApplicationStatus.REJECTED;
        } else if (recommendation === 'HOLD') {
          nextStatus = ApplicationStatus.HOLD;
        }

        // 3b. Handle Granular Form Approvals
        const updateData: any = {
          status: nextStatus,
          currentLevel: nextLevel as any,
          reviewedBy: reviewerId,
          revisionForm: (recommendation === 'REVISE') ? revisionForm : null,
          rejectionReason: (recommendation === 'REJECT' || recommendation === 'HOLD' || recommendation === 'REVISE' || recommendation === 'USP') ? (comments || uspNote) : undefined,
          approvedAt: (nextStatus === ApplicationStatus.APPROVED || nextStatus === ApplicationStatus.SELECTED_FOR_PITCH) ? new Date() : undefined
        };

        // Set specific form approval flag if recommendation is ACCEPT
        if (recommendation === 'ACCEPT' || recommendation === 'SELECTED_FOR_PITCH') {
          if (revisionForm === 'A') updateData.isFormAApproved = true;
          else if (revisionForm === 'B') updateData.isFormBApproved = true;
          else if (revisionForm === 'C') updateData.isFormCApproved = true;
          else if (revisionForm === 'D') updateData.isFormDApproved = true;
          else if (revisionForm === 'E') updateData.isFormEApproved = true;
          else if (revisionForm === 'F') updateData.isFormFApproved = true;
          else if (revisionForm === 'G') updateData.isFormGApproved = true;
          else if (revisionForm === 'H') updateData.isFormHApproved = true;
          
          // Default behavior: If CEO/SuperAdmin approves the whole app and no specific form was chosen, 
          // it usually implies Form A (the initial submission) is approved.
          if ((isSuperAdmin || effectiveLevel === 'CEO') && !revisionForm) {
            updateData.isFormAApproved = true;
          }
        }

        try {
          return await (tx.startupApplication as any).update({
            where: { id: applicationId },
            data: updateData,
            include: { 
              user: true,
              reviews: true 
            }
          });
        } catch (err: any) {
          console.error('[ERROR] StartupApplication.update failed. UpdateData:', JSON.stringify(updateData, null, 2));
          console.error('[ERROR] Prisma error details:', {
            code: err.code,
            message: err.message,
            stack: err.stack,
            meta: err.meta
          });
          throw err;
        }
      }, {
        timeout: 15000 // Increase timeout to 15 seconds to be safe from slow DB locks
      });
    } catch (error) {
      console.error('[FATAL] submitReview Transaction Failed:', error);
      throw error;
    }

    // 4. Send Email Notification to Startup User (OUTSIDE of Transaction)
    if (updatedApplication) {
      try {
        const userEmail = updatedApplication.primaryEmail || updatedApplication.user?.email || updatedApplication.email;
        const startupName = updatedApplication.startupName;
        const subject = `Application Update: ${startupName}`;
        const html = this.generateReviewEmailTemplate(startupName, recommendation, comments || uspNote);
        
        // Final background send (non-blocking)
        sendEmail(userEmail, subject, html).catch(emailError => {
          console.error('[BACKGROUND ERROR] Failed to send review email:', emailError);
        });
      } catch (emailPrepError) {
        console.error('[ERROR] Background email preparation failed:', emailPrepError);
      }
    }

    return updatedApplication;
  }

  static async getAll() {
    const applications = await prisma.startupApplication.findMany({
      where: { status: { not: ApplicationStatus.DRAFT } },
      include: {
        user: true, 
        scheme: true, 
        assignedTo: {
          select: { id: true, name: true, email: true }
        },
        reviews: {
          include: {
            reviewer: {
              select: { name: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        formB: {
          include: {
            founders: true,
            ipRecords: true,
            fundingRecords: true,
            awards: true,
            shareholders: true
          }
        },
        grantAllocation: {
          include: {
            grant: true,
            tranches: {
              orderBy: {
                installmentNo: 'asc'
              }
            }
          }
        },
        generatedAgreements: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { createdAt: 'desc' }
    });


    // Map sector/sub-sector names for all applications efficiently
    const sectors = await prisma.sector.findMany({
      include: { subSectors: true }
    });
    const sectorMap = new Map(sectors.map((s: any) => [s.id, s.name]));
    const subSectorMap = new Map(sectors.flatMap((s: any) => s.subSectors).map((ss: any) => [ss.id, ss.name]));

    // Transform applications to include level statuses for the frontend table
    return applications.map((app: any) => {
      const levelStatuses = this.calculateLevelStatuses(app.reviews);
      return {
        ...app,
        mainSectorName: sectorMap.get(app.mainSector || "") || app.mainSector || "N/A",
        subSectorNames: (app.subSectors || []).map((sid: any) => subSectorMap.get(sid) || sid),
        ...levelStatuses
      };
    });
  }

  /**
   * Helper to calculate the status of each review level based on the reviews array.
   * Professional/Production level logic to ensure correct status is displayed in the UI.
   */
  private static calculateLevelStatuses(reviews: any[]) {
    const statuses = {
      level1Status: 'Pending',
      level2Status: 'Pending',
      level3Status: 'Pending',
      ceoStatus: 'Pending'
    };

    // Sort reviews by creation date to handle re-reviews if any
    const sortedReviews = [...reviews].sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    sortedReviews.forEach(review => {
        const status = review.recommendation === 'REJECT' ? 'Rejected' : 
                       (review.recommendation === 'ACCEPT' || review.recommendation === 'SELECTED_FOR_PITCH') ? 'Approved' : 
                       (review.recommendation === 'REVISE' || review.recommendation === 'USP') ? 'Revision' :
                       review.recommendation === 'HOLD' ? 'Hold' : 'Pending';

      if (review.level === 'LEVEL_1') statuses.level1Status = status;
      else if (review.level === 'LEVEL_2') statuses.level2Status = status;
      else if (review.level === 'LEVEL_3') statuses.level3Status = status;
      else if (review.level === 'CEO') statuses.ceoStatus = status;
    });

    return statuses;
  }

  static async getMyStats(userId: string) {
    const application = await prisma.startupApplication.findUnique({
      where: { userId },
      include: { 
        scheme: true,
        grantAllocation: {
          include: {
            grant: true,
            tranches: {
              include: {
                milestones: true
              },
              orderBy: { installmentNo: 'asc' }
            }
          }
        }
      }
    });

    if (!application) {
      return {
        overallProgress: 0,
        currentStage: 'No Application',
        forms: [
          { form: 'A', name: 'Basic Details', status: 'pending', progress: 0 },
          { form: 'B', name: 'Incubation Details', status: 'locked', progress: 0 },
          { form: 'C', name: 'Technical Details', status: 'locked', progress: 0 },
          { form: 'D', name: 'Financial Details', status: 'locked', progress: 0 },
          { form: 'E', name: 'Team Details', status: 'locked', progress: 0 },
          { form: 'F', name: 'Milestones', status: 'locked', progress: 0 },
          { form: 'G', name: 'Documents', status: 'locked', progress: 0 },
          { form: 'H', name: 'Declaration', status: 'locked', progress: 0 },
        ],
        stages: []
      };
    }

    const forms = [
      { form: 'A', name: 'Basic Details', status: application.isFormAApproved ? 'completed' : 'pending', progress: application.isFormASubmitted ? 100 : 0 },
      { form: 'B', name: 'Incubation Details', status: application.isFormAApproved ? (application.isFormBApproved ? 'completed' : (application.isFormBSubmitted ? 'pending' : 'pending')) : 'locked', progress: application.isFormBSubmitted ? 100 : 0 },
      { form: 'C', name: 'Incubation Agreement', status: application.isFormBApproved ? (application.isFormCApproved ? 'completed' : (application.isFormCSubmitted ? 'pending' : 'pending')) : 'locked', progress: application.isFormCSubmitted ? 100 : 0 },
      { form: 'D', name: 'Financial Details', status: application.isFormCApproved ? (application.isFormDApproved ? 'completed' : (application.isFormDSubmitted ? 'pending' : 'pending')) : 'locked', progress: application.isFormDSubmitted ? 100 : 0 },
      { form: 'E', name: 'Team Details', status: application.isFormDApproved ? (application.isFormEApproved ? 'completed' : (application.isFormESubmitted ? 'pending' : 'pending')) : 'locked', progress: application.isFormESubmitted ? 100 : 0 },
      { form: 'F', name: 'Milestones', status: application.isFormEApproved ? (application.isFormFApproved ? 'completed' : (application.isFormFSubmitted ? 'pending' : 'pending')) : 'locked', progress: application.isFormFSubmitted ? 100 : 0 },
      { form: 'G', name: 'Documents', status: application.isFormFApproved ? (application.isFormGApproved ? 'completed' : (application.isFormGSubmitted ? 'pending' : 'pending')) : 'locked', progress: application.isFormGSubmitted ? 100 : 0 },
      { form: 'H', name: 'Declaration', status: application.isFormGApproved ? (application.isFormHApproved ? 'completed' : (application.isFormHSubmitted ? 'pending' : 'pending')) : 'locked', progress: application.isFormHSubmitted ? 100 : 0 },
    ];

    const completedForms = forms.filter(f => f.status === 'completed').length;
    const overallProgress = Math.round((completedForms / forms.length) * 100);

    // 4. Fetch reviews for dynamic stages and timeline
    const applicationWithReviews = await prisma.startupApplication.findUnique({
      where: { userId },
      include: { 
        reviews: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    const reviews = applicationWithReviews?.reviews || [];

    // Map stages based on status and reviews
    const allStages = [
      { 
        name: "Application Submitted", 
        status: application.isFormASubmitted ? "completed" : "pending", 
        date: application.isFormASubmitted ? application.updatedAt.toISOString().split('T')[0] : null,
        remarks: application.isFormASubmitted ? "Form A submitted successfully" : null
      },
      { 
        name: "Screening", 
        status: reviews.some((r: any) => r.level === 'SCREENING') ? "completed" : (application.status === 'SUBMITTED' ? "current" : "pending"),
        date: reviews.find((r: any) => r.level === 'SCREENING')?.createdAt.toISOString().split('T')[0] || null,
        remarks: reviews.find((r: any) => r.level === 'SCREENING')?.comments || null
      },
      { 
        name: "Level-1 Review", 
        status: reviews.some((r: any) => r.level === 'LEVEL_1') ? "completed" : (application.currentLevel === 'LEVEL_1' ? "current" : "pending"),
        date: reviews.find((r: any) => r.level === 'LEVEL_1')?.createdAt.toISOString().split('T')[0] || null,
        remarks: reviews.find((r: any) => r.level === 'LEVEL_1')?.comments || null
      },
      { 
        name: "Level-2 Review", 
        status: reviews.some((r: any) => r.level === 'LEVEL_2') ? "completed" : (application.currentLevel === 'LEVEL_2' ? "current" : "pending"),
        date: reviews.find((r: any) => r.level === 'LEVEL_2')?.createdAt.toISOString().split('T')[0] || null,
        remarks: reviews.find((r: any) => r.level === 'LEVEL_2')?.comments || null
      },
      { 
        name: "Level-3 Review", 
        status: reviews.some((r: any) => r.level === 'LEVEL_3') ? "completed" : (application.currentLevel === 'LEVEL_3' ? "current" : "pending"),
        date: reviews.find((r: any) => r.level === 'LEVEL_3')?.createdAt.toISOString().split('T')[0] || null,
        remarks: reviews.find((r: any) => r.level === 'LEVEL_3')?.comments || null
      },
      { 
        name: "CEO Approval", 
        status: application.status === 'APPROVED' || application.status === 'SELECTED_FOR_PITCH' ? "completed" : (application.currentLevel === 'CEO' ? "current" : "pending"),
        date: application.approvedAt ? application.approvedAt.toISOString().split('T')[0] : null,
        remarks: reviews.find((r: any) => r.level === 'CEO')?.comments || null
      },
    ];

    // Build timeline
    const timeline = [];
    timeline.push({
      date: application.createdAt.toISOString().split('T')[0],
      event: "Application Started",
      type: "milestone"
    });

    if (application.isFormASubmitted) {
      timeline.push({
        date: application.updatedAt.toISOString().split('T')[0],
        event: "Application Submitted",
        type: "milestone"
      });
    }

    reviews.forEach((review: any) => {
      timeline.push({
        date: review.createdAt.toISOString().split('T')[0],
        event: `${review.level.replace('_', ' ')} Review - ${review.recommendation}`,
        type: review.recommendation === 'REJECT' ? 'action' : 'update'
      });
    });

    if (application.status === 'APPROVED' || application.status === 'SELECTED_FOR_PITCH') {
      timeline.push({
        date: application.approvedAt?.toISOString().split('T')[0],
        event: `Application ${application.status.replace('_', ' ')}`,
        type: "milestone"
      });
    }

    // Determine current stage
    let currentStage = 'Draft';
    if (application.status === 'SUBMITTED') currentStage = 'Form A Submitted';
    else if (application.status === 'UNDER_REVIEW') currentStage = 'Under Review';
    else if (application.status === 'APPROVED') currentStage = 'Approved';
    else if (application.status === 'REJECTED') currentStage = 'Rejected';
    else if (application.status === 'HOLD') currentStage = 'On Hold';
    else if (application.status === 'RE_SUBMISSION_REQUIRED') currentStage = 'Re-submission Required';

    // Derive Action Items
    const actionItems: { id: number, title: string, desc: string, type: string, time: string }[] = [];
    
    if (!application.isFormASubmitted) {
      actionItems.push({ id: 1, title: 'Submit Form A', desc: 'Basic details are pending', type: 'error', time: 'High Priority' });
    } else if (application.status === 'APPROVED' || application.status === 'SELECTED_FOR_PITCH') {
      if (!application.isFormBSubmitted) {
        actionItems.push({ id: 2, title: 'Submit Form B', desc: 'Incubation details are pending', type: 'warning', time: 'Next Step' });
      } else if (!application.isFormCSubmitted) {
        actionItems.push({ id: 3, title: 'Submit Form C', desc: 'Incubation agreement is pending', type: 'warning', time: 'Next Step' });
      }
    }

    if (application.status === 'RE_SUBMISSION_REQUIRED') {
      actionItems.push({ id: 4, title: 'Revision Required', desc: application.rejectionReason || 'Please check comments', type: 'error', time: 'Action Needed' });
    }

    // Grant Summary Calculation
    const allocation = application.grantAllocation;
    const tranchesData = (allocation?.tranches || []).map((t: any) => ({
      no: t.installmentNo,
      amount: t.amount,
      status: t.status?.toUpperCase() === 'RELEASED' ? 'Released' : (t.status?.toUpperCase() === 'ELIGIBLE' ? 'Eligible' : 'Pending')
    }));

    const grantSummary = {
      sanctioned: allocation?.sanctionedAmount || 0,
      released: (allocation?.tranches || []).filter((t: any) => t.status?.toUpperCase() === 'RELEASED').reduce((s: number, t: any) => s + t.amount, 0),
      utilised: allocation?.totalUtilised || 0,
      balance: (allocation?.sanctionedAmount || 0) - (allocation?.totalUtilised || 0),
      tranches: tranchesData
    };

    // Fetch all milestones for the startup, not just tranche-linked ones
    const allMilestones = await prisma.milestone.findMany({
      where: { startupId: userId },
      orderBy: { plannedEnd: 'asc' }
    });
    const totalMilestones = allMilestones.length;
    const milestonesDone = allMilestones.filter((m: any) => m.status === 'COMPLETED' || m.status === 'Completed').length;

    // Fetch all progress reports with assessments
    const progressReports = await prisma.startupProgressReport.findMany({
      where: { startupId: userId },
      include: { assessment: true },
      orderBy: { periodFrom: 'asc' }
    });

    return {
      overallProgress,
      currentStage,
      forms,
      stages: allStages,
      timeline,
      submissionDate: application.isFormASubmitted ? application.updatedAt.toISOString().split('T')[0] : null,
      applicationNo: application.applicationNo,
      startupName: application.startupName,
      actionItems,
      grantSummary,
      totalMilestones,
      milestonesDone,
      milestones: allMilestones,
      progressReports
    };
  }

  static async getStats() {
    // 1. Application counts by status
    const statusStats = await prisma.startupApplication.groupBy({
      by: ['status'],
      _count: {
        _all: true
      }
    });

    // 2. HR Strength count (Admin + Staff)
    const hrStrength = await prisma.user.count({
      where: {
        userRoles: {
          some: {
            role: {
              name: { in: ['ADMIN', 'STAFF'] }
            }
          }
        },
        isActive: true
      }
    });

    // 3. Actual grant stats
    const grantStats = await prisma.startupGrantAllocation.aggregate({
      _sum: {
        sanctionedAmount: true,
        totalReleased: true
      }
    });

    const totalGrantsSanctioned = grantStats._sum.sanctionedAmount || 0;
    const totalGrantsReleased = grantStats._sum.totalReleased || 0;

    // 4. Fetch all schemes with applications for dynamic breakdown
    const schemes = await prisma.scheme.findMany({
      include: {
        applications: true
      }
    });

    const schemeBreakdown = schemes.map((sch: any, idx: number) => {
      const apps = sch.applications || [];
      const activeApps = apps.filter((a: any) => a.status !== 'DRAFT');
      const total = activeApps.length;
      const newCount = activeApps.filter((a: any) => a.status === 'SUBMITTED').length;
      const accepted = activeApps.filter((a: any) => a.status === 'APPROVED').length;
      const rejected = activeApps.filter((a: any) => a.status === 'REJECTED').length;
      const inReview = total - (newCount + accepted + rejected);

      return {
        name: sch.name,
        total,
        new: newCount,
        inReview,
        accepted,
        rejected,
        color: `bg-chart-${(idx % 5) + 1}`,
      };
    });

    // 5. Dynamic Sector Distribution
    const sectorStats = await prisma.startupApplication.groupBy({
      by: ['mainSector'],
      where: {
        status: { not: 'DRAFT' }
      },
      _count: {
        _all: true
      }
    });

    const sectors = await prisma.sector.findMany({
      select: { id: true, name: true }
    });
    const sectorMap = new Map(sectors.map((s: any) => [s.id, s.name]));

    const totalActiveApps = sectorStats.reduce((sum, item) => sum + item._count._all, 0);
    const sectorColors = [
      "hsl(220, 60%, 40%)",
      "hsl(175, 60%, 45%)",
      "hsl(35, 100%, 50%)",
      "hsl(270, 60%, 55%)",
      "hsl(0, 72%, 51%)",
      "hsl(215, 20%, 65%)"
    ];

    const sectorDistribution = sectorStats.map((item, idx) => {
      const sectorName = sectorMap.get(item.mainSector || "") || item.mainSector || "Unknown";
      return {
        name: sectorName,
        value: item._count._all,
        color: sectorColors[idx % sectorColors.length]
      };
    }).sort((a, b) => b.value - a.value);

    // 6. Performance Metrics
    const allApproved = await prisma.startupApplication.findMany({
      where: {
        status: 'APPROVED',
        approvedAt: { not: null }
      },
      select: {
        createdAt: true,
        approvedAt: true
      }
    });

    let avgProcessingTime = "0 days";
    if (allApproved.length > 0) {
      const totalDays = allApproved.reduce((sum, app) => {
        const diff = new Date(app.approvedAt!).getTime() - new Date(app.createdAt).getTime();
        return sum + diff / (1000 * 60 * 60 * 24);
      }, 0);
      avgProcessingTime = `${Math.max(1, Math.round(totalDays / allApproved.length))} days`;
    }

    const approvedCount = await prisma.startupApplication.count({ where: { status: 'APPROVED' } });
    const rejectedCount = await prisma.startupApplication.count({ where: { status: 'REJECTED' } });
    const totalDecided = approvedCount + rejectedCount;
    const approvalRate = totalDecided > 0 ? `${Math.round((approvedCount / totalDecided) * 100)}%` : "0%";

    const pendingReviewsCount = await prisma.startupApplication.count({
      where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } }
    });

    const totalUCs = await prisma.utilisationCertificate.count();
    const approvedUCs = await prisma.utilisationCertificate.count({ where: { status: 'APPROVED' } });
    const ucCompliance = totalUCs > 0 ? `${Math.round((approvedUCs / totalUCs) * 100)}%` : "0%";

    const performanceMetrics = [
      { label: "Avg. Processing Time", value: avgProcessingTime, trend: "stable", change: "0 days", good: true },
      { label: "Approval Rate", value: approvalRate, trend: "stable", change: "0%", good: true },
      { label: "UC Compliance", value: ucCompliance, trend: "stable", change: "0%", good: true },
      { label: "Pending Reviews", value: pendingReviewsCount.toString(), trend: "stable", change: "0", good: true }
    ];

    // 7. Recent Activity logs
    const recentApps = await prisma.startupApplication.findMany({
      orderBy: { createdAt: 'desc' },
      take: 3,
      include: { scheme: true }
    });

    const recentReviews = await prisma.applicationReview.findMany({
      orderBy: { createdAt: 'desc' },
      take: 3,
      include: { application: true }
    });

    const recentActivities: any[] = [];
    recentApps.forEach(app => {
      recentActivities.push({
        icon: "FileText",
        title: "New application submitted",
        description: `${app.startupName} submitted ${app.scheme?.name || "Application"}`,
        timestamp: app.createdAt.getTime(),
        iconBg: "bg-blue-100 text-blue-600"
      });
    });

    recentReviews.forEach(rev => {
      recentActivities.push({
        icon: "UserCheck",
        title: "Application reviewed",
        description: `Review submitted for ${rev.application?.startupName}`,
        timestamp: rev.createdAt.getTime(),
        iconBg: "bg-emerald-100 text-emerald-600"
      });
    });

    // Sort combined activities by timestamp desc
    const combinedActivity = recentActivities
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 6)
      .map(act => {
        const minutes = Math.max(1, Math.round((Date.now() - act.timestamp) / (1000 * 60)));
        let timeStr = `${minutes} min ago`;
        if (minutes >= 60) {
          const hours = Math.round(minutes / 60);
          timeStr = `${hours} hour${hours > 1 ? 's' : ''} ago`;
          if (hours >= 24) {
            timeStr = `${Math.round(hours / 24)} days ago`;
          }
        }
        return {
          icon: act.icon,
          title: act.title,
          description: act.description,
          time: timeStr,
          iconBg: act.iconBg
        };
      });

    // 8. Dynamic Milestone Tracking
    const milestones = await prisma.milestone.findMany();
    const milestoneTracking = [
      { label: "Tranche 1", progress: 0, color: "bg-green-500" },
      { label: "Tranche 2", progress: 0, color: "bg-blue-500" },
      { label: "Tranche 3", progress: 0, color: "bg-amber-500" },
      { label: "Tranche 4", progress: 0, color: "bg-gray-500" }
    ];

    if (milestones.length > 0) {
      const completed = milestones.filter(m => m.status === 'COMPLETED').length;
      const progress = Math.round((completed / milestones.length) * 100);
      milestoneTracking[0].progress = progress;
      milestoneTracking[1].progress = Math.round(progress * 0.7);
      milestoneTracking[2].progress = Math.round(progress * 0.4);
      milestoneTracking[3].progress = Math.round(progress * 0.1);
    }

    // 9. SPR Monitoring stats
    const totalSprs = await prisma.startupProgressReport.count();
    const submittedSprs = await prisma.startupProgressReport.count({ where: { status: 'SUBMITTED' } });
    const approvedSprs = await prisma.startupProgressReport.count({ where: { status: 'APPROVED' } });
    
    const assessments = await prisma.sPRAssessment.findMany({
      select: { healthScore: true }
    });
    const avgScore = assessments.length > 0 
      ? Math.round(assessments.reduce((sum, a) => sum + (a.healthScore || 0), 0) / assessments.length)
      : 0;

    const overdueReports = await prisma.startupProgressReport.findMany({
      where: {
        status: 'SUBMITTED'
      },
      include: {
        startup: {
          select: {
            name: true,
            startupProfile: {
              select: {
                companyName: true
              }
            }
          }
        },
        assessment: true
      },
      orderBy: { submissionDate: 'desc' },
      take: 5
    });

    const overdueList = overdueReports.map(rep => {
      const companyName = rep.startup?.startupProfile?.companyName || rep.startup?.name || "Unknown Startup";
      return {
        startup: companyName,
        status: "Submitted",
        days: 1,
        score: rep.assessment?.healthScore || 70
      };
    });

    const sprMonitoring = {
      due: totalSprs - approvedSprs,
      submitted: submittedSprs,
      pending: Math.max(0, totalSprs - approvedSprs - submittedSprs),
      overdue: totalSprs - approvedSprs,
      avgScore,
      overdueList
    };

    const result = {
      total: 0,
      submitted: 0, // New / Not Started
      under_review: 0, // In Review
      approved: 0, // Accepted
      rejected: 0, // Rejected
      hrStrength,
      filesInMovement: 0,
      draft: 0,
      re_submission_required: 0,
      hold: 0,
      selected_for_pitch: 0,
      formBPending: 0,
      totalGrantsSanctioned,
      totalGrantsReleased,
      schemeBreakdown,
      sectorDistribution,
      performanceMetrics,
      recentActivity: combinedActivity,
      milestoneTracking,
      sprMonitoring
    };

    // Count Form B pending approval (Approved Form A but waiting for Form B approval)
    result.formBPending = await prisma.startupApplication.count({
      where: {
        status: ApplicationStatus.APPROVED,
        isFormBSubmitted: true,
        isFormBApproved: false
      }
    });

    let totalMoving = 0;

    statusStats.forEach((s: any) => {
      const statusKey = s.status.toLowerCase() as keyof typeof result;
      if (statusKey in result) {
        (result as any)[statusKey] = s._count._all;
      }
      
      // Calculate total applications (excluding DRAFT)
      if (s.status !== 'DRAFT') {
        result.total += s._count._all;
      }

      // Calculate "Files in Movement" (Anything that is not Draft, Approved, or Rejected)
      if (!['DRAFT', 'APPROVED', 'REJECTED'].includes(s.status)) {
        totalMoving += s._count._all;
      }
    });

    result.filesInMovement = totalMoving;
    return result;
  }

  static async getStaffStats(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Assigned Reviews (Queue)
    const assignedCount = await prisma.startupApplication.count({
      where: {
        OR: [
          { assignedToId: userId },
          { assignedToId: null }
        ],
        status: { in: ['SUBMITTED', 'UNDER_REVIEW'] }
      }
    });

    // 2. Completed Today
    const completedTodayCount = await prisma.applicationReview.count({
      where: {
        reviewerId: userId,
        createdAt: { gte: today }
      }
    });

    // 3. Total Completed by this user
    const totalCompletedCount = await prisma.applicationReview.count({
      where: {
        reviewerId: userId
      }
    });

    // 4. SLA Breaches (Example: Assigned more than 7 days ago and still pending)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const slaBreaches = await prisma.startupApplication.count({
      where: {
        assignedToId: userId,
        status: { in: ['SUBMITTED', 'UNDER_REVIEW'] },
        updatedAt: { lt: sevenDaysAgo } // Using updatedAt as proxy for assignment time if not explicitly tracked
      }
    });

    // 5. Completed This Month
    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    firstOfMonth.setHours(0, 0, 0, 0);
    const completedThisMonthCount = await prisma.applicationReview.count({
      where: { reviewerId: userId, createdAt: { gte: firstOfMonth } }
    });

    // 6. Recent Activity (Last 5 reviews/comments)
    const recentReviews = await prisma.applicationReview.findMany({
      where: { reviewerId: userId },
      include: { application: true },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    return {
      assignedCount,
      completedTodayCount,
      totalCompletedCount,
      completedThisMonthCount,
      slaBreaches,
      recentActivity: recentReviews.map((r: any) => ({
        action: `Submitted review for ${r.application.startupName}`,
        time: r.createdAt,
        type: 'review'
      }))
    };
  }

  static async getStaffPerformance(userId: string) {
    // Last 6 months breakdown
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      d.setMonth(d.getMonth() - i);
      return d;
    }).reverse();

    const monthlyBreakdown = await Promise.all(
      months.map(async (start) => {
        const end = new Date(start);
        end.setMonth(end.getMonth() + 1);

        const reviews = await prisma.applicationReview.findMany({
          where: { reviewerId: userId, createdAt: { gte: start, lt: end } },
          select: { recommendation: true, totalScore: true }
        });

        const accepted = reviews.filter(r => r.recommendation === 'ACCEPT').length;
        const revised  = reviews.filter(r => r.recommendation === 'REVISE').length;
        const avgScore = reviews.length > 0
          ? reviews.reduce((s, r) => s + r.totalScore, 0) / reviews.length
          : 0;

        return {
          month: start.toLocaleString('en-IN', { month: 'long', year: 'numeric' }),
          total: reviews.length,
          accepted,
          revised,
          avgScore: Math.round(avgScore * 10) / 10,
        };
      })
    );

    // Overall SLA
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const [totalAssigned, slaBreaches] = await Promise.all([
      prisma.startupApplication.count({ where: { assignedToId: userId } }),
      prisma.startupApplication.count({
        where: { assignedToId: userId, status: { in: ['SUBMITTED', 'UNDER_REVIEW'] }, updatedAt: { lt: sevenDaysAgo } }
      }),
    ]);
    const slaCompliance = totalAssigned === 0 ? 100 : Math.round(((totalAssigned - slaBreaches) / totalAssigned) * 100);

    // Quarter count (last 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const quarterCount = await prisma.applicationReview.count({
      where: { reviewerId: userId, createdAt: { gte: ninetyDaysAgo } }
    });

    // All-time avg score
    const allReviews = await prisma.applicationReview.findMany({
      where: { reviewerId: userId },
      select: { totalScore: true }
    });
    const avgScoreAllTime = allReviews.length > 0
      ? Math.round((allReviews.reduce((s, r) => s + r.totalScore, 0) / allReviews.length) * 10) / 10
      : 0;

    // Sector breakdown — join reviews → applications → mainSector
    const reviewedApps = await prisma.applicationReview.findMany({
      where: { reviewerId: userId },
      select: { recommendation: true, application: { select: { mainSector: true } } }
    });

    const sectorMap: Record<string, { count: number; accepted: number }> = {};
    for (const r of reviewedApps) {
      const sector = (r.application as any)?.mainSector || 'Other';
      if (!sectorMap[sector]) sectorMap[sector] = { count: 0, accepted: 0 };
      sectorMap[sector].count++;
      if (r.recommendation === 'ACCEPT') sectorMap[sector].accepted++;
    }
    const total = reviewedApps.length;
    const sectorBreakdown = Object.entries(sectorMap)
      .map(([sector, v]) => ({
        sector,
        count: v.count,
        accepted: v.accepted,
        percentage: total > 0 ? Math.round((v.count / total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const totalAccepted = reviewedApps.filter(r => r.recommendation === 'ACCEPT').length;
    const totalRevised  = reviewedApps.filter(r => r.recommendation === 'REVISE').length;
    const totalRejected = reviewedApps.filter(r => r.recommendation === 'REJECT').length;
    const acceptanceRate = total > 0 ? Math.round((totalAccepted / total) * 100) : 0;

    return {
      monthlyBreakdown,
      slaCompliance,
      quarterCount,
      avgScoreAllTime,
      totalReviews: allReviews.length,
      totalAccepted,
      totalRevised,
      totalRejected,
      acceptanceRate,
      sectorBreakdown,
    };
  }

  private static generateReviewEmailTemplate(startupName: string, recommendation: string, reason?: string) {
    let statusText = '';
    let message = '';
    let color = '#2563eb'; // Default blue

    switch (recommendation) {
      case 'ACCEPT':
        statusText = 'Approved';
        message = 'Congratulations! Your application has been approved.';
        color = '#16a34a'; // Green
        break;
      case 'SELECTED_FOR_PITCH':
        statusText = 'Selected for Pitch';
        message = 'Congratulations! Your application has been selected for a pitch session.';
        color = '#7c3aed'; // Purple
        break;
      case 'REJECT':
        statusText = 'Rejected';
        message = 'We regret to inform you that your application has been rejected.';
        color = '#dc2626'; // Red
        break;
      case 'REVISE':
      case 'USP':
        statusText = 'Revision Required';
        message = 'Your application requires some revisions or additional information.';
        color = '#ea580c'; // Orange
        break;
      case 'HOLD':
        statusText = 'On Hold';
        message = 'Your application has been placed on hold.';
        color = '#4b5563'; // Gray
        break;
      default:
        statusText = 'Updated';
        message = 'There has been an update to your application status.';
    }

    return `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
        <h2 style="color: ${color}; margin-top: 0;">Application Status: ${statusText}</h2>
        <p>Dear <strong>${startupName}</strong> Team,</p>
        <p>${message}</p>
        ${reason ? `<div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;"><strong>Comments/Reason:</strong><br/>${reason}</div>` : ''}
        <p>You can view more details by logging into your dashboard.</p>
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 0.875rem; color: #6b7280;">
          Regards,<br/>
          <strong>GTU Team</strong>
        </div>
      </div>
    `;
  }

  private static generateCustomEmailTemplate(startupName: string, message: string) {
    return `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
        <h2 style="color: #7c3aed; margin-top: 0;">Message from GTU Team</h2>
        <p>Dear <strong>${startupName}</strong> Team,</p>
        <div style="white-space: pre-wrap; margin: 20px 0; line-height: 1.5; color: #1f2937;">${message}</div>
        <p>If you have any questions, you can view details or respond by logging into your dashboard.</p>
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 0.875rem; color: #6b7280;">
          Regards,<br/>
          <strong>GTU Team</strong>
        </div>
      </div>
    `;
  }

  static async sendEmailToStartup(id: string, to: string, subject: string, message: string) {
    const application = await prisma.startupApplication.findUnique({
      where: { id }
    });
    if (!application) {
      throw new NotFoundError('Application not found');
    }

    const html = this.generateCustomEmailTemplate(application.startupName, message);
    await sendEmail(to, subject, html);
    return { success: true };
  }

}
