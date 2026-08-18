import { Request, Response } from 'express';
import asyncHandler from '../../common/utils/asyncHandler';
import prisma from '../../lib/prisma';
import { NotFoundError } from '../../common/utils/apiError';
import * as CertificatesService from './certificates.service';

export class CertificatesController {
  static getTemplate = asyncHandler(async (req: Request, res: Response) => {
    const event = await prisma.event.findUnique({
      where: { id: req.params['eventId'] as string },
      select: { certificateTemplate: true },
    });
    if (!event) throw new NotFoundError('Event not found');
    res.json({
      success: true,
      data: CertificatesService.resolveTemplate(event.certificateTemplate),
    });
  });

  static saveTemplate = asyncHandler(async (req: Request, res: Response) => {
    const template = CertificatesService.resolveTemplate(req.body);
    const event = await prisma.event.update({
      where: { id: req.params['eventId'] as string },
      data: { certificateTemplate: template as any },
      select: { certificateTemplate: true },
    });
    res.json({ success: true, data: event.certificateTemplate });
  });

  static stats = asyncHandler(async (req: Request, res: Response) => {
    const data = await CertificatesService.getCertificateStats(req.params['eventId'] as string);
    res.json({ success: true, data });
  });

  // Renders the template with sample values so an admin can check the layout
  // without emailing anybody.
  static preview = asyncHandler(async (req: Request, res: Response) => {
    const { buffer, filename } = await CertificatesService.previewCertificate(
      req.params['eventId'] as string,
      req.body?.template,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(buffer);
  });

  static download = asyncHandler(async (req: Request, res: Response) => {
    const { buffer, filename } = await CertificatesService.buildCertificate(
      req.params['eventId'] as string,
      req.params['regId'] as string,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  });

  static emailOne = asyncHandler(async (req: Request, res: Response) => {
    const data = await CertificatesService.emailCertificate(
      req.params['eventId'] as string,
      req.params['regId'] as string,
    );
    res.json({ success: true, data });
  });

  static issueAll = asyncHandler(async (req: Request, res: Response) => {
    const data = await CertificatesService.issueForEvent(req.params['eventId'] as string, {
      resend: req.body?.resend === true,
    });
    res.json({ success: true, data });
  });

  // Public — lets anyone confirm a certificate number is genuine.
  static verify = asyncHandler(async (req: Request, res: Response) => {
    const data = await CertificatesService.verifyCertificate(
      decodeURIComponent(req.params['certificateNo'] as string),
    );
    res.json({ success: true, data });
  });
}
