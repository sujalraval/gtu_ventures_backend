import prisma from '../../lib/prisma';
import { NotFoundError, BadRequestError } from '../../common/utils/apiError';

export class FinanceService {
  // --- 1. Chart of Accounts ---
  static async getChartOfAccounts() {
    try {
      return await prisma.financialAccount.findMany({
        orderBy: { code: 'asc' },
      });
    } catch (error) {
      console.error('Error in getChartOfAccounts:', error);
      throw error;
    }
  }

  // --- 2. General Ledger Logs ---
  static async getLedger(filters?: { accountId?: string; search?: string }) {
    try {
      const whereClause: any = {};

      if (filters?.accountId) {
        whereClause.OR = [
          { debitAccountId: filters.accountId },
          { creditAccountId: filters.accountId },
        ];
      }

      if (filters?.search) {
        whereClause.OR = [
          ...(whereClause.OR || []),
          { voucherNo: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
          { reference: { contains: filters.search, mode: 'insensitive' } },
        ];
      }

      const vouchers = await prisma.financialVoucher.findMany({
        where: whereClause,
        include: {
          debitAccount: true,
          creditAccount: true,
        },
        orderBy: { date: 'desc' },
      });

      // Map back to GTU Ventures's frontend expected Voucher flat-structure
      return vouchers.map((v) => ({
        id: v.id,
        voucherNo: v.voucherNo,
        type: v.type,
        date: v.date.toISOString().split('T')[0],
        description: v.description,
        debitAccount: v.debitAccount.name,
        creditAccount: v.creditAccount.name,
        amount: v.amount,
        reference: v.reference || '',
        authorizedBy: v.authorizedBy || 'System Admin',
      }));
    } catch (error) {
      console.error('Error in getLedger:', error);
      throw error;
    }
  }

  // --- 3. Dashboard Statistics & Cache Engine ---
  static async getDashboard() {
    try {
      // Find the primary bank account ID
      const sbiAccount = await prisma.financialAccount.findUnique({
        where: { name: 'State Bank of India (Bank A/c)' },
      });

      let sbiBalance = 18450000; // Default opening balance
      if (sbiAccount) {
        // Calculate bank balance dynamically from double-entry logs
        const inflows = await prisma.financialVoucher.aggregate({
          where: { debitAccountId: sbiAccount.id },
          _sum: { amount: true },
        });
        const outflows = await prisma.financialVoucher.aggregate({
          where: { creditAccountId: sbiAccount.id },
          _sum: { amount: true },
        });

        sbiBalance = 18450000 + (inflows._sum.amount || 0) - (outflows._sum.amount || 0);
      }

      // Calculate total outbound seed grants (vouchers debiting 'Startup Seed Grants Outflow')
      const grantsAccount = await prisma.financialAccount.findUnique({
        where: { name: 'Startup Seed Grants Outflow' },
      });
      let totalOutboundGrants = 300000; // Base historical seed
      if (grantsAccount) {
        const grantGrades = await prisma.financialVoucher.aggregate({
          where: { debitAccountId: grantsAccount.id },
          _sum: { amount: true },
        });
        totalOutboundGrants = 300000 + (grantGrades._sum.amount || 0);
      }

      // Calculate current monthly operating cost (incubator expenses)
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      const operatingCostAgg = await prisma.incubatorExpense.aggregate({
        where: {
          date: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { amount: true },
      });

      const mentorSessionsAgg = await prisma.mentorSession.aggregate({
        where: {
          sessionDate: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { honorariumPaid: true },
      });

      const assetsAgg = await prisma.inventoryAsset.aggregate({
        where: {
          purchaseDate: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { assetValue: true },
      });

      const monthlyOperatingCost = 97000 + 
        (operatingCostAgg._sum.amount || 0) + 
        (mentorSessionsAgg._sum.honorariumPaid || 0) + 
        (assetsAgg._sum.assetValue || 0);

      return {
        sbiBalance,
        totalOutboundGrants,
        monthlyOperatingCost,
        budgetLimit: 500000,
        schemes: [
          { name: 'SISFS (Startup India)', capacity: 10000000, utilized: 4500000 },
          { name: 'NIDHI-SSS (Central DST)', capacity: 25000000, utilized: 12000000 },
          { name: 'BIRAC LEAP (Biotech)', capacity: 15000000, utilized: 5000000 },
        ],
        cashFlow: [
          { month: 'Jan', inflows: 1200000, outflows: 450000 },
          { month: 'Feb', inflows: 1500000, outflows: 600000 },
          { month: 'Mar', inflows: 2100000, outflows: 1100000 },
          { month: 'Apr', inflows: 1800000, outflows: 850000 },
          { month: 'May', inflows: sbiBalance > 18450000 ? sbiBalance - 18450000 + 800000 : 800000, outflows: monthlyOperatingCost },
        ],
      };
    } catch (error) {
      console.error('Error in getDashboard:', error);
      throw error;
    }
  }

  // --- 4. Voucher Logging Center ---
  static async createVoucher(data: {
    type: 'JV' | 'PV' | 'RV';
    description: string;
    debitAccountId: string;
    creditAccountId: string;
    amount: number;
    reference?: string;
    authorizedBy?: string;
    grantTrancheId?: string;
  }) {
    if (data.amount <= 0) {
      throw new BadRequestError('Voucher transaction amount must be greater than zero.');
    }
    if (data.debitAccountId === data.creditAccountId) {
      throw new BadRequestError('Debit and Credit accounts cannot be the same (double-entry breach).');
    }

    try {
      return await prisma.$transaction(async (tx) => {
        // Generate sequential Voucher Number (e.g. PV-2026-004)
        const count = await tx.financialVoucher.count({
          where: { type: data.type },
        });
        const currentYear = new Date().getFullYear();
        const voucherNo = `${data.type}-${currentYear}-${(count + 1).toString().padStart(3, '0')}`;

        const voucher = await tx.financialVoucher.create({
          data: {
            voucherNo,
            type: data.type,
            description: data.description,
            debitAccountId: data.debitAccountId,
            creditAccountId: data.creditAccountId,
            amount: data.amount,
            reference: data.reference,
            authorizedBy: data.authorizedBy || 'System Admin',
            grantTrancheId: data.grantTrancheId,
          },
          include: {
            debitAccount: true,
            creditAccount: true,
          },
        });

        return {
          id: voucher.id,
          voucherNo: voucher.voucherNo,
          type: voucher.type,
          date: voucher.date.toISOString().split('T')[0],
          description: voucher.description,
          debitAccount: voucher.debitAccount.name,
          creditAccount: voucher.creditAccount.name,
          amount: voucher.amount,
          reference: voucher.reference || '',
          authorizedBy: voucher.authorizedBy || 'System Admin',
        };
      });
    } catch (error) {
      console.error('Error in createVoucher:', error);
      throw error;
    }
  }

  // --- 5. Central Operational Expenses ---
  static async getExpenses() {
    try {
      const expenses = await prisma.incubatorExpense.findMany({
        include: {
          voucher: true,
        },
        orderBy: { date: 'desc' },
      });

      return expenses.map((e) => ({
        id: e.id,
        category: e.category,
        vendor: e.vendor,
        amount: e.amount,
        date: e.date.toISOString().split('T')[0],
        paymentMethod: e.paymentMethod,
        description: e.description || '',
        voucherId: e.voucher?.voucherNo || '',
      }));
    } catch (error) {
      console.error('Error in getExpenses:', error);
      throw error;
    }
  }

  static async createExpense(data: {
    category: string;
    vendor: string;
    amount: number;
    paymentMethod: string;
    description?: string;
  }) {
    if (data.amount <= 0) {
      throw new BadRequestError('Expense cost amount must be greater than zero.');
    }

    try {
      return await prisma.$transaction(async (tx) => {
        // 1. Fetch appropriate debit and credit accounts
        let debitAccountName = 'Facility Maintenance Cost';
        if (data.category === 'Utilities' || data.category === 'Facility Maintenance') {
          debitAccountName = 'Electricity & Utilities Cost';
        } else if (data.category === 'Mentor Fees') {
          debitAccountName = 'Mentorship Expense';
        } else if (data.category === 'Legal & Compliance') {
          debitAccountName = 'Audit & Legal Fees';
        }

        const debitAcc = await tx.financialAccount.findUnique({
          where: { name: debitAccountName },
        });
        const creditAcc = await tx.financialAccount.findUnique({
          where: { name: 'State Bank of India (Bank A/c)' },
        });

        if (!debitAcc || !creditAcc) {
          throw new NotFoundError(
            `Core accounts [${debitAccountName} / SBI Bank] missing. Please run database seeding first.`
          );
        }

        // 2. Generate Payment Voucher (PV) sequentially
        const pvCount = await tx.financialVoucher.count({
          where: { type: 'PV' },
        });
        const currentYear = new Date().getFullYear();
        const voucherNo = `PV-${currentYear}-${(pvCount + 1).toString().padStart(3, '0')}`;

        const voucher = await tx.financialVoucher.create({
          data: {
            voucherNo,
            type: 'PV',
            description: `Payment to ${data.vendor} for operating expense: ${data.category}`,
            debitAccountId: debitAcc.id,
            creditAccountId: creditAcc.id,
            amount: data.amount,
            reference: `${data.paymentMethod}-EXPENSE`,
            authorizedBy: 'Operations Manager',
          },
        });

        // 3. Generate sequential Expense Number (e.g. EXP-101)
        const expCount = await tx.incubatorExpense.count();
        const expenseNo = `EXP-${(expCount + 101).toString()}`;

        // 4. Post Incubator Expense record linked to the voucher
        const expense = await tx.incubatorExpense.create({
          data: {
            expenseNo,
            category: data.category,
            vendor: data.vendor,
            amount: data.amount,
            paymentMethod: data.paymentMethod,
            description: data.description,
            voucherId: voucher.id,
          },
        });

        return {
          id: expense.id,
          category: expense.category,
          vendor: expense.vendor,
          amount: expense.amount,
          date: expense.date.toISOString().split('T')[0],
          paymentMethod: expense.paymentMethod,
          description: expense.description || '',
          voucherId: voucher.voucherNo,
        };
      });
    } catch (error) {
      console.error('Error in createExpense:', error);
      throw error;
    }
  }

  // --- 6. Government Grants & Startup Milestone Tranches ---
  static async getStartupGrantMilestones() {
    try {
      // Query GTU Ventures's existing tranches database joined to startups, grants, and milestones
      const tranches = await prisma.startupGrantTranche.findMany({
        include: {
          allocation: {
            include: {
              application: true,
              grant: {
                include: {
                  scheme: true,
                },
              },
            },
          },
          milestones: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      // Filter and map GTU Ventures's core grant items into flat UI rows
      return tranches.map((t) => {
        const startupName = t.allocation?.application?.startupName || 'Unknown Incubator Startup';
        const schemeName =
          t.allocation?.grant?.scheme?.name || t.allocation?.grant?.name || 'Startup Central Grant';
        const milestoneTitle = t.milestones[0]?.title || 'Grant Progress Milestone Tranche';

        let status = 'Pending Milestone Approval';
        if (t.status === 'Released') {
          status = 'Released';
        } else if (t.status === 'Approved') {
          status = 'CEO Sign-off Required';
        }

        return {
          id: t.id,
          startupName,
          scheme: schemeName,
          tranche: `Tranche ${t.installmentNo}`,
          amount: t.amount,
          milestone: milestoneTitle,
          status,
          date: t.paymentDate ? t.paymentDate.toISOString().split('T')[0] : t.createdAt.toISOString().split('T')[0],
          utr: t.utr || undefined,
        };
      });
    } catch (error) {
      console.error('Error in getStartupGrantMilestones:', error);
      throw error;
    }
  }

  static async payoutGrantTranche(trancheId: string, utr?: string) {
    if (!utr) {
      throw new BadRequestError('UTR payment reference is required to release grant funds.');
    }

    try {
      return await prisma.$transaction(async (tx) => {
        // 1. Fetch startup tranche and verify it exists
        const tranche = await tx.startupGrantTranche.findUnique({
          where: { id: trancheId },
          include: {
            allocation: {
              include: {
                application: true,
              },
            },
          },
        });

        if (!tranche) throw new NotFoundError('Startup milestone grant tranche not found.');
        if (tranche.status === 'Released') {
          throw new BadRequestError('This grant tranche has already been paid and settled.');
        }

        // 2. Fetch double-entry ledger accounts
        const debitAcc = await tx.financialAccount.findUnique({
          where: { name: 'Startup Seed Grants Outflow' },
        });
        const creditAcc = await tx.financialAccount.findUnique({
          where: { name: 'State Bank of India (Bank A/c)' },
        });

        if (!debitAcc || !creditAcc) {
          throw new NotFoundError(
            'Core grant outflow/SBI bank accounts missing. Please run database seeding first.'
          );
        }

        // 3. Post central general ledger Payment Voucher (PV)
        const pvCount = await tx.financialVoucher.count({
          where: { type: 'PV' },
        });
        const currentYear = new Date().getFullYear();
        const voucherNo = `PV-${currentYear}-${(pvCount + 1).toString().padStart(3, '0')}`;

        const startupName = tranche.allocation?.application?.startupName || 'Startup';
        const voucher = await tx.financialVoucher.create({
          data: {
            voucherNo,
            type: 'PV',
            description: `Seed Grant release to ${startupName} (Installment #${tranche.installmentNo})`,
            debitAccountId: debitAcc.id,
            creditAccountId: creditAcc.id,
            amount: tranche.amount,
            reference: utr,
            authorizedBy: 'CEO / Audit Board',
            grantTrancheId: tranche.id,
          },
        });

        // 4. Update the existing StartupGrantTranche status in GTU Ventures database
        await tx.startupGrantTranche.update({
          where: { id: trancheId },
          data: {
            status: 'Released',
            paymentDate: new Date(),
            utr: utr,
          },
        });

        // 5. Increment total released amount on the central allocation record
        await tx.startupGrantAllocation.update({
          where: { id: tranche.allocationId },
          data: {
            totalReleased: { increment: tranche.amount },
          },
        });

        return {
          id: tranche.id,
          startupName,
          tranche: `Tranche ${tranche.installmentNo}`,
          amount: tranche.amount,
          status: 'Released',
          date: new Date().toISOString().split('T')[0],
          utr: utr,
          voucherNo: voucher.voucherNo,
        };
      });
    } catch (error) {
      console.error('Error in payoutGrantTranche:', error);
      throw error;
    }
  }

  // --- 7. Mentor Session Honorariums ---
  static async getMentorSessions() {
    try {
      const sessions = await prisma.mentorSession.findMany({
        include: {
          financialVoucher: true,
        },
        orderBy: { sessionDate: 'desc' },
      });

      return sessions.map((s) => ({
        id: s.id,
        mentorName: s.mentorName,
        sessionTopic: s.sessionTopic,
        sessionDate: s.sessionDate.toISOString().split('T')[0],
        hoursLogged: s.hoursLogged,
        hourlyRate: s.hourlyRate,
        honorariumPaid: s.honorariumPaid,
        voucherNo: s.financialVoucher?.voucherNo || '',
      }));
    } catch (error) {
      console.error('Error in getMentorSessions:', error);
      throw error;
    }
  }

  static async createMentorSession(data: {
    mentorName: string;
    sessionTopic: string;
    sessionDate?: string;
    hoursLogged: number;
    hourlyRate: number;
  }) {
    const honorariumPaid = data.hoursLogged * data.hourlyRate;
    if (honorariumPaid <= 0) {
      throw new BadRequestError('Honorarium payout value must be greater than zero.');
    }

    try {
      return await prisma.$transaction(async (tx) => {
        // Fetch accounts
        const debitAcc = await tx.financialAccount.findUnique({
          where: { name: 'Mentorship Expense' },
        });
        const creditAcc = await tx.financialAccount.findUnique({
          where: { name: 'State Bank of India (Bank A/c)' },
        });

        if (!debitAcc || !creditAcc) {
          throw new NotFoundError(
            'Mentorship Expense or SBI bank accounts are missing. Please seed accounts first.'
          );
        }

        // Generate Payment Voucher (PV)
        const pvCount = await tx.financialVoucher.count({
          where: { type: 'PV' },
        });
        const currentYear = new Date().getFullYear();
        const voucherNo = `PV-${currentYear}-${(pvCount + 1).toString().padStart(3, '0')}`;

        const voucher = await tx.financialVoucher.create({
          data: {
            voucherNo,
            type: 'PV',
            description: `Mentor fee to ${data.mentorName} for topic: "${data.sessionTopic}" (${data.hoursLogged} hrs @ Rs. ${data.hourlyRate}/hr)`,
            debitAccountId: debitAcc.id,
            creditAccountId: creditAcc.id,
            amount: honorariumPaid,
            reference: 'UPI-MENTORSHIP',
            authorizedBy: 'Incubation Director',
          },
        });

        // Create Mentor Session entry
        const session = await tx.mentorSession.create({
          data: {
            mentorName: data.mentorName,
            sessionTopic: data.sessionTopic,
            sessionDate: data.sessionDate ? new Date(data.sessionDate) : new Date(),
            hoursLogged: data.hoursLogged,
            hourlyRate: data.hourlyRate,
            honorariumPaid,
            voucherId: voucher.id,
          },
        });

        return {
          id: session.id,
          mentorName: session.mentorName,
          sessionTopic: session.sessionTopic,
          sessionDate: session.sessionDate.toISOString().split('T')[0],
          hoursLogged: session.hoursLogged,
          hourlyRate: session.hourlyRate,
          honorariumPaid: session.honorariumPaid,
          voucherNo: voucher.voucherNo,
        };
      });
    } catch (error) {
      console.error('Error in createMentorSession:', error);
      throw error;
    }
  }

  // --- 8. Inventory & Capital Equipment Assets ---
  static async getInventoryAssets() {
    try {
      const assets = await prisma.inventoryAsset.findMany({
        include: {
          financialVoucher: true,
        },
        orderBy: { purchaseDate: 'desc' },
      });

      return assets.map((a) => ({
        id: a.id,
        assetName: a.assetName,
        category: a.category,
        serialNumber: a.serialNumber || '',
        vendorName: a.vendorName,
        purchaseDate: a.purchaseDate.toISOString().split('T')[0],
        assetValue: a.assetValue,
        voucherNo: a.financialVoucher?.voucherNo || '',
      }));
    } catch (error) {
      console.error('Error in getInventoryAssets:', error);
      throw error;
    }
  }

  static async createInventoryAsset(data: {
    assetName: string;
    category: string;
    serialNumber?: string;
    vendorName: string;
    purchaseDate?: string;
    assetValue: number;
  }) {
    if (data.assetValue <= 0) {
      throw new BadRequestError('Asset purchase value must be greater than zero.');
    }

    try {
      return await prisma.$transaction(async (tx) => {
        // Fetch accounts
        const debitAcc = await tx.financialAccount.findUnique({
          where: { name: 'Facility Maintenance Cost' },
        });
        const creditAcc = await tx.financialAccount.findUnique({
          where: { name: 'State Bank of India (Bank A/c)' },
        });

        if (!debitAcc || !creditAcc) {
          throw new NotFoundError(
            'Facility Maintenance Cost or SBI bank accounts are missing. Please seed accounts first.'
          );
        }

        // Generate Payment Voucher (PV)
        const pvCount = await tx.financialVoucher.count({
          where: { type: 'PV' },
        });
        const currentYear = new Date().getFullYear();
        const voucherNo = `PV-${currentYear}-${(pvCount + 1).toString().padStart(3, '0')}`;

        const voucher = await tx.financialVoucher.create({
          data: {
            voucherNo,
            type: 'PV',
            description: `Inventory Asset Purchase: ${data.assetName} (${data.category}) from vendor ${data.vendorName}`,
            debitAccountId: debitAcc.id,
            creditAccountId: creditAcc.id,
            amount: data.assetValue,
            reference: 'NEFT-INVENTORY-ASSET',
            authorizedBy: 'Asset Controller',
          },
        });

        // Create Inventory Asset entry
        const asset = await tx.inventoryAsset.create({
          data: {
            assetName: data.assetName,
            category: data.category,
            serialNumber: data.serialNumber || null,
            vendorName: data.vendorName,
            purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : new Date(),
            assetValue: data.assetValue,
            voucherId: voucher.id,
          },
        });

        return {
          id: asset.id,
          assetName: asset.assetName,
          category: asset.category,
          serialNumber: asset.serialNumber || '',
          vendorName: asset.vendorName,
          purchaseDate: asset.purchaseDate.toISOString().split('T')[0],
          assetValue: asset.assetValue,
          voucherNo: voucher.voucherNo,
        };
      });
    } catch (error) {
      console.error('Error in createInventoryAsset:', error);
      throw error;
    }
  }
}
