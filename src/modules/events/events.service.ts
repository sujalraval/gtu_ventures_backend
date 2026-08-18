import { EventStatus, EventType } from '@prisma/client';
import prisma from '../../lib/prisma';
import { NotFoundError } from '../../common/utils/apiError';

export class EventsService {
  /**
   * Raw SQL on purpose. The soft-delete middleware injects `deletedAt: null`
   * into every findFirst, so the Prisma version of this query skipped deleted
   * events — while the unique constraint on `code` still counts them. Deleting
   * an event then creating a new one reissued a code that was still taken.
   */
  static async generateEventCode() {
    const currentYear = new Date().getFullYear();
    const prefix = `EVT-${currentYear}`;
    const rows = await prisma.$queryRaw<{ code: string }[]>`
      SELECT "code" FROM "Event"
      WHERE "code" LIKE ${prefix + '%'}
      ORDER BY "code" DESC
      LIMIT 1
    `;
    let next = 1;
    if (rows.length && rows[0]?.code) {
      const num = parseInt(rows[0].code.split('-').pop() as string, 10);
      if (!isNaN(num)) next = num + 1;
    }
    return `${prefix}-${next.toString().padStart(3, '0')}`;
  }

  static async getAllEvents(filters: { type?: string; status?: string }) {
    const where: any = { deletedAt: null };
    if (filters.type) where.type = filters.type.toUpperCase();
    if (filters.status) where.status = filters.status.toUpperCase();

    return await prisma.event.findMany({
      where,
      include: {
        creator: { select: { id: true, name: true, email: true } },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  /**
   * Events the public website may list. Unauthenticated, so it returns only
   * announced, public events and only the columns a visitor should see —
   * never targetCohorts, createdBy or the creator relation.
   */
  static async getPublicEvents() {
    return await prisma.event.findMany({
      where: {
        deletedAt: null,
        isPublic: true,
        status: { in: ['PUBLISHED', 'ONGOING', 'COMPLETED'] },
      },
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        mode: true,
        description: true,
        venue: true,
        virtualLink: true,
        startDate: true,
        endDate: true,
        registrationDeadline: true,
        maxAttendees: true,
        coverImage: true,
        tags: true,
      },
      orderBy: { startDate: 'asc' },
    });
  }

  static async getDeletedEvents() {
    return await prisma.event.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
    });
  }

  static async getEventById(id: string) {
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true, email: true } },
      },
    });
    if (!event) throw new NotFoundError('Event not found');
    return event;
  }

  static async createEvent(data: any, userId: string) {
    const { id, code: _c, createdBy, ...rest } = data;

    // Two admins saving at the same moment would generate the same code, so
    // retry rather than showing one of them a unique-constraint error.
    for (let attempt = 0; ; attempt++) {
      try {
        return await prisma.event.create({
          data: {
            ...rest,
            code: await this.generateEventCode(),
            createdBy: userId,
            status: (data.status?.toUpperCase() as EventStatus) || 'DRAFT',
            type: data.type?.toUpperCase() as EventType,
          },
        });
      } catch (err: any) {
        const isCodeClash =
          err?.code === 'P2002' &&
          (err?.meta?.target as string[] | undefined)?.includes('code');
        if (!isCodeClash || attempt >= 4) throw err;
      }
    }
  }

  static async updateEvent(id: string, data: any) {
    await this.getEventById(id);
    const { id: _, code, createdBy, creator, ...rest } = data;
    return await prisma.event.update({
      where: { id },
      data: {
        ...rest,
        status: data.status ? (data.status.toUpperCase() as EventStatus) : undefined,
        type: data.type ? (data.type.toUpperCase() as EventType) : undefined,
      },
    });
  }

  static async deleteEvent(id: string) {
    await this.getEventById(id);
    return await prisma.event.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  static async restoreEvent(id: string) {
    return await prisma.event.update({
      where: { id },
      data: { deletedAt: null },
    });
  }

  static async updateStatus(id: string, status: string) {
    await this.getEventById(id);
    return await prisma.event.update({
      where: { id },
      data: { status: status.toUpperCase() as EventStatus },
    });
  }
}
