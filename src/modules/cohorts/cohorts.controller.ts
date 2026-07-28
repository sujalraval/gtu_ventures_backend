import { Request, Response } from 'express';
import { CohortsService } from './cohorts.service';
import asyncHandler from '../../common/utils/asyncHandler';

interface CohortParams {
  id: string;
}

interface MeetingParams extends CohortParams {
  meetingId: string;
}

export class CohortsController {
  static getAll = asyncHandler(async (req: Request, res: Response) => {
    const cohorts = await CohortsService.getAllCohorts();
    res.json({
      success: true,
      data: cohorts
    });
  });

  static getById = asyncHandler(async (req: Request<CohortParams>, res: Response) => {
    const cohort = await CohortsService.getCohortById(req.params.id);
    res.json({
      success: true,
      data: cohort
    });
  });

  static create = asyncHandler(async (req: Request, res: Response) => {
    const cohort = await CohortsService.createCohort(req.body);
    res.status(201).json({
      success: true,
      data: cohort
    });
  });

  static update = asyncHandler(async (req: Request<CohortParams>, res: Response) => {
    const cohort = await CohortsService.updateCohort(req.params.id, req.body);
    res.json({
      success: true,
      data: cohort
    });
  });

  // Specialized Controller endpoint mapping directly to our Cohort Monitoring Dashboard in React
  static getDetailedMonitoring = asyncHandler(async (req: Request<CohortParams>, res: Response) => {
    const monitoringData = await CohortsService.getCohortDetailedMonitoring(req.params.id);
    res.json({
      success: true,
      data: monitoringData
    });
  });

  static assignStartups = asyncHandler(async (req: Request<CohortParams>, res: Response) => {
    const { applicationIds } = req.body;
    const result = await CohortsService.assignStartupsToCohort(req.params.id, applicationIds);
    res.json({
      success: true,
      message: `Successfully assigned ${result.count} startups to cohort`,
      data: result
    });
  });

  static getEligibleStartups = asyncHandler(async (req: Request<CohortParams>, res: Response) => {
    const candidates = await CohortsService.getEligibleStartupsForCohort(req.params.id);
    res.json({
      success: true,
      data: candidates
    });
  });

  // --- Mentor & Program Management Endpoints ---

  static getEligibleMentors = asyncHandler(async (req: Request, res: Response) => {
    const mentors = await CohortsService.getEligibleMentors();
    res.json({
      success: true,
      data: mentors
    });
  });

  static assignMentors = asyncHandler(async (req: Request<CohortParams>, res: Response) => {
    const { userIds, role } = req.body;
    const result = await CohortsService.assignMentorsToCohort(req.params.id, userIds, role);
    res.json({
      success: true,
      message: `Successfully assigned ${result.count} mentors`,
      data: result
    });
  });

  static getProgramDetails = asyncHandler(async (req: Request<CohortParams>, res: Response) => {
    const data = await CohortsService.getCohortProgramDetails(req.params.id);
    res.json({
      success: true,
      data
    });
  });

  static createModule = asyncHandler(async (req: Request<CohortParams>, res: Response) => {
    const result = await CohortsService.createModule(req.params.id, req.body);
    res.status(201).json({
      success: true,
      data: result
    });
  });

  static scheduleMeeting = asyncHandler(async (req: Request<CohortParams>, res: Response) => {
    const result = await CohortsService.scheduleMeeting(req.params.id, req.body);
    res.status(201).json({
      success: true,
      data: result
    });
  });

  static createTask = asyncHandler(async (req: Request<CohortParams>, res: Response) => {
    const result = await CohortsService.createTask(req.params.id, req.body);
    res.status(201).json({
      success: true,
      data: result
    });
  });

  // --- Attendance Management ---

  static importMembers = asyncHandler(async (req: Request<CohortParams>, res: Response) => {
    const { members } = req.body;
    const result = await CohortsService.importMembersFromCSV(req.params.id, members);
    res.json({
      success: true,
      message: `Successfully imported ${result.count} members`,
      data: result
    });
  });

  static bulkActionMembers = asyncHandler(async (req: Request<CohortParams>, res: Response) => {
    const { action, userIds, payload } = req.body;
    const result = await CohortsService.bulkActionMembers(req.params.id, action, userIds, payload);
    res.json({
      success: true,
      message: `Successfully executed ${action} for selected members`,
      data: result
    });
  });

  static getMeetingAttendance = asyncHandler(async (req: Request<MeetingParams>, res: Response) => {
    const { id: cohortId, meetingId } = req.params;
    const data = await CohortsService.getMeetingAttendance(cohortId, meetingId);
    res.json({ success: true, data });
  });

  static markAttendance = asyncHandler(async (req: Request<MeetingParams>, res: Response) => {
    const { id: cohortId, meetingId } = req.params;
    // records: [{ startupId: string, isPresent: boolean, remarks?: string }]
    const { records } = req.body;
    const result = await CohortsService.markAttendance(cohortId, meetingId, records);
    res.json({ success: true, data: result, message: `Attendance saved for ${result.count} members` });
  });
}

