import prisma from '../../lib/prisma';

export class MentorsService {
  async getDirectory() {
    return prisma.mentorProfile.findMany({
      where: {
        isVerified: true
      },
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        },
        sectors: true
      }
    });
  }

  async updateProfile(userId: string, data: { bio?: string; linkedInUrl?: string; personalMeetingLink?: string; sectorIds?: string[] }) {
    const profileData: any = {
      bio: data.bio,
      linkedInUrl: data.linkedInUrl,
      personalMeetingLink: data.personalMeetingLink
    };

    if (data.sectorIds) {
      profileData.sectors = {
        set: data.sectorIds.map(id => ({ id }))
      };
    }

    return prisma.mentorProfile.upsert({
      where: { userId },
      update: profileData,
      create: {
        userId,
        ...profileData,
        isVerified: false // Needs admin approval
      },
      include: {
        sectors: true
      }
    });
  }

  async setAvailability(mentorId: string, availabilities: Array<{ dayOfWeek: number; startTime: string; endTime: string }>) {
    // Delete existing availabilities
    await prisma.mentorAvailability.deleteMany({
      where: { mentorId }
    });

    // Create new ones
    if (availabilities && availabilities.length > 0) {
      await prisma.mentorAvailability.createMany({
        data: availabilities.map(a => ({
          mentorId,
          dayOfWeek: a.dayOfWeek,
          startTime: a.startTime,
          endTime: a.endTime
        }))
      });
    }

    return this.getAvailability(mentorId);
  }

  async getAvailability(mentorId: string) {
    return prisma.mentorAvailability.findMany({
      where: { mentorId }
    });
  }

  async bookSession(data: { mentorId: string; startupId: string; scheduledStartTime: Date; scheduledEndTime: Date; topicsDiscussed?: string }) {
    return prisma.mentorshipSession.create({
      data: {
        mentorId: data.mentorId,
        startupId: data.startupId,
        scheduledStartTime: data.scheduledStartTime,
        scheduledEndTime: data.scheduledEndTime,
        topicsDiscussed: data.topicsDiscussed
      }
    });
  }

  async getSessions(userId: string, role: string) {
    const whereClause = role === 'MENTOR' ? { mentorId: userId } : { startupId: userId };
    return prisma.mentorshipSession.findMany({
      where: whereClause,
      include: {
        mentor: { select: { name: true, mentorProfile: { select: { personalMeetingLink: true } } } },
        startup: { select: { name: true } },
        feedback: true
      },
      orderBy: { scheduledStartTime: 'desc' }
    });
  }

  async submitFeedback(sessionId: string, data: { startupRating?: number; startupNotes?: string; mentorFlags?: string }) {
    return prisma.sessionFeedback.upsert({
      where: { sessionId },
      update: data,
      create: {
        sessionId,
        ...data
      }
    });
  }
}
