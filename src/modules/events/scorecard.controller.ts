import { Request, Response, NextFunction } from 'express';
import { ScorecardService } from './scorecard.service';

export class ScorecardController {

  static async getCriteria(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ScorecardService.getCriteria(req.params['eventId'] as string);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async upsertCriteria(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ScorecardService.upsertCriteria(req.params['eventId'] as string, req.body.criteria);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async deleteCriteria(req: Request, res: Response, next: NextFunction) {
    try {
      await ScorecardService.deleteCriteria(req.params['criteriaId'] as string);
      res.json({ success: true });
    } catch (err) { next(err); }
  }

  static async getJudges(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ScorecardService.getJudges(req.params['eventId'] as string);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async assignJudge(req: Request, res: Response, next: NextFunction) {
    try {
      const { judgeId, startupId } = req.body;
      const data = await ScorecardService.assignJudge(req.params['eventId'] as string, judgeId, startupId);
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async removeJudge(req: Request, res: Response, next: NextFunction) {
    try {
      await ScorecardService.removeJudge(req.params['assignmentId'] as string);
      res.json({ success: true });
    } catch (err) { next(err); }
  }

  static async submitScore(req: Request, res: Response, next: NextFunction) {
    try {
      const judgeId = (req as any).user.id;
      const data = await ScorecardService.submitScore(req.params['eventId'] as string, judgeId, req.body);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async submitBatchScores(req: Request, res: Response, next: NextFunction) {
    try {
      const judgeId = (req as any).user.id;
      const data = await ScorecardService.submitBatchScores(req.params['eventId'] as string, judgeId, req.body.scores);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async getJudgeScores(req: Request, res: Response, next: NextFunction) {
    try {
      const judgeId = (req as any).user.id;
      const startupId = req.query['startupId'] as string | undefined;
      const data = await ScorecardService.getJudgeScores(req.params['eventId'] as string, judgeId, startupId);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async getLeaderboard(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ScorecardService.getLeaderboard(req.params['eventId'] as string);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }

  static async getStartupsToScore(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ScorecardService.getStartupsToScore(req.params['eventId'] as string);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  }
}
