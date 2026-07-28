import prisma from '../../lib/prisma';
import { NotFoundError, BadRequestError } from '../../common/utils/apiError';

// ── Types ──────────────────────────────────────────────────────────────────────

interface CreateEventAnnouncementInput {
  title: string;
  content: string;
  type: 'EVENT' | 'SESSION' | 'PROGRAM' | 'GENERAL';
  scheduledAt?: string;
  durationMin?: number;
  location?: string;
  isVirtual?: boolean;
  maxSeats?: number;
  targetCohort?: string;
  speakerName?: string;
}

interface UpdateEventAnnouncementInput extends Partial<CreateEventAnnouncementInput> {}

// ── Helpers ────────────────────────────────────────────────────────────────────

function computeAvgRating(feedbacks: { rating: number }[]): number | null {
  if (feedbacks.length === 0) return null;
  const sum = feedbacks.reduce((acc, f) => acc + f.rating, 0);
  return Math.round((sum / feedbacks.length) * 10) / 10;
}

// ── Service ────────────────────────────────────────────────────────────────────

export class EventAnnouncementService {

  // Admin: list all (paginated) with summary counts
  static async getAll(page = 1, limit = 20, type?: string) {
    const skip = (page - 1) * limit;
    const where: any = { deletedAt: null };
    if (type && type !== 'ALL') where.type = type;

    const [items, total] = await Promise.all([
      prisma.eventAnnouncement.findMany({
        where,
        include: {
          creator: { select: { id: true, name: true } },
          rsvps: {
            include: {
              startup: {
                select: {
                  id: true,
                  name: true,
                  startupApplication: { select: { cohortId: true } },
                },
              },
            },
          },
          feedbacks: { select: { rating: true, comment: true, startupName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.eventAnnouncement.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  // Admin: get single announcement with full RSVP + feedback detail
  static async getById(id: string) {
    const item = await prisma.eventAnnouncement.findFirst({
      where: { id, deletedAt: null },
      include: {
        creator: { select: { id: true, name: true } },
        rsvps: {
          include: {
            startup: {
              select: {
                id: true,
                name: true,
                startupApplication: { select: { cohortId: true } },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        feedbacks: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!item) throw new NotFoundError('Event announcement not found');
    return item;
  }

  // Admin: create
  static async create(createdBy: string, data: CreateEventAnnouncementInput) {
    return prisma.eventAnnouncement.create({
      data: {
        title: data.title,
        content: data.content,
        type: data.type,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : undefined,
        durationMin: data.durationMin,
        location: data.location,
        isVirtual: data.isVirtual ?? false,
        maxSeats: data.maxSeats,
        targetCohort: data.targetCohort,
        speakerName: data.speakerName,
        createdBy,
      },
      include: {
        creator: { select: { id: true, name: true } },
      },
    });
  }

  // Admin: update
  static async update(id: string, data: UpdateEventAnnouncementInput) {
    await EventAnnouncementService.getById(id);
    return prisma.eventAnnouncement.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.content !== undefined && { content: data.content }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.scheduledAt !== undefined && { scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null }),
        ...(data.durationMin !== undefined && { durationMin: data.durationMin }),
        ...(data.location !== undefined && { location: data.location }),
        ...(data.isVirtual !== undefined && { isVirtual: data.isVirtual }),
        ...(data.maxSeats !== undefined && { maxSeats: data.maxSeats }),
        ...(data.targetCohort !== undefined && { targetCohort: data.targetCohort }),
        ...(data.speakerName !== undefined && { speakerName: data.speakerName }),
      },
    });
  }

  // Admin: soft delete
  static async delete(id: string) {
    await EventAnnouncementService.getById(id);
    return prisma.eventAnnouncement.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // Admin: mark attendance for a startup's RSVP
  static async markAttendance(announcementId: string, startupId: string, attended: boolean) {
    const rsvp = await prisma.eventAnnouncementRSVP.findUnique({
      where: { announcementId_startupId: { announcementId, startupId } },
    });
    if (!rsvp) throw new NotFoundError('RSVP not found');
    return prisma.eventAnnouncementRSVP.update({
      where: { announcementId_startupId: { announcementId, startupId } },
      data: { attended },
    });
  }

  // Admin: aggregate stats for dashboard metrics
  static async getStats() {
    const [totalPosts, totalRsvps, attendedCount, feedbackCount, feedbackAvg] = await Promise.all([
      prisma.eventAnnouncement.count({ where: { deletedAt: null } }),
      prisma.eventAnnouncementRSVP.count(),
      prisma.eventAnnouncementRSVP.count({ where: { attended: true } }),
      prisma.eventAnnouncementFeedback.count(),
      prisma.eventAnnouncementFeedback.aggregate({ _avg: { rating: true } }),
    ]);

    return {
      totalPosts,
      totalRsvps,
      attendedCount,
      avgRating: feedbackCount > 0
        ? Math.round((feedbackAvg._avg.rating ?? 0) * 10) / 10
        : null,
    };
  }

  // ── Startup-facing ────────────────────────────────────────────────────────────

  // Startup: list announcements (visible to them) with their RSVP status
  static async getForStartup(startupId: string, page = 1, limit = 30, type?: string) {
    const skip = (page - 1) * limit;
    const where: any = { deletedAt: null };
    if (type && type !== 'ALL') where.type = type;

    const [items, total] = await Promise.all([
      prisma.eventAnnouncement.findMany({
        where,
        include: {
          rsvps: {
            where: { startupId },
            select: { status: true, attended: true },
          },
          feedbacks: {
            where: { startupId },
            select: { rating: true, comment: true },
          },
          _count: { select: { rsvps: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.eventAnnouncement.count({ where }),
    ]);

    const shaped = items.map(item => ({
      id: item.id,
      title: item.title,
      content: item.content,
      type: item.type,
      scheduledAt: item.scheduledAt,
      durationMin: item.durationMin,
      location: item.location,
      isVirtual: item.isVirtual,
      maxSeats: item.maxSeats,
      targetCohort: item.targetCohort,
      speakerName: item.speakerName,
      createdAt: item.createdAt,
      rsvpCount: item._count.rsvps,
      myRsvp: item.rsvps[0] ?? null,
      myFeedback: item.feedbacks[0] ?? null,
    }));

    return { items: shaped, total, page, limit };
  }

  // Startup: upsert RSVP (create or update)
  static async rsvp(announcementId: string, startupId: string, status: 'GOING' | 'MAYBE' | 'NOT_GOING') {
    const ann = await prisma.eventAnnouncement.findFirst({
      where: { id: announcementId, deletedAt: null },
    });
    if (!ann) throw new NotFoundError('Announcement not found');

    // Enforce max seats only for GOING
    if (status === 'GOING' && ann.maxSeats) {
      const goingCount = await prisma.eventAnnouncementRSVP.count({
        where: { announcementId, status: 'GOING', startupId: { not: startupId } },
      });
      if (goingCount >= ann.maxSeats) {
        throw new BadRequestError('Event is at full capacity');
      }
    }

    return prisma.eventAnnouncementRSVP.upsert({
      where: { announcementId_startupId: { announcementId, startupId } },
      create: { announcementId, startupId, status },
      update: { status },
    });
  }

  // Startup: remove RSVP (cancel)
  static async cancelRsvp(announcementId: string, startupId: string) {
    const rsvp = await prisma.eventAnnouncementRSVP.findUnique({
      where: { announcementId_startupId: { announcementId, startupId } },
    });
    if (!rsvp) throw new NotFoundError('RSVP not found');
    return prisma.eventAnnouncementRSVP.delete({
      where: { announcementId_startupId: { announcementId, startupId } },
    });
  }

  // Startup: submit or update feedback
  static async submitFeedback(
    announcementId: string,
    startupId: string,
    startupName: string,
    rating: number,
    comment?: string,
  ) {
    if (rating < 1 || rating > 5) throw new BadRequestError('Rating must be between 1 and 5');

    const ann = await prisma.eventAnnouncement.findFirst({
      where: { id: announcementId, deletedAt: null },
    });
    if (!ann) throw new NotFoundError('Announcement not found');

    // Must have attended to leave feedback
    const rsvp = await prisma.eventAnnouncementRSVP.findUnique({
      where: { announcementId_startupId: { announcementId, startupId } },
    });
    if (!rsvp || !rsvp.attended) {
      throw new BadRequestError('You must have attended this event to leave feedback');
    }

    return prisma.eventAnnouncementFeedback.upsert({
      where: { announcementId_startupId: { announcementId, startupId } },
      create: { announcementId, startupId, startupName, rating, comment },
      update: { rating, comment },
    });
  }
}
