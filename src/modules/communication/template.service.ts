import prisma from '../../lib/prisma';
import { sendEmail } from '../../common/utils/mailer';
import { NotFoundError } from '../../common/utils/apiError';

export class TemplateService {

  static async getAll() {
    return prisma.notificationTemplate.findMany({
      include: { creator: { select: { id: true, name: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  static async getById(id: string) {
    const t = await prisma.notificationTemplate.findUnique({
      where: { id },
      include: { creator: { select: { id: true, name: true } } },
    });
    if (!t) throw new NotFoundError('Template not found');
    return t;
  }

  static async create(userId: string, data: {
    name: string;
    subject?: string;
    body: string;
    channel?: string;
    mergeFields?: string[];
  }) {
    return prisma.notificationTemplate.create({
      data: {
        name: data.name,
        subject: data.subject,
        body: data.body,
        channel: (data.channel as any) || 'EMAIL',
        mergeFields: data.mergeFields || [],
        createdBy: userId,
      },
    });
  }

  static async update(id: string, data: {
    name?: string;
    subject?: string;
    body?: string;
    channel?: string;
    mergeFields?: string[];
    isActive?: boolean;
  }) {
    const t = await prisma.notificationTemplate.findUnique({ where: { id } });
    if (!t) throw new NotFoundError('Template not found');
    return prisma.notificationTemplate.update({
      where: { id },
      data: {
        name: data.name,
        subject: data.subject,
        body: data.body,
        channel: data.channel as any,
        mergeFields: data.mergeFields,
        isActive: data.isActive,
      },
    });
  }

  static async delete(id: string) {
    const t = await prisma.notificationTemplate.findUnique({ where: { id } });
    if (!t) throw new NotFoundError('Template not found');
    await prisma.notificationTemplate.delete({ where: { id } });
  }

  // Apply merge fields and send a test email
  static async preview(id: string, sampleData: Record<string, string>, testEmail: string) {
    const t = await prisma.notificationTemplate.findUnique({ where: { id } });
    if (!t) throw new NotFoundError('Template not found');

    const rendered = applyMergeFields(t.body, sampleData);
    const subject = t.subject ? applyMergeFields(t.subject, sampleData) : 'Template Preview';

    await sendEmail(testEmail, `[PREVIEW] ${subject}`, rendered);
    return { subject, body: rendered };
  }

  // Send template to a specific user (used by other services)
  static async sendToUser(templateName: string, recipientEmail: string, mergeData: Record<string, string>) {
    const t = await prisma.notificationTemplate.findFirst({
      where: { name: templateName, isActive: true },
    });
    if (!t) return; // silently skip if template doesn't exist yet

    const rendered = applyMergeFields(t.body, mergeData);
    const subject = t.subject ? applyMergeFields(t.subject, mergeData) : templateName;

    await sendEmail(recipientEmail, subject, rendered);

    // Log it
    await prisma.notificationLog.create({
      data: {
        recipientEmail,
        subject,
        channel: 'EMAIL',
        status: 'SENT',
        sentAt: new Date(),
      },
    });
  }
}

export function applyMergeFields(template: string, data: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? `{{${key}}}`);
}
