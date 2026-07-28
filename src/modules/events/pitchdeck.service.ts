import { PitchDeckStatus } from '@prisma/client';
import prisma from '../../lib/prisma';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../common/utils/apiError';
import fs from 'fs';
import path from 'path';

export class PitchDeckService {

  // ── Submit / Upload ────────────────────────────────────────────────────────

  static async submit(eventId: string, startupId: string, file: Express.Multer.File) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundError('Event not found');
    if (event.status === 'CANCELLED') throw new BadRequestError('Event has been cancelled');

    // Get next version number for this startup + event
    const latest = await prisma.pitchDeckSubmission.findFirst({
      where: { eventId, startupId },
      orderBy: { version: 'desc' },
    });
    const nextVersion = latest ? latest.version + 1 : 1;

    // Deactivate all previous versions
    if (latest) {
      await prisma.pitchDeckSubmission.updateMany({
        where: { eventId, startupId, isActive: true },
        data: { isActive: false },
      });
    }

    return prisma.pitchDeckSubmission.create({
      data: {
        eventId,
        startupId,
        version: nextVersion,
        fileName: file.originalname,
        filePath: file.filename,           // stored filename on disk
        fileSize: file.size,
        mimeType: file.mimetype,
        isActive: true,
        status: 'PENDING',
      },
      include: {
        startup: { select: { id: true, name: true, email: true } },
      },
    });
  }

  // ── Get all submissions for an event (admin) ───────────────────────────────

  static async getByEvent(eventId: string) {
    await this.assertEvent(eventId);
    return prisma.pitchDeckSubmission.findMany({
      where: { eventId },
      include: {
        startup: { select: { id: true, name: true, email: true } },
        reviewer: { select: { id: true, name: true } },
      },
      orderBy: [{ startupId: 'asc' }, { version: 'desc' }],
    });
  }

  // Active submissions only (one per startup) ─ for display/scheduling
  static async getActiveByEvent(eventId: string) {
    await this.assertEvent(eventId);
    return prisma.pitchDeckSubmission.findMany({
      where: { eventId, isActive: true },
      include: {
        startup: { select: { id: true, name: true, email: true } },
        reviewer: { select: { id: true, name: true } },
      },
      orderBy: { submittedAt: 'desc' },
    });
  }

  // Version history for a specific startup in an event
  static async getVersionHistory(eventId: string, startupId: string) {
    return prisma.pitchDeckSubmission.findMany({
      where: { eventId, startupId },
      include: {
        reviewer: { select: { id: true, name: true } },
      },
      orderBy: { version: 'desc' },
    });
  }

  // Startup's own submissions across all events
  static async getMySubmissions(startupId: string, eventId?: string) {
    return prisma.pitchDeckSubmission.findMany({
      where: { startupId, ...(eventId ? { eventId } : {}) },
      include: {
        event: { select: { id: true, title: true, type: true, startDate: true } },
        reviewer: { select: { id: true, name: true } },
      },
      orderBy: [{ eventId: 'asc' }, { version: 'desc' }],
    });
  }

  // ── Admin: review a submission ─────────────────────────────────────────────

  static async review(
    submissionId: string,
    adminId: string,
    status: PitchDeckStatus,
    notes?: string,
  ) {
    const sub = await prisma.pitchDeckSubmission.findUnique({ where: { id: submissionId } });
    if (!sub) throw new NotFoundError('Submission not found');

    return prisma.pitchDeckSubmission.update({
      where: { id: submissionId },
      data: {
        status,
        reviewerNotes: notes,
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
      include: {
        startup: { select: { id: true, name: true, email: true } },
      },
    });
  }

  // ── Restore a previous version as active ───────────────────────────────────

  static async setActiveVersion(submissionId: string, startupId: string) {
    const sub = await prisma.pitchDeckSubmission.findUnique({ where: { id: submissionId } });
    if (!sub) throw new NotFoundError('Submission not found');
    if (sub.startupId !== startupId) throw new ForbiddenError('Not your submission');

    await prisma.pitchDeckSubmission.updateMany({
      where: { eventId: sub.eventId, startupId, isActive: true },
      data: { isActive: false },
    });
    return prisma.pitchDeckSubmission.update({
      where: { id: submissionId },
      data: { isActive: true },
    });
  }

  // ── Delete a specific version ──────────────────────────────────────────────

  static async deleteVersion(submissionId: string, startupId: string) {
    const sub = await prisma.pitchDeckSubmission.findUnique({ where: { id: submissionId } });
    if (!sub) throw new NotFoundError('Submission not found');
    if (sub.startupId !== startupId) throw new ForbiddenError('Not your submission');
    if (sub.isActive) throw new BadRequestError('Cannot delete the active version. Upload a new version or restore another first.');

    // Delete file from disk
    try {
      const filePath = path.join(process.cwd(), 'uploads', sub.filePath);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (_) { /* ignore fs errors */ }

    return prisma.pitchDeckSubmission.delete({ where: { id: submissionId } });
  }

  // ── Stats for event ────────────────────────────────────────────────────────

  static async getStats(eventId: string) {
    const [total, pending, accepted, rejected, revisionRequested] = await Promise.all([
      prisma.pitchDeckSubmission.count({ where: { eventId, isActive: true } }),
      prisma.pitchDeckSubmission.count({ where: { eventId, isActive: true, status: 'PENDING' } }),
      prisma.pitchDeckSubmission.count({ where: { eventId, isActive: true, status: 'ACCEPTED' } }),
      prisma.pitchDeckSubmission.count({ where: { eventId, isActive: true, status: 'REJECTED' } }),
      prisma.pitchDeckSubmission.count({ where: { eventId, isActive: true, status: 'REVISION_REQUESTED' } }),
    ]);
    return { total, pending, accepted, rejected, revisionRequested };
  }

  private static async assertEvent(eventId: string) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundError('Event not found');
    return event;
  }
}
