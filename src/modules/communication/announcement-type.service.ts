import prisma from '../../lib/prisma';
import { BadRequestError, NotFoundError } from '../../common/utils/apiError';

export class AnnouncementTypeService {
  static async getAll() {
    return prisma.announcementType.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  static async create(data: { value: string; label: string; description?: string; color?: string; sortOrder?: number }) {
    const value = data.value.toUpperCase().replace(/\s+/g, '_');
    const existing = await prisma.announcementType.findUnique({ where: { value } });
    if (existing) throw new BadRequestError(`Type "${value}" already exists`);
    return prisma.announcementType.create({
      data: {
        value,
        label: data.label,
        description: data.description ?? '',
        color: data.color ?? 'gray',
        sortOrder: data.sortOrder ?? 99,
      },
    });
  }

  static async update(id: string, data: { label?: string; description?: string; color?: string; sortOrder?: number }) {
    const existing = await prisma.announcementType.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Announcement type not found');
    return prisma.announcementType.update({ where: { id }, data });
  }

  static async delete(id: string) {
    const existing = await prisma.announcementType.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Announcement type not found');
    // Check if any announcements use this type
    const inUse = await prisma.eventAnnouncement.count({ where: { type: existing.value, deletedAt: null } });
    if (inUse > 0) throw new BadRequestError(`Cannot delete "${existing.label}" — ${inUse} active announcement(s) use this type`);
    return prisma.announcementType.delete({ where: { id } });
  }
}
