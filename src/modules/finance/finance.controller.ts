import { Request, Response, NextFunction } from 'express';
import { FinanceService } from './finance.service';

export class FinanceController {
  // --- 1. Fetch Chart of Accounts ---
  static async getChartOfAccounts(req: Request, res: Response, next: NextFunction) {
    try {
      const accounts = await FinanceService.getChartOfAccounts();
      res.status(200).json({
        success: true,
        data: accounts,
      });
    } catch (error) {
      next(error);
    }
  }

  // --- 2. Fetch General Ledger ---
  static async getLedger(req: Request, res: Response, next: NextFunction) {
    try {
      const search = req.query.search as string;
      const accountId = req.query.accountId as string;

      const ledger = await FinanceService.getLedger({ search, accountId });
      res.status(200).json({
        success: true,
        data: ledger,
      });
    } catch (error) {
      next(error);
    }
  }

  // --- 3. Fetch Dashboard Metrics ---
  static async getDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const dashboardStats = await FinanceService.getDashboard();
      res.status(200).json({
        success: true,
        data: dashboardStats,
      });
    } catch (error) {
      next(error);
    }
  }

  // --- 4. Post New Journal/Payment/Receipt Voucher ---
  static async createVoucher(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        type,
        description,
        debitAccountId,
        creditAccountId,
        amount,
        reference,
        authorizedBy,
      } = req.body;

      const voucher = await FinanceService.createVoucher({
        type,
        description,
        debitAccountId,
        creditAccountId,
        amount: Number(amount),
        reference,
        authorizedBy,
      });

      res.status(201).json({
        success: true,
        message: 'Voucher posted successfully and registered in General Ledger.',
        data: voucher,
      });
    } catch (error) {
      next(error);
    }
  }

  // --- 5. Fetch Operating Expenses ---
  static async getExpenses(req: Request, res: Response, next: NextFunction) {
    try {
      const expenses = await FinanceService.getExpenses();
      res.status(200).json({
        success: true,
        data: expenses,
      });
    } catch (error) {
      next(error);
    }
  }

  // --- 6. Post New Operating Expense ---
  static async createExpense(req: Request, res: Response, next: NextFunction) {
    try {
      const { category, vendor, amount, paymentMethod, description } = req.body;

      const expense = await FinanceService.createExpense({
        category,
        vendor,
        amount: Number(amount),
        paymentMethod,
        description,
      });

      res.status(201).json({
        success: true,
        message: 'Operating cost logged and double-entry Payment Voucher posted.',
        data: expense,
      });
    } catch (error) {
      next(error);
    }
  }

  // --- 7. Fetch Startup Milestone Grants list ---
  static async getStartupGrantMilestones(req: Request, res: Response, next: NextFunction) {
    try {
      const milestones = await FinanceService.getStartupGrantMilestones();
      res.status(200).json({
        success: true,
        data: milestones,
      });
    } catch (error) {
      next(error);
    }
  }

  // --- 8. Release Startup Grant Tranche ---
  static async payoutGrantTranche(req: Request, res: Response, next: NextFunction) {
    try {
      const trancheId = req.params.trancheId as string;
      const utr = req.body.utr as string;

      const payout = await FinanceService.payoutGrantTranche(trancheId, utr);

      res.status(200).json({
        success: true,
        message: 'Startup grant milestone paid, UTR registered, and ledger updated.',
        data: payout,
      });
    } catch (error) {
      next(error);
    }
  }

  // --- 9. Fetch Mentor Session Honorariums ---
  static async getMentorSessions(req: Request, res: Response, next: NextFunction) {
    try {
      const sessions = await FinanceService.getMentorSessions();
      res.status(200).json({
        success: true,
        data: sessions,
      });
    } catch (error) {
      next(error);
    }
  }

  // --- 10. Log Mentor Session & Post Payment Voucher ---
  static async createMentorSession(req: Request, res: Response, next: NextFunction) {
    try {
      const { mentorName, sessionTopic, sessionDate, hoursLogged, hourlyRate } = req.body;

      const session = await FinanceService.createMentorSession({
        mentorName,
        sessionTopic,
        sessionDate,
        hoursLogged: Number(hoursLogged),
        hourlyRate: Number(hourlyRate),
      });

      res.status(201).json({
        success: true,
        message: 'Mentor session honorarium logged and double-entry Payment Voucher posted.',
        data: session,
      });
    } catch (error) {
      next(error);
    }
  }

  // --- 11. Fetch Inventory Capital Asset Purchases ---
  static async getInventoryAssets(req: Request, res: Response, next: NextFunction) {
    try {
      const assets = await FinanceService.getInventoryAssets();
      res.status(200).json({
        success: true,
        data: assets,
      });
    } catch (error) {
      next(error);
    }
  }

  // --- 12. Register Capital Equipment Asset & Post Payment Voucher ---
  static async createInventoryAsset(req: Request, res: Response, next: NextFunction) {
    try {
      const { assetName, category, serialNumber, vendorName, purchaseDate, assetValue } = req.body;

      const asset = await FinanceService.createInventoryAsset({
        assetName,
        category,
        serialNumber,
        vendorName,
        purchaseDate,
        assetValue: Number(assetValue),
      });

      res.status(201).json({
        success: true,
        message: 'Capital asset logged in inventory ledger and Payment Voucher posted.',
        data: asset,
      });
    } catch (error) {
      next(error);
    }
  }
}
