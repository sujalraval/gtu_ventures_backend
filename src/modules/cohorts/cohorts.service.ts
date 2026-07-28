import prisma from '../../lib/prisma';
import { NotFoundError } from '../../common/utils/apiError';
import { sendEmail } from '../../common/utils/mailer';

export class CohortsService {
  static async getAllCohorts() {
    try {
      return await prisma.cohort.findMany({
        include: {
          scheme: true,
          manager: true,
          _count: {
            select: { applications: true }
          }
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error: any) {
      console.error('Error in getAllCohorts:', error);
      throw error;
    }
  }

  static async getCohortById(id: string) {
    const cohort = await prisma.cohort.findUnique({
      where: { id },
      include: {
        scheme: true,
        manager: true,
      }
    });
    if (!cohort) throw new NotFoundError('Cohort not found');
    return cohort;
  }

  static async createCohort(data: any) {
    return await prisma.cohort.create({
      data: {
        name: data.name,
        startDate: new Date(data.startDate),
        domain: data.domain,
        budget: data.budget ? parseFloat(data.budget) : null,
        schemeId: data.schemeId,
        managerId: data.managerId,
        status: data.status || 'Active',
        milestoneTemplates: data.milestoneTemplates || null,
        waitlistSettings: data.waitlistSettings || null,
      },
    });
  }

  static async updateCohort(id: string, data: any) {
    await this.getCohortById(id);
    return await prisma.cohort.update({
      where: { id },
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        budget: data.budget ? parseFloat(data.budget) : undefined,
        milestoneTemplates: data.milestoneTemplates !== undefined ? data.milestoneTemplates : undefined,
        waitlistSettings: data.waitlistSettings !== undefined ? data.waitlistSettings : undefined,
      },
    });
  }

  // Highly-specialized aggregated query that powers the Cohort Monitoring Pipeline Dashboard
  static async getCohortDetailedMonitoring(cohortId: string) {
    const cohort = await this.getCohortById(cohortId);

    const applications = await prisma.startupApplication.findMany({
      where: { cohortId },
      include: {
        user: true,
        formB: true,
        generatedAgreements: {
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        grantAllocation: {
          include: {
            tranches: {
              orderBy: { installmentNo: 'asc' },
              include: {
                milestones: {
                  include: {
                    sprs: {
                      orderBy: { submissionDate: 'desc' }
                    }
                  }
                },
                utilisationCertificate: true,
                utilisationEntries: {
                  include: { budgetHead: true }
                }
              }
            }
          }
        }
      }
    });

    return {
      cohort,
      startups: applications
    };
  }

  // Operational Utility to bind distinct startups into a cohort definition
  static async assignStartupsToCohort(cohortId: string, applicationIds: string[]) {
    await this.getCohortById(cohortId);

    return await prisma.$transaction(async (tx) => {
      // 1. Sync legacy StartupApplication link
      await tx.startupApplication.updateMany({
        where: { id: { in: applicationIds } },
        data: { cohortId }
      });

      // 2. Fetch userId for each application — filter out any with null userId
      const applications = await tx.startupApplication.findMany({
        where: { id: { in: applicationIds } },
        select: { userId: true, startupName: true }
      });

      const validMembers = applications.filter(app => app.userId !== null);

      if (validMembers.length === 0) {
        console.warn(`[assignStartups] All applications have null userId — skipping CohortMember creation`);
        return { count: 0 };
      }

      // 3. Populate CohortMember junction table for advanced tracking
      return await tx.cohortMember.createMany({
        data: validMembers.map(app => ({
          cohortId,
          userId: app.userId!,
          status: 'Active'
        })),
        skipDuplicates: true
      });
    });
  }


  // Fetch all approved/selected startups belonging to the same scheme that are currently not assigned to ANY cohort.
  static async getEligibleStartupsForCohort(cohortId: string) {
    const cohort = await this.getCohortById(cohortId);
    
    return await prisma.startupApplication.findMany({
      where: {
        schemeId: cohort.schemeId,
        cohortId: null,
        status: {
          in: ['APPROVED', 'SELECTED_FOR_PITCH', 'SUBMITTED', 'UNDER_REVIEW'] 
        }
      },
      include: {
        user: {
          include: {
            startupProfile: true
          }
        },
        scheme: true,
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  // --- Mentor Assignment Logic ---

  static async getEligibleMentors() {
    return await prisma.user.findMany({
      where: {
        role: { in: ['MENTOR', 'EXPERT', 'STAFF', 'ADMIN'] }
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      }
    });
  }

  static async assignMentorsToCohort(cohortId: string, userIds: string[], role: string) {
    await this.getCohortById(cohortId);

    const mentorData = userIds.map(userId => ({
      cohortId,
      userId,
      role: role || 'Advisor'
    }));

    return await prisma.cohortMentor.createMany({
      data: mentorData,
      skipDuplicates: true
    });
  }

  // --- Program Content Management ---

  static async getCohortProgramDetails(cohortId: string) {
    const cohort = await prisma.cohort.findUnique({
      where: { id: cohortId },
      include: {
        manager: true,
        scheme: true,
        modules: {
          include: {
            resources: true
          },
          orderBy: { sequenceOrder: 'asc' }
        },
        meetings: {
          include: {
            instructor: true,
            _count: { select: { attendance: true } }
          },
          orderBy: { startTime: 'asc' }
        },
        tasks: {
          include: {
            _count: { select: { submissions: true } }
          },
          orderBy: { dueDate: 'asc' }
        },
        members: {
          include: {
            user: {
              include: {
                startupProfile: true,
                startupApplication: true,
                cohortAttendances: {
                  where: {
                    meeting: { cohortId }
                  }
                },
                cohortSubmissions: {
                  where: {
                    task: { cohortId }
                  }
                }
              }
            }
          }
        },
        mentors: {
          include: {
            user: true
          }
        }
      }
    });

    if (!cohort) return null;

    const totalMeetings = (cohort as any).meetings.length;
    const totalTasks = (cohort as any).tasks.length;

    // Enhance members with calculated metrics
    const enhancedMembers = (cohort as any).members.map((member: any) => {
      const attendances = member.user?.cohortAttendances || [];
      const presentCount = attendances.filter((a: any) => a.isPresent).length;
      const attendanceRate = totalMeetings > 0 ? Math.round((presentCount / totalMeetings) * 100) : 0;

      const submissions = member.user?.cohortSubmissions || [];
      const submissionCount = submissions.length;
      const submissionRate = totalTasks > 0 ? Math.round((submissionCount / totalTasks) * 100) : 0;

      return {
        ...member,
        metrics: {
          attendanceRate,
          submissionRate,
          presentCount,
          submissionCount
        }
      };
    });

    // Calculate overall cohort completion (average of task submission rate)
    const overallCompletion = enhancedMembers.length > 0 
      ? Math.round((enhancedMembers as any).reduce((acc: number, m: any) => acc + m.metrics.submissionRate, 0) / enhancedMembers.length)
      : 0;

    return {
      ...cohort,
      members: enhancedMembers,
      completion: overallCompletion
    };
  }

  static async createModule(cohortId: string, data: any) {
    return await prisma.cohortModule.create({
      data: {
        cohortId,
        title: data.title,
        description: data.description,
        sequenceOrder: data.sequenceOrder || 0,
        totalSessions: data.totalSessions || 0,
      }
    });
  }

  static async scheduleMeeting(cohortId: string, data: any) {
    return await prisma.cohortMeeting.create({
      data: {
        cohortId,
        moduleId: data.moduleId,
        title: data.title,
        type: data.type,
        startTime: new Date(data.startTime),
        endTime: data.endTime ? new Date(data.endTime) : null,
        instructorId: data.instructorId,
        meetingLink: data.meetingLink,
      }
    });
  }

  static async createTask(cohortId: string, data: any) {
    return await prisma.cohortTask.create({
      data: {
        cohortId,
        title: data.title,
        description: data.description,
        dueDate: new Date(data.dueDate),
        priority: data.priority || 'Medium',
        submissionType: data.submissionType || 'File',
      }
    });
  }

  // --- Attendance Management ---

  static async getMeetingAttendance(cohortId: string, meetingId: string) {
    // Verify meeting belongs to this cohort
    const meeting = await prisma.cohortMeeting.findFirst({
      where: { id: meetingId, cohortId },
      include: { instructor: true }
    });
    if (!meeting) throw new Error('Meeting not found in this cohort');

    // Get all cohort members
    const members = await prisma.cohortMember.findMany({
      where: { cohortId, status: 'Active' },
      include: {
        user: {
          include: { startupProfile: true, startupApplication: true }
        }
      }
    });

    // Get existing attendance records for this meeting
    const attendance = await prisma.cohortAttendance.findMany({
      where: { meetingId }
    });

    // Merge: annotate each member with their attendance status
    const attendanceMap = new Map(attendance.map(a => [a.startupId, a]));
    const result = members.map(member => ({
      memberId: member.id,
      userId: member.userId,
      name: member.user?.startupProfile?.companyName || member.user?.startupApplication?.startupName || member.user?.name || 'Unknown',
      founder: member.user?.name || 'N/A',
      isPresent: attendanceMap.get(member.userId)?.isPresent ?? false,
      remarks: attendanceMap.get(member.userId)?.remarks ?? '',
      markedAt: attendanceMap.get(member.userId)?.markedAt ?? null,
    }));

    return { meeting, attendance: result };
  }

  static async markAttendance(
    cohortId: string,
    meetingId: string,
    records: { startupId: string; isPresent: boolean; remarks?: string }[]
  ) {
    // Verify meeting belongs to this cohort
    const meeting = await prisma.cohortMeeting.findFirst({
      where: { id: meetingId, cohortId }
    });
    if (!meeting) throw new Error('Meeting not found in this cohort');

    return await prisma.$transaction(async (tx) => {
      let count = 0;
      for (const record of records) {
        await tx.cohortAttendance.upsert({
          where: { meetingId_startupId: { meetingId, startupId: record.startupId } },
          create: {
            meetingId,
            startupId: record.startupId,
            isPresent: record.isPresent,
            remarks: record.remarks || null,
            markedAt: new Date(),
          },
          update: {
            isPresent: record.isPresent,
            remarks: record.remarks || null,
            markedAt: new Date(),
          }
        });
        count++;
      }

      // After saving, update meeting status to 'Completed' if it was 'Upcoming'
      if (meeting.status === 'Upcoming') {
        await tx.cohortMeeting.update({
          where: { id: meetingId },
          data: { status: 'Completed' }
        });
      }

      return { count };
    });
  }

  static async importMembersFromCSV(cohortId: string, rows: Array<{ email: string; name?: string; startupName?: string; mobile?: string }>) {
    const cohort = await this.getCohortById(cohortId);
    return await prisma.$transaction(async (tx) => {
      let importedCount = 0;
      for (const row of rows) {
        if (!row.email) continue;
        let user = await tx.user.findUnique({ where: { email: row.email } });
        if (!user) {
          user = await tx.user.create({
            data: {
              email: row.email,
              name: row.name || row.email.split('@')[0],
              role: 'STARTUP',
              isSetupComplete: false,
              isActive: true,
            }
          });
        }
        
        if (row.startupName) {
          await tx.startupProfile.upsert({
            where: { userId: user.id },
            create: {
              companyName: row.startupName,
              userId: user.id,
            },
            update: {
              companyName: row.startupName,
            }
          });
        }
        
        const settings: any = cohort.waitlistSettings || {};
        let status = 'Active';
        if (settings.maxCapacity) {
          const activeCount = await tx.cohortMember.count({
            where: { cohortId, status: 'Active' }
          });
          if (activeCount >= settings.maxCapacity && settings.rolloverEnabled) {
            status = 'WAITLIST';
          }
        }

        await tx.cohortMember.upsert({
          where: { cohortId_userId: { cohortId, userId: user.id } },
          create: {
            cohortId,
            userId: user.id,
            status,
          },
          update: {
            status,
          }
        });
        
        importedCount++;
      }
      return { count: importedCount };
    });
  }

  static async bulkActionMembers(
    cohortId: string,
    action: 'UPDATE_STATUS' | 'REQUEST_DOCUMENTS',
    userIds: string[],
    payload: any
  ) {
    await this.getCohortById(cohortId);

    if (action === 'UPDATE_STATUS') {
      const { status } = payload;
      if (!status) throw new Error('Status payload is required for UPDATE_STATUS action');
      
      const result = await prisma.cohortMember.updateMany({
        where: {
          cohortId,
          userId: { in: userIds }
        },
        data: { status }
      });
      return { updatedCount: result.count };
    } 
    
    if (action === 'REQUEST_DOCUMENTS') {
      const { documentNames } = payload;
      if (!documentNames || !Array.isArray(documentNames) || documentNames.length === 0) {
        throw new Error('documentNames array is required for REQUEST_DOCUMENTS action');
      }

      // Fetch users
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        include: { startupProfile: true, startupApplication: true }
      });

      let emailSentCount = 0;
      for (const user of users) {
        if (!user.email) continue;
        const name = user.startupProfile?.companyName || user.startupApplication?.startupName || user.name || 'Startup Founder';
        const docListHtml = documentNames.map(d => `<li><strong>${d}</strong></li>`).join('');
        const emailBody = `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e5e5; border-radius: 8px;">
            <h2 style="color: #4f46e5; margin-top: 0;">Missing Document Submission Request</h2>
            <p>Dear ${name},</p>
            <p>The program administrators have requested the submission of the following documents for your participation in the cohort program:</p>
            <ul style="background: #f9fafb; padding: 15px 30px; border-radius: 6px; border-left: 4px solid #4f46e5; list-style-type: none;">
              ${docListHtml}
            </ul>
            <p>Please log in to the Incubation Management Platform and upload these documents under your startup profile or application portal as soon as possible.</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #666; text-align: center;">This is an automated notification from the Incubation Management Platform. Please do not reply to this email.</p>
          </div>
        `;

        try {
          await sendEmail(user.email, 'Document Submission Request - Cohort Program', emailBody);
          emailSentCount++;
        } catch (err) {
          console.error(`Failed to send document request email to ${user.email}:`, err);
        }
      }

      return { emailSentCount };
    }

    throw new Error(`Unsupported bulk action: ${action}`);
  }
}
