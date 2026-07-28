import { Request, Response } from "express";
import { VcService } from "./vc.service";

const svc = new VcService();

const ok = (res: Response, data: any) => res.json({ success: true, data });
const err = (res: Response, e: any, code = 500) => res.status(code).json({ success: false, error: e?.message || String(e) });

export const applyAsVc = async (req: Request, res: Response) => {
  try { ok(res, await svc.applyAsVc(null, req.body)); } catch (e) { err(res, e); }
};

export const getMyFirm = async (req: Request, res: Response) => {
  try { ok(res, await svc.getMyFirm((req as any).user.id)); } catch (e) { err(res, e); }
};

export const updateMyFirm = async (req: Request, res: Response) => {
  try { ok(res, await svc.updateMyFirm((req as any).user.id, req.body)); } catch (e) { err(res, e); }
};

export const getAllFirms = async (req: Request, res: Response) => {
  try { ok(res, await svc.getAllFirms()); } catch (e) { err(res, e); }
};

export const approveFirm = async (req: Request, res: Response) => {
  try { ok(res, await svc.approveFirm(String(req.params.id), (req as any).user.id, req.body.status)); } catch (e) { err(res, e); }
};

export const getShowcase = async (req: Request, res: Response) => {
  try { ok(res, await svc.getShowcase((req as any).user.id)); } catch (e) { err(res, e); }
};

export const getMyInterests = async (req: Request, res: Response) => {
  try { ok(res, await svc.getMyInterests((req as any).user.id)); } catch (e) { err(res, e); }
};

export const expressInterest = async (req: Request, res: Response) => {
  try { ok(res, await svc.expressInterest((req as any).user.id, req.body.startupId, req.body.notes)); } catch (e) { err(res, e); }
};

export const updateInterestStage = async (req: Request, res: Response) => {
  try { ok(res, await svc.updateInterestStage((req as any).user.id, String(req.params.id), req.body.pipelineStage)); } catch (e) { err(res, e); }
};

export const acceptNda = async (req: Request, res: Response) => {
  try { ok(res, await svc.acceptNda((req as any).user.id, String(req.params.id))); } catch (e) { err(res, e); }
};

export const getMyMeetings = async (req: Request, res: Response) => {
  try { ok(res, await svc.getMyMeetings((req as any).user.id)); } catch (e) { err(res, e); }
};

export const scheduleMeeting = async (req: Request, res: Response) => {
  try { ok(res, await svc.scheduleMeeting((req as any).user.id, req.body)); } catch (e) { err(res, e); }
};

export const updateMeeting = async (req: Request, res: Response) => {
  try { ok(res, await svc.updateMeeting((req as any).user.id, String(req.params.id), req.body)); } catch (e) { err(res, e); }
};

export const recordOutcome = async (req: Request, res: Response) => {
  try { ok(res, await svc.recordOutcome((req as any).user.id, String(req.params.id), req.body)); } catch (e) { err(res, e); }
};

export const getDashboardStats = async (req: Request, res: Response) => {
  try { ok(res, await svc.getDashboardStats((req as any).user.id)); } catch (e) { err(res, e); }
};

export const getStartupIncomingRequests = async (req: Request, res: Response) => {
  try { ok(res, await svc.getStartupIncomingRequests((req as any).user.id)); } catch (e) { err(res, e); }
};
