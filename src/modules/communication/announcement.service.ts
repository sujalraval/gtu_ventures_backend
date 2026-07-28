import prisma from '../../lib/prisma';
import { sendEmail } from '../../common/utils/mailer';
import { NotFoundError, BadRequestError } from '../../common/utils/apiError';

// ── Helpers ────────────────────────────────────────────────────────────────────

async function resolveRecipients(audience: string, cohortId?: string, schemeId?: string) {
  const base = { deletedAt: null } as any;

  switch (audience) {
    case 'ALL':
      return prisma.user.findMany({ where: base, select: { id: true, name: true, email: true } });
    case 'ALL_STARTUPS':
      return prisma.user.findMany({ where: { ...base, role: 'STARTUP' }, select: { id: true, name: true, email: true } });
    case 'ALL_MENTORS':
      return prisma.user.findMany({ where: { ...base, role: 'MENTOR' }, select: { id: true, name: true, email: true } });
    case 'ALL_STAFF':
      return prisma.user.findMany({ where: { ...base, role: { in: ['ADMIN', 'STAFF'] } }, select: { id: true, name: true, email: true } });
    case 'SPECIFIC_COHORT': {
      if (!cohortId) throw new BadRequestError('cohortId required for SPECIFIC_COHORT audience');
      // Find startups in this cohort via applications
      const apps = await prisma.startupApplication.findMany({
        where: { cohortId },
        select: { userId: true },
      });
      const ids = apps.map(a => a.userId);
      return prisma.user.findMany({ where: { id: { in: ids }, ...base }, select: { id: true, name: true, email: true } });
    }
    case 'SPECIFIC_SCHEME': {
      if (!schemeId) throw new BadRequestError('schemeId required for SPECIFIC_SCHEME audience');
      const apps = await prisma.startupApplication.findMany({
        where: { schemeId },
        select: { userId: true },
      });
      const ids = apps.map(a => a.userId);
      return prisma.user.findMany({ where: { id: { in: ids }, ...base }, select: { id: true, name: true, email: true } });
    }
    default:
      throw new BadRequestError('Invalid audience type');
  }
}

// ── Announcement service ────────────────────────────────────────────────────────

export class AnnouncementService {

  static async getAll(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.announcement.findMany({
        include: { sender: { select: { id: true, name: true } } },
        orderBy: { sentAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.announcement.count(),
    ]);
    return { items, total, page, limit };
  }

  static async getById(id: string) {
    const a = await prisma.announcement.findUnique({
      where: { id },
      include: {
        sender: { select: { id: true, name: true } },
        logs: {
          orderBy: { createdAt: 'desc' },
          take: 100,
          include: { recipient: { select: { id: true, name: true } } },
        },
      },
    });
    if (!a) throw new NotFoundError('Announcement not found');
    return a;
  }

  static async send(senderId: string, data: {
    title: string;
    body: string;
    audience: string;
    cohortId?: string;
    schemeId?: string;
    channel: string;
  }) {
    const recipients = await resolveRecipients(data.audience, data.cohortId, data.schemeId);
    if (recipients.length === 0) throw new BadRequestError('No recipients found for the selected audience');

    // Create announcement record first
    const announcement = await prisma.announcement.create({
      data: {
        title: data.title,
        body: data.body,
        audience: data.audience as any,
        cohortId: data.cohortId,
        schemeId: data.schemeId,
        channel: data.channel as any,
        sentBy: senderId,
        recipientCount: recipients.length,
      },
    });

    // Send emails and log each delivery
    const results = await Promise.allSettled(
      recipients.map(async (r) => {
        const log = await prisma.notificationLog.create({
          data: {
            announcementId: announcement.id,
            recipientId: r.id,
            recipientEmail: r.email,
            subject: data.title,
            channel: data.channel as any,
            status: 'PENDING',
          },
        });

        if (data.channel === 'EMAIL') {
          try {
            await sendEmail(r.email, data.title, buildAnnouncementEmail(data.title, data.body, r.name));
            await prisma.notificationLog.update({
              where: { id: log.id },
              data: { status: 'SENT', sentAt: new Date() },
            });
            return { email: r.email, status: 'sent' };
          } catch (err: any) {
            await prisma.notificationLog.update({
              where: { id: log.id },
              data: { status: 'FAILED', errorMessage: err?.message },
            });
            return { email: r.email, status: 'failed', error: err?.message };
          }
        }

        // IN_APP: mark as delivered immediately (visible in notification centre)
        await prisma.notificationLog.update({
          where: { id: log.id },
          data: { status: 'DELIVERED', sentAt: new Date() },
        });
        return { email: r.email, status: 'delivered' };
      })
    );

    const sent = results.filter(r => r.status === 'fulfilled' && (r.value as any).status !== 'failed').length;
    const failed = results.length - sent;

    return { announcement, sent, failed, total: recipients.length };
  }

  // In-app notification feed for a user
  static async getInAppFeed(userId: string, page = 1, limit = 30) {
    const skip = (page - 1) * limit;
    const logs = await prisma.notificationLog.findMany({
      where: { recipientId: userId, channel: 'IN_APP' },
      include: { announcement: { select: { id: true, title: true, body: true, sentAt: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });
    return logs;
  }

  static async markRead(logId: string, userId: string) {
    const log = await prisma.notificationLog.findFirst({ where: { id: logId, recipientId: userId } });
    if (!log) throw new NotFoundError('Notification not found');
    return prisma.notificationLog.update({
      where: { id: logId },
      data: { status: 'READ', readAt: new Date() },
    });
  }

  static async getUnreadCount(userId: string) {
    return prisma.notificationLog.count({
      where: { recipientId: userId, channel: 'IN_APP', status: 'DELIVERED' },
    });
  }
}

// ── Email template ─────────────────────────────────────────────────────────────

function buildAnnouncementEmail(title: string, body: string, recipientName: string | null): string {
  const name = recipientName || 'Team';
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Arial,sans-serif;background:#f4f6f8;margin:0;padding:20px;">
  <div style="max-width:580px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)">
    <div style="background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:28px 32px;color:#fff">
      <p style="margin:0 0 4px;font-size:12px;opacity:.8;text-transform:uppercase;letter-spacing:1px">Announcement</p>
      <h1 style="margin:0;font-size:20px">${title}</h1>
    </div>
    <div style="padding:28px 32px">
      <p style="color:#374151;margin:0 0 16px">Dear <strong>${name}</strong>,</p>
      <div style="color:#374151;line-height:1.7;white-space:pre-wrap">${body}</div>
    </div>
    <div style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;text-align:center">
      <p style="margin:0;color:#9ca3af;font-size:12px">This is an automated message from GUSEC. Do not reply to this email.</p>
    </div>
  </div>
</body>
</html>`;
}
