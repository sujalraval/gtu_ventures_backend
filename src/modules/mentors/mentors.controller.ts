import { Request, Response } from 'express';
import { MentorsService } from './mentors.service';

export class MentorsController {
  private mentorsService = new MentorsService();

  getDirectory = async (req: Request, res: Response) => {
    try {
      const mentors = await this.mentorsService.getDirectory();
      res.status(200).json(mentors);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };

  updateProfile = async (req: Request, res: Response) => {
    try {
      // In a real app, userId comes from req.user
      const { userId, bio, linkedInUrl, personalMeetingLink, sectorIds } = req.body;
      const profile = await this.mentorsService.updateProfile(userId, {
        bio,
        linkedInUrl,
        personalMeetingLink,
        sectorIds
      });
      res.status(200).json(profile);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };

  setAvailability = async (req: Request, res: Response) => {
    try {
      const { mentorId, availabilities } = req.body;
      const result = await this.mentorsService.setAvailability(mentorId, availabilities);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };

  getAvailability = async (req: Request, res: Response) => {
    try {
      const { mentorId } = req.params;
      const result = await this.mentorsService.getAvailability(mentorId as string);
      res.status(200).json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };

  bookSession = async (req: Request, res: Response) => {
    try {
      const { mentorId, startupId, scheduledStartTime, scheduledEndTime, topicsDiscussed } = req.body;
      const session = await this.mentorsService.bookSession({
        mentorId,
        startupId,
        scheduledStartTime: new Date(scheduledStartTime),
        scheduledEndTime: new Date(scheduledEndTime),
        topicsDiscussed
      });
      res.status(201).json(session);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };

  getSessions = async (req: Request, res: Response) => {
    try {
      const { userId, role } = req.query; // role could be MENTOR or STARTUP
      const sessions = await this.mentorsService.getSessions(userId as string, role as string);
      res.status(200).json(sessions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };

  submitFeedback = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { startupRating, startupNotes, mentorFlags } = req.body;
      const feedback = await this.mentorsService.submitFeedback(id as string, {
        startupRating,
        startupNotes,
        mentorFlags
      });
      res.status(200).json(feedback);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  };
}
