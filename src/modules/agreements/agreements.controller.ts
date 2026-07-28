import { Request, Response, NextFunction } from 'express';
import { AgreementsService } from './agreements.service';

export class AgreementsController {
  static async generate(req: Request, res: Response, next: NextFunction) {
    try {
      const { applicationId, templateId, metadata, status, overrides } = req.body;
      const agreement = await AgreementsService.generateAgreement(applicationId, templateId, metadata || {}, status, overrides);
      res.status(201).json({
        success: true,
        data: agreement
      });
    } catch (error) {
      next(error);
    }
  }

  static async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const agreements = await AgreementsService.getAllAgreements();
      res.json({ success: true, data: agreements });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const agreement = await AgreementsService.getAgreementById(req.params.id as string);
      res.json({
        success: true,
        data: agreement
      });
    } catch (error) {
      next(error);
    }
  }

  static async getByApplication(req: Request, res: Response, next: NextFunction) {
    try {
      const agreements = await AgreementsService.getAgreementsByApplication(req.params.applicationId as string);
      res.json({
        success: true,
        data: agreements
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { status } = req.body;
      const agreement = await AgreementsService.updateStatus(req.params.id as string, status);
      res.json({
        success: true,
        data: agreement
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateVariables(req: Request, res: Response, next: NextFunction) {
    try {
      const { variables } = req.body;
      const agreement = await AgreementsService.updateVariables(req.params.id as string, variables);
      res.json({
        success: true,
        data: agreement
      });
    } catch (error) {
      next(error);
    }
  }

  static async respond(req: Request, res: Response, next: NextFunction) {
    try {
      const { applicationId, action, feedback, clauseNotes } = req.body;
      const agreement = await AgreementsService.respondToAgreement(applicationId, action, feedback, clauseNotes);
      res.json({
        success: true,
        data: agreement
      });
    } catch (error) {
      next(error);
    }
  }

  static async approveReview(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const agreement = await AgreementsService.approveAgreementReview(id as string);
      res.json({
        success: true,
        data: agreement
      });
    } catch (error) {
      next(error);
    }
  }
}
