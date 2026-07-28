import { EventStatus, EventType } from '@prisma/client';
import prisma from '../../lib/prisma';
import { NotFoundError } from '../../common/utils/apiError';

export class EventsService {
  static async generateEventCode() {
    const currentYear = new Date().getFullYear();
    const prefix = `EVT-${currentYear}`;
    const latest = await prisma.event.findFirst({
      where: { code: { startsWith: prefix } },
      orderBy: { code: 'desc' },
    });
    let next = 1;
    if (latest) {
      const parts = latest.code.split('-');
      const num = parseInt(parts[parts.length - 1]);
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
    const code = await this.generateEventCode();
    const { id, code: _c, createdBy, ...rest } = data;
    return await prisma.event.create({
      data: {
        ...rest,
        code,
        createdBy: userId,
        status: (data.status?.toUpperCase() as EventStatus) || 'DRAFT',
        type: data.type?.toUpperCase() as EventType,
      },
    });
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
