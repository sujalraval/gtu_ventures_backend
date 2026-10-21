import { Request, Response } from 'express';
import { CommitteesService } from './committees.service';
import asyncHandler from '../../common/utils/asyncHandler';

export class CommitteesController {
  static list = asyncHandler(async (req: Request, res: Response) => {
    const data = await CommitteesService.list(req.query as any);
    res.json({ success: true, data });
  });

  static getById = asyncHandler(async (req: Request, res: Response) => {
    const data = await CommitteesService.getById(String(req.params.id));
    res.json({ success: true, data });
  });

  static create = asyncHandler(async (req: Request, res: Response) => {
    const actorId = (req as any).user.id;
    const data = await CommitteesService.create(req.body, actorId);
    res.status(201).json({ success: true, data });
  });

  static update = asyncHandler(async (req: Request, res: Response) => {
    const data = await CommitteesService.update(String(req.params.id), req.body);
    res.json({ success: true, data });
  });

  static remove = asyncHandler(async (req: Request, res: Response) => {
    const data = await CommitteesService.remove(String(req.params.id));
    res.json({ success: true, data });
  });

  static addMembers = asyncHandler(async (req: Request, res: Response) => {
    const data = await CommitteesService.addMembers(String(req.params.id), req.body.members);
    res.json({ success: true, data });
  });

  static updateMember = asyncHandler(async (req: Request, res: Response) => {
    const data = await CommitteesService.updateMember(String(req.params.memberId), req.body);
    res.json({ success: true, data });
  });

  static removeMember = asyncHandler(async (req: Request, res: Response) => {
    const data = await CommitteesService.removeMember(String(req.params.memberId));
    res.json({ success: true, data });
  });
}

export default CommitteesController;
