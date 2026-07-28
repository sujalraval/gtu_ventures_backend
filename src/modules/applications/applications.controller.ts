import { Request, Response } from 'express';
import { ApplicationsService } from './applications.service';
import asyncHandler from '../../common/utils/asyncHandler';
import { SubmitFormBSchema, SubmitFormCSchema } from './applications.schema';
import { sseManager } from '../../lib/sseManager';

export class ApplicationsController {
  static getMyApplication = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const application = await ApplicationsService.getByUserId(userId);
    res.json({
      success: true,
      data: application
    });
  });

  static getMyStats = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const stats = await ApplicationsService.getMyStats(userId);
    res.json({
      success: true,
      data: stats
    });
  });

  static getById = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const application = await ApplicationsService.getById(id);
    res.json({
      success: true,
      data: application
    });
  });

  static submitFormA = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    try {
      const fs = require('fs');
      const logPath = 'd:\\files\\office\\1\\Incubationerp\\backend\\form_a_debug.log';
      fs.appendFileSync(logPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        userId,
        body: req.body
      }, null, 2) + '\n\n');
    } catch (logErr) {}
    
    const application = await ApplicationsService.submitFormA(userId, req.body);
    res.status(201).json({
      success: true,
      data: application
    });
  });

  static submitFormB = asyncHandler(async (req: Request, res: Response) => {
    try {
      const validatedData = SubmitFormBSchema.parse(req.body);
      const application = await ApplicationsService.submitFormB(validatedData);
      res.status(201).json({
        success: true,
        data: application
      });
    } catch (error: any) {
      try {
        const fs = require('fs');
        // Absolute path to guarantee placement
        const logPath = 'd:\\files\\office\\1\\Incubationerp\\backend\\absolute_debug.log';
        const logData = {
          timestamp: new Date().toISOString(),
          body: req.body,
          errorName: error.name,
          errorMessage: error.message,
          errorStack: error.stack,
          errors: error.errors || []
        };
        fs.appendFileSync(logPath, JSON.stringify(logData, null, 2) + '\n\n');
      } catch (logErr) {}
      throw error;
    }
  });

  static submitFormC = asyncHandler(async (req: Request, res: Response) => {
    const validatedData = SubmitFormCSchema.parse(req.body);
    const application = await ApplicationsService.submitFormC(validatedData);
    res.status(201).json({
      success: true,
      data: application
    });
  });


  static uploadDocument = asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const fileUrl = `/uploads/applications/${req.file.filename}`;
    res.json({
      success: true,
      data: {
        url: fileUrl,
        filename: req.file.originalname,
      }
    });
  });

  static getAll = asyncHandler(async (req: Request, res: Response) => {
    const applications = await ApplicationsService.getAll();
    res.json({
      success: true,
      data: applications
    });
  });

  static getStats = asyncHandler(async (req: Request, res: Response) => {
    const stats = await ApplicationsService.getStats();
    res.json({
      success: true,
      data: stats
    });
  });

  static updateStatus = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user.id;
    const { status, reason } = req.body;
    const application = await ApplicationsService.updateStatus(req.params.id as string, status, adminId, reason);
    res.json({
      success: true,
      data: application
    });
  });

  static approve = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user.id;
    const application = await ApplicationsService.approveApplication(req.params.id as string, adminId);
    res.json({
      success: true,
      data: application
    });
  });

  static reject = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user.id;
    const { reason } = req.body;
    const application = await ApplicationsService.rejectApplication(req.params.id as string, adminId, reason);
    res.json({
      success: true,
      data: application
    });
  });

  static assign = asyncHandler(async (req: Request, res: Response) => {
    const { evaluatorId } = req.body;
    const application = await ApplicationsService.assignEvaluator(req.params.id as string, evaluatorId);
    res.json({
      success: true,
      data: application
    });
  });

  static submitReview = asyncHandler(async (req: Request, res: Response) => {
    const reviewerId = (req as any).user.id;
    const application = await ApplicationsService.submitReview(req.params.id as string, reviewerId, req.body);
    res.status(201).json({
      success: true,
      data: application
    });
  });

  static updateVerifiedDocs = asyncHandler(async (req: Request, res: Response) => {
    const { verifiedDocs } = req.body;
    const application = await ApplicationsService.updateVerifiedDocs(req.params.id as string, verifiedDocs);
    res.json({
      success: true,
      data: application
    });
  });

  static getStaffPerformance = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const data = await ApplicationsService.getStaffPerformance(userId);
    res.json({ success: true, data });
  });

  static streamNotifications = (req: Request, res: Response) => {
    const userId = (req as any).user.id;

    // SSE headers — disable compression so chunks flush immediately
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering
    res.flushHeaders();

    // Register this connection
    sseManager.add(userId, res);

    // Send initial ping so client knows connection is live
    res.write('event: connected\ndata: {}\n\n');

    // Keep-alive ping every 25s (prevents proxy/firewall timeout)
    const ping = setInterval(() => {
      try { res.write('event: ping\ndata: {}\n\n'); } catch { clearInterval(ping); }
    }, 25000);

    req.on('close', () => {
      clearInterval(ping);
      sseManager.remove(userId, res);
    });
  };

  static getStaffStats = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const stats = await ApplicationsService.getStaffStats(userId);
    res.json({
      success: true,
      data: stats
    });
  });

  static sendEmailToStartup = asyncHandler(async (req: Request, res: Response) => {
    const { to, subject, message } = req.body;
    const result = await ApplicationsService.sendEmailToStartup(req.params.id as string, to, subject, message);
    res.json({
      success: true,
      data: result
    });
  });

  static markAsGraduated = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user.id;
    const application = await ApplicationsService.markAsGraduated(req.params.id as string, adminId);
    res.json({ success: true, data: application });
  });

  static revokeGraduation = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user.id;
    const application = await ApplicationsService.revokeGraduation(req.params.id as string, adminId);
    res.json({ success: true, data: application });
  });
}
