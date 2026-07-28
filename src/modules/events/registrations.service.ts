import { randomUUID } from 'crypto';
import { RegistrationStatus, InviteStatus } from '@prisma/client';
import prisma from '../../lib/prisma';
import { NotFoundError, BadRequestError } from '../../common/utils/apiError';

export class RegistrationsService {

  // ── Registrations ────────────────────────────────────────────────────────

  static async getRegistrations(eventId: string) {
    await this.assertEventExists(eventId);
    return prisma.eventRegistration.findMany({
      where: { eventId },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async register(eventId: string, data: {
    name: string;
    email: string;
    phone?: string;
    organization?: string;
    designation?: string;
    notes?: string;
  }) {
    const event = await this.assertEventExists(eventId);

    if (event.status === 'CANCELLED') {
      throw new BadRequestError('This event has been cancelled');
    }
    if (event.registrationDeadline && new Date() > event.registrationDeadline) {
      throw new BadRequestError('Registration deadline has passed');
    }

    // Check capacity
    if (event.maxAttendees) {
      const count = await prisma.eventRegistration.count({
        where: { eventId, status: { not: 'CANCELLED' } },
      });
      if (count >= event.maxAttendees) {
        throw new BadRequestError('Event is at full capacity');
      }
    }

    // For invite-only events, check the invite list
    if (!event.isPublic) {
      const invite = await prisma.eventInvite.findUnique({
        where: { eventId_email: { eventId, email: data.email } },
      });
      if (!invite) {
        throw new BadRequestError('This event is invite-only. Your email is not on the invite list.');
      }
      // Mark invite as accepted
      await prisma.eventInvite.update({
        where: { eventId_email: { eventId, email: data.email } },
        data: { status: 'ACCEPTED' },
      });
    }

    // Prevent duplicate registration
    const existing = await prisma.eventRegistration.findUnique({
      where: { eventId_email: { eventId, email: data.email } },
    });
    if (existing) {
      if (existing.status === 'CANCELLED') {
        // Re-register: restore and issue new QR token
        return prisma.eventRegistration.update({
          where: { id: existing.id },
          data: { status: 'CONFIRMED', qrToken: randomUUID(), checkedInAt: null, checkedInBy: null },
        });
      }
      throw new BadRequestError('You are already registered for this event');
    }

    return prisma.eventRegistration.create({
      data: {
        eventId,
        ...data,
        qrToken: randomUUID(),
        isInvited: !event.isPublic,
        status: 'CONFIRMED',
      },
    });
  }

  static async cancelRegistration(eventId: string, registrationId: string) {
    const reg = await prisma.eventRegistration.findFirst({
      where: { id: registrationId, eventId },
    });
    if (!reg) throw new NotFoundError('Registration not found');
    return prisma.eventRegistration.update({
      where: { id: registrationId },
      data: { status: 'CANCELLED' },
    });
  }

  // ── QR Check-in ──────────────────────────────────────────────────────────

  static async checkInByQr(qrToken: string, adminId: string) {
    const reg = await prisma.eventRegistration.findUnique({
      where: { qrToken },
      include: { event: { select: { title: true, status: true } } },
    });
    if (!reg) throw new NotFoundError('Invalid QR code — registration not found');
    if (reg.status === 'CHECKED_IN') {
      return { alreadyCheckedIn: true, registration: reg };
    }
    if (reg.status === 'CANCELLED') {
      throw new BadRequestError('This registration has been cancelled');
    }
    const updated = await prisma.eventRegistration.update({
      where: { qrToken },
      data: { status: 'CHECKED_IN', checkedInAt: new Date(), checkedInBy: adminId },
      include: { event: { select: { title: true } } },
    });
    return { alreadyCheckedIn: false, registration: updated };
  }

  static async checkInManual(registrationId: string, adminId: string) {
    const reg = await prisma.eventRegistration.findUnique({ where: { id: registrationId } });
    if (!reg) throw new NotFoundError('Registration not found');
    if (reg.status === 'CHECKED_IN') return { alreadyCheckedIn: true, registration: reg };
    return {
      alreadyCheckedIn: false,
      registration: await prisma.eventRegistration.update({
        where: { id: registrationId },
        data: { status: 'CHECKED_IN', checkedInAt: new Date(), checkedInBy: adminId },
      }),
    };
  }

  // ── Invites (invite-only events) ─────────────────────────────────────────

  static async getInvites(eventId: string) {
    await this.assertEventExists(eventId);
    return prisma.eventInvite.findMany({
      where: { eventId },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async addInvites(eventId: string, invites: { email: string; name?: string }[]) {
    const event = await this.assertEventExists(eventId);
    if (event.isPublic) throw new BadRequestError('Invites are only for invite-only events');

    const results = await Promise.allSettled(
      invites.map(inv =>
        prisma.eventInvite.upsert({
          where: { eventId_email: { eventId, email: inv.email } },
          update: { name: inv.name, status: 'PENDING' },
          create: { eventId, email: inv.email, name: inv.name, status: 'PENDING' },
        })
      )
    );
    const created = results.filter(r => r.status === 'fulfilled').length;
    return { created, total: invites.length };
  }

  static async removeInvite(eventId: string, inviteId: string) {
    const invite = await prisma.eventInvite.findFirst({ where: { id: inviteId, eventId } });
    if (!invite) throw new NotFoundError('Invite not found');
    return prisma.eventInvite.delete({ where: { id: inviteId } });
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  static async getStats(eventId: string) {
    await this.assertEventExists(eventId);
    const [total, confirmed, checkedIn, cancelled] = await Promise.all([
      prisma.eventRegistration.count({ where: { eventId } }),
      prisma.eventRegistration.count({ where: { eventId, status: 'CONFIRMED' } }),
      prisma.eventRegistration.count({ where: { eventId, status: 'CHECKED_IN' } }),
      prisma.eventRegistration.count({ where: { eventId, status: 'CANCELLED' } }),
    ]);
    return { total, confirmed, checkedIn, cancelled, noShow: confirmed - checkedIn };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private static async assertEventExists(eventId: string) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundError('Event not found');
    return event;
  }
}
