import prisma from '../../lib/prisma';
import { NotFoundError, BadRequestError } from '../../common/utils/apiError';
import { sendEmail } from '../../common/utils/mailer';

export class ScheduleService {

  // ── Get schedule for an event ─────────────────────────────────────────────

  static async getSchedule(eventId: string) {
    await this.assertEvent(eventId);
    return prisma.eventScheduleSlot.findMany({
      where: { eventId },
      include: {
        startup: { select: { id: true, name: true, email: true } },
        pitchDeck: { select: { id: true, fileName: true, version: true } },
      },
      orderBy: { position: 'asc' },
    });
  }

  // ── Add a startup to the schedule ─────────────────────────────────────────

  static async addSlot(eventId: string, data: {
    startupId: string;
    pitchDeckId?: string;
    durationMins?: number;
    bufferMins?: number;
    scheduledTime?: string;
    notes?: string;
  }) {
    await this.assertEvent(eventId);

    // Check startup not already in schedule
    const existing = await prisma.eventScheduleSlot.findUnique({
      where: { eventId_startupId: { eventId, startupId: data.startupId } },
    });
    if (existing) throw new BadRequestError('This startup is already in the schedule');

    // Get next position
    const last = await prisma.eventScheduleSlot.findFirst({
      where: { eventId },
      orderBy: { position: 'desc' },
    });
    const position = last ? last.position + 1 : 1;

    return prisma.eventScheduleSlot.create({
      data: {
        eventId,
        startupId: data.startupId,
        pitchDeckId: data.pitchDeckId || null,
        position,
        durationMins: data.durationMins ?? 10,
        bufferMins: data.bufferMins ?? 5,
        scheduledTime: data.scheduledTime ? new Date(data.scheduledTime) : null,
        notes: data.notes,
      },
      include: {
        startup: { select: { id: true, name: true, email: true } },
        pitchDeck: { select: { id: true, fileName: true, version: true } },
      },
    });
  }

  // ── Update a slot (time, duration, notes) ─────────────────────────────────

  static async updateSlot(slotId: string, data: {
    durationMins?: number;
    bufferMins?: number;
    scheduledTime?: string | null;
    notes?: string;
    pitchDeckId?: string | null;
  }) {
    const slot = await prisma.eventScheduleSlot.findUnique({ where: { id: slotId } });
    if (!slot) throw new NotFoundError('Slot not found');

    return prisma.eventScheduleSlot.update({
      where: { id: slotId },
      data: {
        durationMins: data.durationMins,
        bufferMins: data.bufferMins,
        scheduledTime: data.scheduledTime !== undefined
          ? (data.scheduledTime ? new Date(data.scheduledTime) : null)
          : undefined,
        notes: data.notes,
        pitchDeckId: data.pitchDeckId !== undefined ? data.pitchDeckId : undefined,
      },
      include: {
        startup: { select: { id: true, name: true, email: true } },
        pitchDeck: { select: { id: true, fileName: true, version: true } },
      },
    });
  }

  // ── Bulk reorder (drag-and-drop saves entire order) ───────────────────────
  // slotIds: array of slot IDs in the NEW desired order

  static async reorder(eventId: string, slotIds: string[]) {
    await this.assertEvent(eventId);

    // Verify all belong to this event
    const existing = await prisma.eventScheduleSlot.findMany({ where: { eventId } });
    const existingIds = new Set(existing.map(s => s.id));
    if (slotIds.some(id => !existingIds.has(id))) {
      throw new BadRequestError('One or more slot IDs do not belong to this event');
    }

    // Update positions in a transaction
    await prisma.$transaction(
      slotIds.map((id, index) =>
        prisma.eventScheduleSlot.update({
          where: { id },
          data: { position: index + 1 },
        })
      )
    );

    return this.getSchedule(eventId);
  }

  // ── Remove a startup from the schedule ────────────────────────────────────

  static async removeSlot(slotId: string) {
    const slot = await prisma.eventScheduleSlot.findUnique({ where: { id: slotId } });
    if (!slot) throw new NotFoundError('Slot not found');

    await prisma.eventScheduleSlot.delete({ where: { id: slotId } });

    // Re-number remaining slots
    const remaining = await prisma.eventScheduleSlot.findMany({
      where: { eventId: slot.eventId },
      orderBy: { position: 'asc' },
    });
    await prisma.$transaction(
      remaining.map((s, i) =>
        prisma.eventScheduleSlot.update({ where: { id: s.id }, data: { position: i + 1 } })
      )
    );
  }

  // ── Auto-distribute times from event start ───────────────────────────────

  static async autoSchedule(eventId: string) {
    const event = await this.assertEvent(eventId);
    const slots = await prisma.eventScheduleSlot.findMany({
      where: { eventId },
      orderBy: { position: 'asc' },
    });
    if (slots.length === 0) throw new BadRequestError('No slots in schedule');

    let cursor = new Date(event.startDate);
    const updates = slots.map(slot => {
      const scheduledTime = new Date(cursor);
      cursor = new Date(cursor.getTime() + (slot.durationMins + slot.bufferMins) * 60 * 1000);
      return prisma.eventScheduleSlot.update({
        where: { id: slot.id },
        data: { scheduledTime },
      });
    });

    await prisma.$transaction(updates);
    return this.getSchedule(eventId);
  }

  // ── Send schedule emails ──────────────────────────────────────────────────

  static async sendScheduleEmails(eventId: string) {
    const event = await this.assertEvent(eventId);
    const slots = await prisma.eventScheduleSlot.findMany({
      where: { eventId },
      include: { startup: { select: { id: true, name: true, email: true } } },
      orderBy: { position: 'asc' },
    });

    if (slots.length === 0) throw new BadRequestError('No startups in schedule');

    const results: { email: string; status: 'sent' | 'failed'; error?: string }[] = [];

    for (const slot of slots) {
      const timeStr = slot.scheduledTime
        ? new Date(slot.scheduledTime).toLocaleString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : 'To be announced';

      const html = buildScheduleEmail({
        startupName: slot.startup.name || 'Team',
        eventTitle: event.title,
        eventDate: new Date(event.startDate).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }),
        venue: event.venue || event.virtualLink || 'TBD',
        position: slot.position,
        totalSlots: slots.length,
        scheduledTime: timeStr,
        duration: slot.durationMins,
        buffer: slot.bufferMins,
        notes: slot.notes,
      });

      try {
        await sendEmail(
          slot.startup.email,
          `Your Presentation Schedule — ${event.title}`,
          html,
        );
        await prisma.eventScheduleSlot.update({
          where: { id: slot.id },
          data: { emailSentAt: new Date() },
        });
        results.push({ email: slot.startup.email, status: 'sent' });
      } catch (err: any) {
        results.push({ email: slot.startup.email, status: 'failed', error: err?.message });
      }
    }

    return results;
  }

  // ── Startups eligible to be scheduled (accepted pitch decks) ─────────────

  static async getEligibleStartups(eventId: string) {
    await this.assertEvent(eventId);

    // Already scheduled
    const scheduled = await prisma.eventScheduleSlot.findMany({
      where: { eventId },
      select: { startupId: true },
    });
    const scheduledIds = new Set(scheduled.map(s => s.startupId));

    // Startups with accepted pitch decks for this event
    const accepted = await prisma.pitchDeckSubmission.findMany({
      where: { eventId, isActive: true, status: 'ACCEPTED' },
      include: { startup: { select: { id: true, name: true, email: true } } },
    });

    // Also include all registered startups even without accepted deck
    const registered = await prisma.eventRegistration.findMany({
      where: { eventId, status: { not: 'CANCELLED' } },
      include: { event: false },
    });

    // Merge: prefer pitch-deck startups, supplement with registrations if startup role
    const eligible = accepted.map(d => ({
      id: d.startup.id,
      name: d.startup.name,
      email: d.startup.email,
      pitchDeckId: d.id,
      alreadyScheduled: scheduledIds.has(d.startup.id),
    }));

    return eligible;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private static async assertEvent(eventId: string) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundError('Event not found');
    return event;
  }
}

// ── Email template ────────────────────────────────────────────────────────────

function buildScheduleEmail(data: {
  startupName: string;
  eventTitle: string;
  eventDate: string;
  venue: string;
  position: number;
  totalSlots: number;
  scheduledTime: string;
  duration: number;
  buffer: number;
  notes?: string | null;
}): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; background: #f4f6f8; margin: 0; padding: 20px;">
  <div style="max-width: 580px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

    <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); padding: 32px 32px 24px; color: white;">
      <p style="margin: 0 0 4px; font-size: 13px; opacity: 0.8; text-transform: uppercase; letter-spacing: 1px;">Presentation Schedule</p>
      <h1 style="margin: 0; font-size: 22px;">${data.eventTitle}</h1>
      <p style="margin: 8px 0 0; font-size: 14px; opacity: 0.85;">${data.eventDate}</p>
    </div>

    <div style="padding: 28px 32px;">
      <p style="color: #374151; margin: 0 0 20px;">Dear <strong>${data.startupName}</strong>,</p>
      <p style="color: #6b7280; margin: 0 0 24px; line-height: 1.6;">
        You have been scheduled to present at <strong>${data.eventTitle}</strong>. Here are your presentation details:
      </p>

      <div style="background: #f0f7ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 20px 24px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 13px; width: 45%;">Presentation Slot</td>
            <td style="padding: 8px 0; color: #1e3a5f; font-weight: bold; font-size: 18px;">#${data.position} of ${data.totalSlots}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Scheduled Time</td>
            <td style="padding: 8px 0; color: #111827; font-weight: 600;">${data.scheduledTime}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Duration</td>
            <td style="padding: 8px 0; color: #111827;">${data.duration} min presentation + ${data.buffer} min Q&A</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6b7280; font-size: 13px;">Venue / Link</td>
            <td style="padding: 8px 0; color: #111827;">${data.venue}</td>
          </tr>
        </table>
      </div>

      ${data.notes ? `
      <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 14px 18px; margin-bottom: 24px;">
        <p style="margin: 0; color: #92400e; font-size: 13px;"><strong>Note from organiser:</strong><br>${data.notes}</p>
      </div>` : ''}

      <div style="background: #f9fafb; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
        <p style="margin: 0 0 8px; font-weight: 600; color: #374151; font-size: 13px;">Tips for a great presentation:</p>
        <ul style="margin: 0; padding-left: 18px; color: #6b7280; font-size: 13px; line-height: 1.8;">
          <li>Arrive 15 minutes before the event starts</li>
          <li>Test your slides and AV setup beforehand</li>
          <li>Stick to your allocated time — judges will signal at ${data.duration - 1} minutes</li>
          <li>Keep Q&A answers concise and focused</li>
        </ul>
      </div>

      <p style="color: #6b7280; font-size: 13px; line-height: 1.6;">
        For any questions, please reach out to the event organiser. We look forward to your presentation!
      </p>
    </div>

    <div style="background: #f9fafb; padding: 20px 32px; border-top: 1px solid #e5e7eb; text-align: center;">
      <p style="margin: 0; color: #9ca3af; font-size: 12px;">This is an automated message. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>`;
}
