import prisma from '../../lib/prisma';

export class NotificationLogService {

  static async getAll(filters: { status?: string; channel?: string; page?: number; limit?: number }) {
    const { status, channel, page = 1, limit = 50 } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (channel) where.channel = channel;

    const [items, total] = await Promise.all([
      prisma.notificationLog.findMany({
        where,
        include: {
          recipient: { select: { id: true, name: true } },
          announcement: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notificationLog.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  static async getStats() {
    const [total, sent, failed, read] = await Promise.all([
      prisma.notificationLog.count(),
      prisma.notificationLog.count({ where: { status: { in: ['SENT', 'DELIVERED'] } } }),
      prisma.notificationLog.count({ where: { status: 'FAILED' } }),
      prisma.notificationLog.count({ where: { status: 'READ' } }),
    ]);
    return { total, sent, failed, read, deliveryRate: total > 0 ? Math.round((sent / total) * 100) : 0 };
  }
}
