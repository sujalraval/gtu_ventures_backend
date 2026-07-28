import { Request, Response, NextFunction } from "express";
import { UCService } from "./uc.service";

const ucService = new UCService();

export class UCController {
  async getBudgetHeads(req: Request, res: Response, next: NextFunction) {
    try {
      const { grantId } = req.params;
      const data = await ucService.getBudgetHeadsByGrant(grantId as string);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async createBudgetHead(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ucService.createBudgetHead(req.body);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getEntries(req: Request, res: Response, next: NextFunction) {
    try {
      const { trancheId } = req.params;
      const data = await ucService.getEntriesByTranche(trancheId as string);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async createEntry(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ucService.createEntry(req.body);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async updateEntry(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = await ucService.updateEntry(id as string, req.body);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async deleteEntry(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await ucService.deleteEntry(id as string);
      res.json({ success: true, message: "Entry deleted" });
    } catch (error) {
      next(error);
    }
  }

  async getUC(req: Request, res: Response, next: NextFunction) {
    try {
      const { trancheId } = req.params;
      const data = await ucService.getUCByTranche(trancheId as string);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async submitUC(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ucService.submitUC(req.body);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async getAllUCs(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ucService.getAllUCs();
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async reviewUC(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const data = await ucService.reviewUC(id as string, req.body);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}
