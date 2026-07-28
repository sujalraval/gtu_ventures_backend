import { Request, Response } from 'express';
import { AgreementTemplatesService } from './agreement-templates.service';
import { AgreementStatus } from '@prisma/client';
import asyncHandler from '../../common/utils/asyncHandler';

export class AgreementTemplatesController {
  /**
   * Retrieves all agreement templates.
   */
  static getAll = asyncHandler(async (req: Request, res: Response) => {
    const templates = await AgreementTemplatesService.getAllTemplates();
    res.json({
      success: true,
      data: templates
    });
  });

  /**
   * Retrieves a single template by ID with full nested structure.
   */
  static getById = asyncHandler(async (req: Request, res: Response) => {
    const template = await AgreementTemplatesService.getTemplateById(req.params.id as string);
    res.json({
      success: true,
      data: template
    });
  });

  /**
   * Creates a new agreement template.
   */
  static create = asyncHandler(async (req: Request, res: Response) => {
    const template = await AgreementTemplatesService.createTemplate(req.body);
    
    // Auto-sync agreement if active and startup linked
    if (template.status === 'ACTIVE') {
      await AgreementTemplatesController.syncAgreement(template);
    }

    res.status(201).json({
      success: true,
      data: template
    });
  });

  /**
   * Updates an existing agreement template.
   */
  static update = asyncHandler(async (req: Request, res: Response) => {
    const template = await AgreementTemplatesService.updateTemplate(req.params.id as string, req.body);
    
    // Auto-sync agreement if active and startup linked
    if (template.status === 'ACTIVE') {
      await this.syncAgreement(template);
    }

    res.json({
      success: true,
      data: template
    });
  });

  /**
   * Deletes an agreement template.
   */
  static delete = asyncHandler(async (req: Request, res: Response) => {
    await AgreementTemplatesService.deleteTemplate(req.params.id as string);
    res.json({
      success: true,
      message: 'Agreement template deleted successfully'
    });
  });

  /**
   * Activates a template for a scheme (and archives others).
   */
  static activate = asyncHandler(async (req: Request, res: Response) => {
    const template = await AgreementTemplatesService.setActiveTemplate(req.params.id as string);
    
    // Force sync on activation - using explicit class name to avoid 'this' binding issues
    await AgreementTemplatesController.syncAgreement(template);

    res.json({
      success: true,
      data: template,
      message: 'Template activated successfully'
    });
  });

  /**
   * Internal helper to sync GeneratedAgreement record with Template state.
   */
  private static async syncAgreement(template: any) {
    const applicationId = AgreementTemplatesService.extractApplicationId(template);
    
    if (!applicationId) {
      console.warn(`[AgreementSync] No applicationId found in metadata for Template: ${template.id}. Skipping sync.`);
      return;
    }

    console.log(`[AgreementSync] Triggering auto-generation for App: ${applicationId} using Template: ${template.id}`);
    
    try {
      // Dynamic import to break circular dependency
      const { AgreementsService } = await import('../agreements/agreements.service');
      
      const agreement = await AgreementsService.generateAgreement(
        applicationId, 
        template.id, 
        {}, 
        AgreementStatus.ACTIVE
      );
      
      console.log(`[AgreementSync] Successfully synchronized agreement for App: ${applicationId}. Agreement ID: ${agreement.id}`);
    } catch (error: any) {
      console.error(`[AgreementSync] Critical failure for App: ${applicationId}:`, error);
      
      // Emergency logging to disk if console is hidden or rolling
      try {
        const fs = await import('fs');
        const path = await import('path');
        const logDir = path.join(process.cwd(), 'scratch');
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
        
        const logMsg = `\n[${new Date().toISOString()}] SYNC FAILED\n` +
                       `App ID: ${applicationId}\n` +
                       `Template ID: ${template.id}\n` +
                       `Error: ${error.message}\n` +
                       `${error.stack}\n` +
                       `-------------------------------------------\n`;
        
        fs.appendFileSync(path.join(logDir, 'sync_errors.log'), logMsg);
      } catch (e) {
        console.error('[AgreementSync] Failed to write to emergency log file:', e);
      }
    }
  }

  /**
   * Retrieves templates for a specific scheme.
   */
  static getByScheme = asyncHandler(async (req: Request, res: Response) => {
    const templates = await AgreementTemplatesService.getTemplatesByScheme(req.params.schemeId as string);
    res.json({
      success: true,
      data: templates
    });
  });

  /**
   * Hydrates a template with provided variables (test endpoint).
   */
  static hydrate = asyncHandler(async (req: Request, res: Response) => {
    const { variables } = req.body;
    const hydrated = await AgreementTemplatesService.hydrateTemplate(req.params.id as string, variables);
    res.json({
      success: true,
      data: hydrated
    });
  });
}
