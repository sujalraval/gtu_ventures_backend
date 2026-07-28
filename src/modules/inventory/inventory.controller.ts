import { Request, Response, NextFunction } from 'express';
import { InventoryService } from './inventory.service';

export class InventoryController {
  // --- Asset Directory Controllers ---
  
  static getAllItems = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { category, status, search } = req.query;
      const items = await InventoryService.getAllItems({
        category: category as string,
        status: status as string,
        search: search as string,
      });
      res.json({ success: true, data: items });
    } catch (err) {
      next(err);
    }
  };

  static createItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const item = await InventoryService.createItem(req.body);
      res.status(201).json({ success: true, data: item });
    } catch (err) {
      next(err);
    }
  };

  static updateItemStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const item = await InventoryService.updateItemStatus(id as string, status as string);
      res.json({ success: true, data: item });
    } catch (err) {
      next(err);
    }
  };

  static getItemHistory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const history = await InventoryService.getItemHistory(id as string);
      res.json({ success: true, data: history });
    } catch (err) {
      next(err);
    }
  };

  // --- Allocation Controllers ---

  static createAllocation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const allocation = await InventoryService.createAllocation(req.body);
      res.status(201).json({ success: true, data: allocation });
    } catch (err) {
      next(err);
    }
  };

  static returnAllocation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params; // allocationId
      const { returnCondition, remarks } = req.body;
      const allocation = await InventoryService.returnAllocation({
        allocationId: id as string,
        returnCondition: returnCondition as string,
        remarks: remarks as string,
      });
      res.json({ success: true, data: allocation });
    } catch (err) {
      next(err);
    }
  };

  // --- Consumables Controllers ---

  static getAllConsumables = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const consumables = await InventoryService.getAllConsumables();
      res.json({ success: true, data: consumables });
    } catch (err) {
      next(err);
    }
  };

  static createConsumable = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const consumable = await InventoryService.createConsumable(req.body);
      res.status(201).json({ success: true, data: consumable });
    } catch (err) {
      next(err);
    }
  };

  static adjustConsumableStock = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { adjustment } = req.body;
      const consumable = await InventoryService.adjustConsumableStock(id as string, {
        adjustment: Number(adjustment),
      });
      res.json({ success: true, data: consumable });
    } catch (err) {
      next(err);
    }
  };

  // --- Maintenance & Repair Controllers ---

  static getAllMaintenanceTickets = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tickets = await InventoryService.getAllMaintenanceTickets();
      res.json({ success: true, data: tickets });
    } catch (err) {
      next(err);
    }
  };

  static createMaintenanceTicket = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ticket = await InventoryService.createMaintenanceTicket(req.body);
      res.status(201).json({ success: true, data: ticket });
    } catch (err) {
      next(err);
    }
  };

  static resolveMaintenanceTicket = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params; // ticketId
      const { status } = req.body;
      const ticket = await InventoryService.resolveMaintenanceTicket(id as string, status as string);
      res.json({ success: true, data: ticket });
    } catch (err) {
      next(err);
    }
  };

  // --- Helpers & Timeline Timeline controllers ---

  static getCheckoutTargets = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const targets = await InventoryService.getCheckoutTargets();
      res.json({ success: true, data: targets });
    } catch (err) {
      next(err);
    }
  };

  static getUnifiedHistoryFeed = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const feed = await InventoryService.getUnifiedHistoryFeed();
      res.json({ success: true, data: feed });
    } catch (err) {
      next(err);
    }
  };
}
