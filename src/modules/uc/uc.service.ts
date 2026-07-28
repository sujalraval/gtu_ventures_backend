import prisma from "../../lib/prisma";
import { NotFoundError, BadRequestError } from "../../common/utils/apiError";

export class UCService {
  // --- Budget Heads ---
  async getBudgetHeadsByGrant(grantId: string) {
    return prisma.uCBudgetHead.findMany({
      where: { grantId },
      orderBy: { name: "asc" },
    });
  }

  async createBudgetHead(data: any) {
    return prisma.uCBudgetHead.create({
      data: {
        grantId: data.grantId,
        name: data.name,
        allocatedAmount: parseFloat(data.allocatedAmount) || null,
        allocatedPercentage: parseFloat(data.allocatedPercentage) || null,
        isFlexible: data.isFlexible || false,
        description: data.description,
      },
    });
  }

  // --- Utilisation Entries ---
  async getEntriesByTranche(trancheId: string) {
    return prisma.utilisationEntry.findMany({
      where: { trancheId },
      include: {
        budgetHead: true,
        documents: true,
      },
      orderBy: { entryDate: "desc" },
    });
  }

  async createEntry(data: any) {
    return prisma.utilisationEntry.create({
      data: {
        allocationId: data.allocationId,
        trancheId: data.trancheId,
        budgetHeadId: data.budgetHeadId,
        entryDate: new Date(data.entryDate),
        expensePurpose: data.expensePurpose,
        vendorName: data.vendorName,
        vendorGstin: data.vendorGstin,
        invoiceNumber: data.invoiceNumber,
        invoiceDate: new Date(data.invoiceDate),
        grossAmount: parseFloat(data.grossAmount),
        gstAmount: parseFloat(data.gstAmount) || 0,
        tdsAmount: parseFloat(data.tdsAmount) || 0,
        netAmount: parseFloat(data.netAmount),
        paymentMode: data.paymentMode,
        paymentReference: data.paymentReference,
        paymentDate: new Date(data.paymentDate),
        status: data.status || "Submitted",
        cashFlag: data.cashFlag || false,
        documents: {
          create: (data.documents || []).map((doc: any) => ({
            documentType: doc.documentType,
            fileName: doc.fileName,
            fileUrl: doc.fileUrl,
            fileSizeKb: doc.fileSizeKb,
            mimeType: doc.mimeType,
          })),
        },
      },
    });
  }

  async updateEntry(id: string, data: any) {
    return prisma.utilisationEntry.update({
      where: { id },
      data: {
        budgetHeadId: data.budgetHeadId,
        entryDate: data.entryDate ? new Date(data.entryDate) : undefined,
        expensePurpose: data.expensePurpose,
        vendorName: data.vendorName,
        vendorGstin: data.vendorGstin,
        invoiceNumber: data.invoiceNumber,
        invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : undefined,
        grossAmount: data.grossAmount !== undefined ? parseFloat(data.grossAmount) : undefined,
        gstAmount: data.gstAmount !== undefined ? parseFloat(data.gstAmount) : undefined,
        tdsAmount: data.tdsAmount !== undefined ? parseFloat(data.tdsAmount) : undefined,
        netAmount: data.netAmount !== undefined ? parseFloat(data.netAmount) : undefined,
        paymentMode: data.paymentMode,
        paymentReference: data.paymentReference,
        paymentDate: data.paymentDate ? new Date(data.paymentDate) : undefined,
        status: data.status,
        cashFlag: data.cashFlag !== undefined ? data.cashFlag : undefined,
      },
    });
  }

  async deleteEntry(id: string) {
    return prisma.utilisationEntry.delete({
      where: { id },
    });
  }

  // --- Utilisation Certificates ---
  async getUCByTranche(trancheId: string) {
    return prisma.utilisationCertificate.findUnique({
      where: { trancheId },
      include: {
        allocation: true,
        tranche: true,
        entries: {
          include: { budgetHead: true },
        },
      },
    });
  }

  async generateUCNumber() {
    const currentYear = new Date().getFullYear();
    const prefix = `UC-${currentYear}`;
    const count = await prisma.utilisationCertificate.count({
      where: { ucNumber: { startsWith: prefix } },
    });
    return `${prefix}-${(count + 1).toString().padStart(4, "0")}`;
  }

  async submitUC(data: any) {
    const ucNumber = await this.generateUCNumber();
    
    return await prisma.$transaction(async (tx) => {
      // 1. Create UC
      const uc = await tx.utilisationCertificate.create({
        data: {
          ucNumber,
          allocationId: data.allocationId,
          trancheId: data.trancheId,
          certificatePeriodFrom: new Date(data.periodFrom),
          certificatePeriodTo: new Date(data.periodTo),
          trancheAmountReleased: parseFloat(data.amountReleased),
          totalAmountUtilised: parseFloat(data.totalUtilised),
          balanceCarriedForward: parseFloat(data.balance),
          authorisedSignatoryName: data.signatoryName,
          authorisedSignatoryDesignation: data.signatoryDesignation,
          declarationAccepted: true,
          status: "Submitted",
          submittedAt: new Date(),
          submittedBy: data.userId,
        },
      });

      // 2. Link entries to this UC and lock them
      await tx.utilisationEntry.updateMany({
        where: { trancheId: data.trancheId, ucId: null },
        data: { ucId: uc.id, isLocked: true },
      });

      return uc;
    });
  }

  async reviewUC(ucId: string, reviewData: any) {
    return await prisma.$transaction(async (tx) => {
      const uc = await tx.utilisationCertificate.findUnique({
        where: { id: ucId },
        include: { tranche: true }
      });

      if (!uc) throw new NotFoundError("UC not found");

      const status = reviewData.action === "APPROVE" ? "Verified" : "Rejected";
      
      const updatedUC = await tx.utilisationCertificate.update({
        where: { id: ucId },
        data: {
          status,
          reviewedAt: new Date(),
          reviewedBy: reviewData.userId,
          icRemarks: reviewData.remarks,
          trancheLocked: reviewData.action === "APPROVE" ? false : true, // Unlock next tranche if approved
        },
      });

      // If approved, update the tranche status to "Completed" or similar
      if (reviewData.action === "APPROVE") {
        await tx.startupGrantTranche.update({
          where: { id: uc.trancheId },
          data: { status: "Released" } // Ensure status reflects release after UC verification
        });
      }

      return updatedUC;
    });
  }

  async getAllUCs() {
    return prisma.utilisationCertificate.findMany({
      include: {
        allocation: {
          include: {
            application: {
              select: { startupName: true }
            }
          }
        },
        tranche: true
      },
      orderBy: { createdAt: "desc" }
    });
  }
}
