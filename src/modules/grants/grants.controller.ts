import { Request, Response, NextFunction } from 'express';
import { GrantsService } from './grants.service';

export class GrantsController {
  static async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const grants = await GrantsService.getAllGrants();
      res.status(200).json({ success: true, data: grants });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const grant = await GrantsService.getGrantById(req.params.id as string);
      res.status(200).json({ success: true, data: grant });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const grant = await GrantsService.createGrant(req.body);
      res.status(201).json({ success: true, data: grant });
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const grant = await GrantsService.updateGrant(req.params.id as string, req.body);
      res.status(200).json({ success: true, data: grant });
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await GrantsService.deleteGrant(req.params.id as string);
      res.status(200).json({ success: true, message: 'Grant deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  // --- Grant Receipt Handlers ---
  static async addReceipt(req: Request, res: Response, next: NextFunction) {
    try {
      const receipt = await GrantsService.addReceipt(req.params.id as string, req.body);
      res.status(201).json({ success: true, data: receipt });
    } catch (error) {
      next(error);
    }
  }

  static async getReceiptsByGrant(req: Request, res: Response, next: NextFunction) {
    try {
      const receipts = await GrantsService.getReceiptsByGrant(req.params.id as string);
      res.status(200).json({ success: true, data: receipts });
    } catch (error) {
      next(error);
    }
  }

  static async updateReceipt(req: Request, res: Response, next: NextFunction) {
    try {
      const receipt = await GrantsService.updateReceipt(req.params.receiptId as string, req.body);
      res.status(200).json({ success: true, data: receipt });
    } catch (error) {
      next(error);
    }
  }

  static async deleteReceipt(req: Request, res: Response, next: NextFunction) {
    try {
      await GrantsService.deleteReceipt(req.params.receiptId as string);
      res.status(200).json({ success: true, message: 'Receipt deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  // --- Grant Allocation Handlers ---
  static async addAllocation(req: Request, res: Response, next: NextFunction) {
    try {
      const allocation = await GrantsService.addAllocation(req.params.id as string, req.body);
      res.status(201).json({ success: true, data: allocation });
    } catch (error) {
      next(error);
    }
  }

  static async getAllocationsByGrant(req: Request, res: Response, next: NextFunction) {
    try {
      const allocations = await GrantsService.getAllocationsByGrant(req.params.id as string);
      res.status(200).json({ success: true, data: allocations });
    } catch (error) {
      next(error);
    }
  }

  static async updateAllocation(req: Request, res: Response, next: NextFunction) {
    try {
      const allocation = await GrantsService.updateAllocation(req.params.allocationId as string, req.body);
      res.status(200).json({ success: true, data: allocation });
    } catch (error) {
      next(error);
    }
  }

  static async deleteAllocation(req: Request, res: Response, next: NextFunction) {
    try {
      await GrantsService.deleteAllocation(req.params.allocationId as string);
      res.status(200).json({ success: true, message: 'Allocation deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}
