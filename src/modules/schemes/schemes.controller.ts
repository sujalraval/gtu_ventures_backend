import { Request, Response } from 'express';
import { SchemesService } from './schemes.service';
import asyncHandler from '../../common/utils/asyncHandler';

export class SchemesController {
  static getAll = asyncHandler(async (req: Request, res: Response) => {
    const schemes = await SchemesService.getAllSchemes();
    res.json({
      success: true,
      data: schemes
    });
  });

  static getDeleted = asyncHandler(async (req: Request, res: Response) => {
    const schemes = await SchemesService.getDeletedSchemes();
    res.json({
      success: true,
      data: schemes
    });
  });

  static getById = asyncHandler(async (req: Request, res: Response) => {
    const scheme = await SchemesService.getSchemeById(req.params.id as string);
    res.json({
      success: true,
      data: scheme
    });
  });

  static create = asyncHandler(async (req: Request, res: Response) => {
    const scheme = await SchemesService.createScheme(req.body);
    res.status(201).json({
      success: true,
      data: scheme
    });
  });

  static update = asyncHandler(async (req: Request, res: Response) => {
    const scheme = await SchemesService.updateScheme(req.params.id as string, req.body);
    res.json({
      success: true,
      data: scheme
    });
  });

  static delete = asyncHandler(async (req: Request, res: Response) => {
    await SchemesService.deleteScheme(req.params.id as string);
    res.status(200).json({ success: true, message: 'Scheme soft-deleted successfully' });
  });

  static restore = asyncHandler(async (req: Request, res: Response) => {
    await SchemesService.restoreScheme(req.params.id as string);
    res.json({ success: true, message: 'Scheme restored successfully' });
  });
}
