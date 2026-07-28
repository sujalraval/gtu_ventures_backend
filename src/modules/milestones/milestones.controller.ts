import { Request, Response } from "express";
import { MilestoneService } from "./milestones.service";

const milestoneService = new MilestoneService();

export const createMilestone = async (req: Request, res: Response) => {
  try {
    const milestone = await milestoneService.createMilestone(req.body);
    res.status(201).json(milestone);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getStartupMilestones = async (req: Request, res: Response) => {
  try {
    const { startupId } = req.params;
    const milestones = await milestoneService.getMilestonesByStartup(startupId as string);
    res.json(milestones);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getAllMilestones = async (req: Request, res: Response) => {
  try {
    const milestones = await milestoneService.getAllMilestones();
    res.json(milestones);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateMilestoneProgress = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const milestone = await milestoneService.updateProgress(id as string, req.body);
    res.json(milestone);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const approveMilestone = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const milestone = await milestoneService.approveMilestone(id as string, req.body);
    res.json(milestone);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getCategories = async (_req: Request, res: Response) => {
  try {
    const categories = await milestoneService.getCategories();
    res.json(categories);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const createCategory = async (req: Request, res: Response) => {
  try {
    const category = await milestoneService.createCategory(req.body);
    res.status(201).json(category);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const updateCategory = async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const category = await milestoneService.updateCategory(name as string, req.body);
    res.json(category);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    await milestoneService.deleteCategory(name as string);
    res.json({ message: "Category deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getAlerts = async (req: Request, res: Response) => {
  try {
    const alerts = await milestoneService.getAlerts();
    res.json(alerts);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// ── Milestone Templates ───────────────────────────────────────────────────────

export const createTemplate = async (req: Request, res: Response) => {
  try {
    const { grantId } = req.params;
    const template = await milestoneService.createTemplate(grantId as string, req.body);
    res.status(201).json({ success: true, data: template });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getTemplatesByGrant = async (req: Request, res: Response) => {
  try {
    const { grantId } = req.params;
    const templates = await milestoneService.getTemplatesByGrant(grantId as string);
    res.json({ success: true, data: templates });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateTemplate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const template = await milestoneService.updateTemplate(id as string, req.body);
    res.json({ success: true, data: template });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteTemplate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await milestoneService.deleteTemplate(id as string);
    res.json({ success: true, message: 'Template deactivated successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Milestone Detail ──────────────────────────────────────────────────────────

export const getMilestoneDetail = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const detail = await milestoneService.getMilestoneDetail(id as string);
    if (!detail) return res.status(404).json({ success: false, message: 'Milestone not found' });
    res.json({ success: true, data: detail });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
