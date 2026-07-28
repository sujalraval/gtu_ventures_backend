import { Request, Response } from 'express';
import { LibraryClausesService } from './library-clauses.service';
import asyncHandler from '../../common/utils/asyncHandler';

export class LibraryClausesController {
  /**
   * Retrieves all library clauses.
   */
  static getAll = asyncHandler(async (req: Request, res: Response) => {
    const clauses = await LibraryClausesService.getAll();
    res.json({
      success: true,
      data: clauses
    });
  });

  /**
   * Retrieves a single library clause.
   */
  static getById = asyncHandler(async (req: Request, res: Response) => {
    const clause = await LibraryClausesService.getById(req.params.id as string);
    res.json({
      success: true,
      data: clause
    });
  });

  /**
   * Adds a new clause to the library.
   */
  static create = asyncHandler(async (req: Request, res: Response) => {
    const clause = await LibraryClausesService.create(req.body);
    res.status(201).json({
      success: true,
      data: clause
    });
  });

  /**
   * Updates an existing library clause.
   */
  static update = asyncHandler(async (req: Request, res: Response) => {
    const clause = await LibraryClausesService.update(req.params.id as string, req.body);
    res.json({
      success: true,
      data: clause
    });
  });

  /**
   * Gets the default clause for a specific category.
   */
  static getDefaultByCategory = asyncHandler(async (req: Request, res: Response) => {
    const clause = await LibraryClausesService.getDefaultByCategory(req.params.category as string);
    res.json({
      success: true,
      data: clause
    });
  });

  /**
   * Deletes a clause from the library.
   */
  static delete = asyncHandler(async (req: Request, res: Response) => {
    await LibraryClausesService.delete(req.params.id as string);
    res.json({
      success: true,
      message: 'Library clause deleted successfully'
    });
  });
}
