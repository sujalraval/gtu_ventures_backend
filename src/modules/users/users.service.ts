import { Prisma } from "@prisma/client";
import prisma from "../../lib/prisma";
import { CreateUserInput } from "./users.schema";

export class UsersService {
  async createUser(data: CreateUserInput) {
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 0. Lookup OrgRole to get code (for User enum)
      const orgRole = await tx.orgRole.findUnique({ where: { id: data.roles.roleId } });
      const roleCode = (orgRole?.code as any) || "STAFF";

      // 1. Create Core User
      const user = await tx.user.create({
        data: {
          email: data.personal.email,
          name: `${data.personal.firstName} ${data.personal.lastName}`,
          role: roleCode, // Use code from OrgRole
          isActive: data.personal.status === "active",
        },
      });

      // 1a. Create UserRole mapping (Critical for permission system)
      await tx.userRole.create({
        data: {
          userId: user.id,
          roleId: data.roles.roleId,
          isDefault: true,
        },
      });

      // 2. Create Personal Details
      await tx.userPersonalDetails.create({
        data: {
          userId: user.id,
          title: data.personal.title,
          firstName: data.personal.firstName,
          lastName: data.personal.lastName,
          gender: data.personal.gender,
          dob: new Date(data.personal.dob),
          pob: data.personal.pob,
          maritalStatus: data.personal.maritalStatus,
          category: data.personal.category,
          bloodGroup: data.personal.bloodGroup,
          pan: data.personal.pan?.replace(/\s/g, ""),
          aadhaar: data.personal.aadhaar?.replace(/\s/g, ""),
          fatherSpouseName: data.personal.fatherSpouseName,
          phone: data.personal.phone,
          staffCode: data.personal.staffCode,
          punchId: data.personal.punchId,
          shift: data.personal.shift,
          policy: data.personal.policy,
          status: data.personal.status,
          isPartTime: data.personal.isPartTime,
          isExternalStaff: data.personal.isExternalStaff,
        },
      });

      // 3. Create Addresses
      await tx.userAddress.createMany({
        data: [
          {
            userId: user.id,
            type: "RESIDENTIAL",
            addressLine: data.address.residential.addressLine,
            city: data.address.residential.city,
            state: data.address.residential.state,
            country: data.address.residential.country,
            pinCode: data.address.residential.pinCode,
            isDefault: true,
          },
          {
            userId: user.id,
            type: "COMMUNICATION",
            addressLine: data.address.communication.addressLine,
            city: data.address.communication.city,
            state: data.address.communication.state,
            country: data.address.communication.country,
            pinCode: data.address.communication.pinCode,
            isDefault: false,
          },
        ],
      });

      // 4. Create Department Mapping
      await tx.userDepartmentMapping.create({
        data: {
          userId: user.id,
          institutionId: data.department.institutionId,
          departmentId: data.department.departmentId,
          designationId: data.department.designationId,
          dateOfJoining: new Date(data.department.dateOfJoining),
          leaveDate: data.department.leaveDate ? new Date(data.department.leaveDate) : null,
          isDefault: data.department.isDefault,
        },
      });

      // 5. Create Reporting Hierarchy
      await tx.userReportingHierarchy.create({
        data: {
          userId: user.id,
          reportLevel1: data.roles.reportLevel1,
          reportLevel2: data.roles.reportLevel2,
          reportLevel3: data.roles.reportLevel3,
          reportLevel4: data.roles.reportLevel4,
          reportLevel5: data.roles.reportLevel5,
          reportLevel6: data.roles.reportLevel6,
          reportLevel7: data.roles.reportLevel7,
          reportLevel8: data.roles.reportLevel8,
        },
      });

      // 6. Create Bank Details
      await tx.userBankDetails.create({
        data: {
          userId: user.id,
          bankName: data.bank.bankName,
          accountHolder: data.bank.accountHolder,
          accountNo: data.bank.accountNo,
          ifsc: data.bank.ifsc,
          branchName: data.bank.branchName,
          status: data.bank.status,
        },
      });

      // 7. Create Leave Entitlements
      if (data.leave && data.leave.length > 0) {
        await tx.userLeaveEntitlement.createMany({
          data: data.leave.map((l: any) => ({
            userId: user.id,
            academicYear: l.academicYear,
            leaveType: l.leaveType,
            totalLeave: l.totalLeave,
          })),
        });
      }

      // 8. Create Experience
      if (data.experience && data.experience.length > 0) {
        await tx.userExperience.createMany({
          data: data.experience.map((e: any) => ({
            userId: user.id,
            sector: e.sector,
            subSector: e.subSector,
            institutionName: e.institutionName,
            yearsOfExp: e.yearsOfExp,
          })),
        });
      }

      // 9. Create Education
      await tx.userEducation.create({
        data: {
          userId: user.id,
          qualification: data.education.qualification,
          passingDate: data.education.passingDate ? new Date(data.education.passingDate) : null,
        },
      });

      // 10. Create Professional Metrics
      if (data.professionalMetrics) {
        await tx.userProfessionalMetrics.create({
          data: {
            userId: user.id,
            technicalSkills: data.professionalMetrics.technicalSkills,
            domainExpertise: data.professionalMetrics.domainExpertise,
            certifications: data.professionalMetrics.certifications,
          },
        });
      }

      return user;
    });
  }

  async getAllUsers() {
    return await prisma.user.findMany({
      where: { deletedAt: null },
      include: {
        personalDetails: true,
        departmentMappings: {
          include: {
            institution: true,
            department: true,
            designation: true,
          },
        },
        addresses: true,
        reportingHierarchy: true,
        bankDetails: true,
        leaveEntitlements: true,
        experience: true,
        education: true,
        professionalMetrics: true,
        documents: true,
        startupProfile: true,
        startupApplication: {
          include: {
            formB: true,
          }
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async getUserById(id: string) {
    return await prisma.user.findUnique({
      where: { id },
      include: {
        personalDetails: true,
        departmentMappings: {
          include: {
            institution: true,
            department: true,
            designation: true,
          },
        },
        addresses: true,
        reportingHierarchy: true,
        bankDetails: true,
        leaveEntitlements: true,
        experience: true,
        education: true,
        professionalMetrics: true,
        documents: true,
      },
    });
  }

  async updateUser(id: string, data: CreateUserInput) {
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 0. Lookup OrgRole to get code (for User enum)
      const orgRole = await tx.orgRole.findUnique({ where: { id: data.roles.roleId } });
      const roleCode = (orgRole?.code as any) || "STAFF";

      // 1. Update Core User
      const user = await tx.user.update({
        where: { id },
        data: {
          email: data.personal.email,
          name: `${data.personal.firstName} ${data.personal.lastName}`,
          role: roleCode, // Update role code from OrgRole
          isActive: data.personal.status === "active",
        },
      });

      // 1a. Update UserRole mapping (Replace strategy)
      await tx.userRole.deleteMany({ where: { userId: id } });
      await tx.userRole.create({
        data: {
          userId: id,
          roleId: data.roles.roleId,
          isDefault: true,
        },
      });

      // 2. Update Personal Details
      await tx.userPersonalDetails.upsert({
        where: { userId: id },
        create: {
          userId: id,
          title: data.personal.title,
          firstName: data.personal.firstName,
          lastName: data.personal.lastName,
          gender: data.personal.gender,
          dob: new Date(data.personal.dob),
          pob: data.personal.pob,
          maritalStatus: data.personal.maritalStatus,
          category: data.personal.category,
          bloodGroup: data.personal.bloodGroup,
          pan: data.personal.pan?.replace(/\s/g, ""),
          aadhaar: data.personal.aadhaar?.replace(/\s/g, ""),
          fatherSpouseName: data.personal.fatherSpouseName,
          phone: data.personal.phone,
          staffCode: data.personal.staffCode,
          punchId: data.personal.punchId,
          shift: data.personal.shift,
          policy: data.personal.policy,
          status: data.personal.status,
          isPartTime: data.personal.isPartTime,
          isExternalStaff: data.personal.isExternalStaff,
        },
        update: {
          title: data.personal.title,
          firstName: data.personal.firstName,
          lastName: data.personal.lastName,
          gender: data.personal.gender,
          dob: new Date(data.personal.dob),
          pob: data.personal.pob,
          maritalStatus: data.personal.maritalStatus,
          category: data.personal.category,
          bloodGroup: data.personal.bloodGroup,
          pan: data.personal.pan?.replace(/\s/g, ""),
          aadhaar: data.personal.aadhaar?.replace(/\s/g, ""),
          fatherSpouseName: data.personal.fatherSpouseName,
          phone: data.personal.phone,
          staffCode: data.personal.staffCode,
          punchId: data.personal.punchId,
          shift: data.personal.shift,
          policy: data.personal.policy,
          status: data.personal.status,
          isPartTime: data.personal.isPartTime,
          isExternalStaff: data.personal.isExternalStaff,
        },
      });

      // 3. Update Addresses (Replace strategy)
      await tx.userAddress.deleteMany({ where: { userId: id } });
      await tx.userAddress.createMany({
        data: [
          {
            userId: id,
            type: "RESIDENTIAL",
            addressLine: data.address.residential.addressLine,
            city: data.address.residential.city,
            state: data.address.residential.state,
            country: data.address.residential.country,
            pinCode: data.address.residential.pinCode,
            isDefault: true,
          },
          {
            userId: id,
            type: "COMMUNICATION",
            addressLine: data.address.communication.addressLine,
            city: data.address.communication.city,
            state: data.address.communication.state,
            country: data.address.communication.country,
            pinCode: data.address.communication.pinCode,
            isDefault: false,
          },
        ],
      });

      // 4. Update Department Mapping
      await tx.userDepartmentMapping.deleteMany({ where: { userId: id } });
      await tx.userDepartmentMapping.create({
        data: {
          userId: id,
          institutionId: data.department.institutionId,
          departmentId: data.department.departmentId,
          designationId: data.department.designationId,
          dateOfJoining: new Date(data.department.dateOfJoining),
          leaveDate: data.department.leaveDate ? new Date(data.department.leaveDate) : null,
          isDefault: data.department.isDefault,
        },
      });

      // 5. Update Reporting Hierarchy
      await tx.userReportingHierarchy.upsert({
        where: { userId: id },
        create: {
          userId: id,
          reportLevel1: data.roles.reportLevel1,
          reportLevel2: data.roles.reportLevel2,
          reportLevel3: data.roles.reportLevel3,
          reportLevel4: data.roles.reportLevel4,
          reportLevel5: data.roles.reportLevel5,
          reportLevel6: data.roles.reportLevel6,
          reportLevel7: data.roles.reportLevel7,
          reportLevel8: data.roles.reportLevel8,
        },
        update: {
          reportLevel1: data.roles.reportLevel1,
          reportLevel2: data.roles.reportLevel2,
          reportLevel3: data.roles.reportLevel3,
          reportLevel4: data.roles.reportLevel4,
          reportLevel5: data.roles.reportLevel5,
          reportLevel6: data.roles.reportLevel6,
          reportLevel7: data.roles.reportLevel7,
          reportLevel8: data.roles.reportLevel8,
        },
      });

      // 6. Update Bank Details
      await tx.userBankDetails.upsert({
        where: { userId: id },
        create: {
          userId: id,
          bankName: data.bank.bankName,
          accountHolder: data.bank.accountHolder,
          accountNo: data.bank.accountNo,
          ifsc: data.bank.ifsc,
          branchName: data.bank.branchName,
          status: data.bank.status,
        },
        update: {
          bankName: data.bank.bankName,
          accountHolder: data.bank.accountHolder,
          accountNo: data.bank.accountNo,
          ifsc: data.bank.ifsc,
          branchName: data.bank.branchName,
          status: data.bank.status,
        },
      });

      // 7. Update Leave Entitlements
      await tx.userLeaveEntitlement.deleteMany({ where: { userId: id } });
      if (data.leave && data.leave.length > 0) {
        await tx.userLeaveEntitlement.createMany({
          data: data.leave.map((l: any) => ({
            userId: id,
            academicYear: l.academicYear,
            leaveType: l.leaveType,
            totalLeave: l.totalLeave,
          })),
        });
      }

      // 8. Update Experience
      await tx.userExperience.deleteMany({ where: { userId: id } });
      if (data.experience && data.experience.length > 0) {
        await tx.userExperience.createMany({
          data: data.experience.map((e: any) => ({
            userId: id,
            sector: e.sector,
            subSector: e.subSector,
            institutionName: e.institutionName,
            yearsOfExp: e.yearsOfExp,
          })),
        });
      }

      // 9. Update Education
      await tx.userEducation.deleteMany({ where: { userId: id } });
      await tx.userEducation.create({
        data: {
          userId: id,
          qualification: data.education.qualification,
          passingDate: data.education.passingDate ? new Date(data.education.passingDate) : null,
        },
      });

      // 10. Update Professional Metrics
      await tx.userProfessionalMetrics.upsert({
        where: { userId: id },
        create: {
          userId: id,
          technicalSkills: data.professionalMetrics?.technicalSkills,
          domainExpertise: data.professionalMetrics?.domainExpertise,
          certifications: data.professionalMetrics?.certifications,
        },
        update: {
          technicalSkills: data.professionalMetrics?.technicalSkills,
          domainExpertise: data.professionalMetrics?.domainExpertise,
          certifications: data.professionalMetrics?.certifications,
        },
      });

      return user;
    });
  }

  async deactivateUser(id: string) {
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.user.update({
        where: { id },
        data: { isActive: false },
      });
      await tx.userPersonalDetails.updateMany({
        where: { userId: id },
        data: { status: "inactive" },
      });
      return { message: "User deactivated successfully" };
    });
  }

  async addDocuments(userId: string, files: any) {
    const documentData: any[] = [];

    if (files.photo) {
      documentData.push({
        userId,
        documentType: "photo",
        fileName: files.photo[0].filename,
        fileUrl: files.photo[0].path,
        mimeType: files.photo[0].mimetype,
        fileSize: files.photo[0].size,
      });
    }

    if (files.signature) {
      documentData.push({
        userId,
        documentType: "signature",
        fileName: files.signature[0].filename,
        fileUrl: files.signature[0].path,
        mimeType: files.signature[0].mimetype,
        fileSize: files.signature[0].size,
      });
    }

    if (files.esign) {
      documentData.push({
        userId,
        documentType: "esign",
        fileName: files.esign[0].filename,
        fileUrl: files.esign[0].path,
        mimeType: files.esign[0].mimetype,
        fileSize: files.esign[0].size,
      });
    }

    if (files.supporting) {
      files.supporting.forEach((file: any) => {
        documentData.push({
          userId,
          documentType: "supporting",
          fileName: file.filename,
          fileUrl: file.path,
          mimeType: file.mimetype,
          fileSize: file.size,
        });
      });
    }

    if (documentData.length > 0) {
      await prisma.userDocument.createMany({
        data: documentData,
      });
    }

    return { message: "Documents uploaded successfully", count: documentData.length };
  }

  async getStaffUsers() {
    return await prisma.user.findMany({
      where: { 
        role: 'STAFF',
        isActive: true,
        deletedAt: null
      },
      select: {
        id: true,
        email: true,
        name: true
      }
    });
  }
}

export const usersService = new UsersService();
