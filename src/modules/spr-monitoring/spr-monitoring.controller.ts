import { Request, Response } from "express";
import { SPRService } from "./spr-monitoring.service";

const sprService = new SPRService();

export const submitSPR = async (req: Request, res: Response) => {
  try {
    const spr = await sprService.submitSPR(req.body);
    res.status(201).json(spr);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getStartupSPRs = async (req: Request, res: Response) => {
  try {
    const { startupId } = req.params;
    const sprs = await sprService.getStartupSPRs(startupId as string);
    res.json(sprs);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getAllSPRs = async (_req: Request, res: Response) => {
  try {
    const sprs = await sprService.getAllSPRs();
    res.json(sprs);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const submitAssessment = async (req: Request, res: Response) => {
  try {
    const { sprId } = req.params;
    const assessment = await sprService.submitAssessment(sprId as string, req.body);
    res.json(assessment);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getMySPRs = async (req: Request, res: Response) => {
  try {
    const startupId = (req as any).user?.id;
    const sprs = await sprService.getStartupSPRs(startupId as string);
    res.json(sprs);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getMasterConfig = async (_req: Request, res: Response) => {
  try {
    const config = await sprService.getMasterConfig();
    res.json(config);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
