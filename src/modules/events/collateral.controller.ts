import { Request, Response, NextFunction } from 'express';
import {
  generateAttendeeCSV,
  generatePitchSummaryCSV,
  generateEventReportPDF,
} from './collateral.service';

export class CollateralController {

  static async downloadAttendeeCSV(req: Request, res: Response, next: NextFunction) {
    try {
      const eventId = req.params['eventId'] as string;
      const { csv, filename } = await generateAttendeeCSV(eventId);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (err) { next(err); }
  }

  static async downloadPitchSummaryCSV(req: Request, res: Response, next: NextFunction) {
    try {
      const eventId = req.params['eventId'] as string;
      const { csv, filename } = await generatePitchSummaryCSV(eventId);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (err) { next(err); }
  }

  static async downloadEventReportPDF(req: Request, res: Response, next: NextFunction) {
    try {
      const eventId = req.params['eventId'] as string;
      const { buffer, filename } = await generateEventReportPDF(eventId);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (err) { next(err); }
  }
}
