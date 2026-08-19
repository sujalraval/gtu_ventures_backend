import { randomUUID, randomInt } from 'crypto';
import bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import { RegistrationStatus, InviteStatus } from '@prisma/client';
import prisma from '../../lib/prisma';
import { config } from '../../common/config/env';
import { sendEmail } from '../../common/utils/mailer';
import { NotFoundError, BadRequestError } from '../../common/utils/apiError';

const OTP_TTL_MS = 10 * 60 * 1000;   // code is valid for 10 minutes
const OTP_MAX_ATTEMPTS = 5;          // wrong guesses before the code is burned
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const VERIFY_TOKEN_TTL = '20m';      // long enough to finish a form, not to sit on
const VERIFY_SCOPE = 'EVENT_REGISTRATION';

export class RegistrationsService {

  // ── Email verification ───────────────────────────────────────────────────

  /**
   * Issues a one-time code to the address given. Returns nothing about whether
   * the address is already registered — this endpoint is public, so it must not
   * become a way to probe who has signed up.
   */
  static async requestEmailOtp(eventId: string, rawEmail: string) {
    const event = await this.assertEventExists(eventId);
    if (event.status === 'CANCELLED') {
      throw new BadRequestError('This event has been cancelled');
    }
    // The email quotes the event title, so a draft must not be able to send one.
    if (event.status === 'DRAFT') {
      throw new NotFoundError('Event not found');
    }
    if (event.registrationDeadline && new Date() > event.registrationDeadline) {
      throw new BadRequestError('Registration deadline has passed');
    }

    const email = String(rawEmail ?? '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestError('Please enter a valid email address');
    }

    // Per-address cooldown. The route limiter caps a single IP; this stops one
    // address being mail-bombed from many IPs.
    const recent = await prisma.eventEmailOtp.findFirst({
      where: { email, consumedAt: null, createdAt: { gt: new Date(Date.now() - OTP_RESEND_COOLDOWN_MS) } },
      orderBy: { createdAt: 'desc' },
    });
    if (recent) {
      throw new BadRequestError('A code was just sent. Please wait a minute before requesting another.');
    }

    // randomInt is drawn from the CSPRNG; Math.random is predictable enough to
    // guess a 6-digit code from a known seed.
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const codeHash = await bcrypt.hash(code, 10);

    // Any earlier unused code for this address stops working.
    await prisma.eventEmailOtp.updateMany({
      where: { email, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    const record = await prisma.eventEmailOtp.create({
      data: { email, codeHash, expiresAt: new Date(Date.now() + OTP_TTL_MS) },
    });

    const html = `
      <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 500px;">
        <h2 style="color: #2D3748;">Confirm your email</h2>
        <p>Use the code below to complete your registration for <b>${event.title}</b>. It expires in 10 minutes.</p>
        <div style="background: #edf2f7; padding: 15px; border-radius: 5px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #4A5568;">
          ${code}
        </div>
        <p style="margin-top: 20px; font-size: 12px; color: #718096;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `;
    try {
      await sendEmail(email, `Your verification code for ${event.title}`, html);
    } catch (err) {
      // The row is already written, and the cooldown above keys off it. Clear it
      // so a transient SMTP failure does not lock the visitor out for a minute
      // waiting on a code that was never sent.
      await prisma.eventEmailOtp.delete({ where: { id: record.id } }).catch(() => undefined);
      throw err;
    }

    return { message: 'Verification code sent' };
  }

  /**
   * Exchanges a correct code for a short-lived token. The token — not the email
   * field in the form — decides which address the registration is filed under.
   */
  static async verifyEmailOtp(eventId: string, rawEmail: string, code: string) {
    await this.assertEventExists(eventId);

    const email = String(rawEmail ?? '').trim().toLowerCase();
    const record = await prisma.eventEmailOtp.findFirst({
      where: { email, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) {
      throw new BadRequestError('That code has expired. Please request a new one.');
    }
    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      await prisma.eventEmailOtp.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      });
      throw new BadRequestError('Too many incorrect attempts. Please request a new code.');
    }

    const ok = await bcrypt.compare(String(code ?? '').trim(), record.codeHash);
    if (!ok) {
      await prisma.eventEmailOtp.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestError('Incorrect code. Please check and try again.');
    }

    await prisma.eventEmailOtp.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });

    const verificationToken = jwt.sign(
      { email, scope: VERIFY_SCOPE, eventId },
      config.JWT_SECRET,
      { expiresIn: VERIFY_TOKEN_TTL }
    );

    // Only returned once the code is correct — otherwise this endpoint would
    // hand a stranger someone else's name and phone number.
    const participant = await prisma.eventParticipant.findUnique({
      where: { email },
      select: {
        name: true,
        phone: true,
        organization: true,
        designation: true,
        customFields: true,
      },
    });

    // Already signed up for this event? Say so now, rather than after they have
    // filled the whole form again.
    const existing = await prisma.eventRegistration.findUnique({
      where: { eventId_email: { eventId, email } },
      select: { status: true, qrToken: true },
    });

    const founder = await this.lookupFounder(email);

    return {
      verificationToken,
      email,
      profile: participant,
      founder,
      alreadyRegistered: !!existing && existing.status !== 'CANCELLED',
      qrToken: existing && existing.status !== 'CANCELLED' ? existing.qrToken : null,
    };
  }

  /**
   * Confirmation with the QR ticket attached. The QR goes in as an inline
   * image *and* a real attachment, so it survives clients that block remote
   * or embedded images — and the token is printed as text underneath in case
   * both fail.
   *
   * Never allowed to fail a registration: the person has their place either
   * way, and can recover the ticket by verifying their email again.
   */
  private static async sendRegistrationEmail(registration: any, event: any) {
    try {
      const qr = await QRCode.toBuffer(registration.qrToken, { margin: 1, width: 320 });
      const when = event.startDate
        ? new Date(event.startDate).toLocaleString('en-IN', {
            day: '2-digit', month: 'long', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })
        : '';

      const row = (label: string, value?: string | null) =>
        value ? `<tr><td style="padding:4px 12px 4px 0;color:#718096;">${label}</td><td style="padding:4px 0;color:#2D3748;"><b>${value}</b></td></tr>` : '';

      const html = `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 560px;">
          <h2 style="color: #2D3748; margin-top:0;">You're registered</h2>
          <p>Hi ${registration.name}, your place at <b>${event.title}</b> is confirmed.</p>

          <table style="font-size:14px;border-collapse:collapse;margin:16px 0;">
            ${row('When', when)}
            ${row('Venue', event.venue)}
            ${row('Registered as', registration.email)}
          </table>

          <p style="margin-bottom:8px;">Show this QR code at the entrance for check-in:</p>
          <div style="text-align:center;padding:16px;background:#f7fafc;border-radius:8px;">
            <img src="cid:registration-qr" alt="Your QR code" width="220" height="220" style="display:block;margin:0 auto;" />
            <p style="font-family:monospace;font-size:11px;color:#718096;word-break:break-all;margin:12px 0 0;">
              ${registration.qrToken}
            </p>
          </div>

          <p style="font-size:12px;color:#718096;margin-top:20px;">
            Can't see the code? It's also attached to this email. Keep this message handy
            on the day — you'll need it to check in.
          </p>
          <p style="font-size:12px;color:#718096;">GTU Ventures, Gujarat Technological University</p>
        </div>
      `;

      await sendEmail(
        registration.email,
        `Registration confirmed — ${event.title}`,
        html,
        [{ filename: 'ticket-qr.png', content: qr, cid: 'registration-qr' }],
      );
    } catch (err) {
      console.error('Failed to send registration confirmation:', err);
    }
  }

  /**
   * A read across into the ERP, never a write. If the verified address belongs
   * to a startup account we surface their venture name so a founder does not
   * retype it — but nothing about the participant is written back, and no
   * foreign key is stored. Registering for an event never touches the ERP.
   */
  private static async lookupFounder(email: string) {
    try {
      const user = await prisma.user.findFirst({
        where: { email, role: 'STARTUP', deletedAt: null, isActive: true },
        select: {
          name: true,
          startupProfile: { select: { companyName: true, industry: true, stage: true } },
        },
      });
      const company = user?.startupProfile?.companyName?.trim();
      if (!company) return null;
      return {
        isFounder: true,
        founderName: user?.name || null,
        startupName: company,
        industry: user?.startupProfile?.industry || null,
        stage: user?.startupProfile?.stage || null,
      };
    } catch (err) {
      // A founder who is not recognised simply registers as a participant.
      console.error('Founder lookup failed:', err);
      return null;
    }
  }

  /** Returns the address proven by the token, or throws. */
  private static emailFromVerificationToken(eventId: string, token?: string) {
    if (!token) {
      throw new BadRequestError('Please verify your email address before registering.');
    }
    let payload: any;
    try {
      payload = jwt.verify(token, config.JWT_SECRET);
    } catch {
      throw new BadRequestError('Your verification has expired. Please verify your email again.');
    }
    // A token minted for one event must not register someone for another.
    if (payload?.scope !== VERIFY_SCOPE || payload?.eventId !== eventId || !payload?.email) {
      throw new BadRequestError('Your verification is not valid for this event.');
    }
    return String(payload.email).toLowerCase();
  }

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
    customFields?: Record<string, any>;
    verificationToken?: string;
  }, options: { requireVerifiedEmail?: boolean; enforceRequiredFields?: boolean } = {}) {
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

    // This endpoint is public and the controller hands us req.body untouched,
    // so take only these fields by name. Spreading the body would let a caller
    // set status, qrToken or checkedInAt — and a forged checkedInAt would earn
    // a participation certificate without attending.
    // Email is lower-cased so "Foo@x.com" and "foo@x.com" are one person, not
    // two registrations, two QR tickets and two certificates.
    // The verified address wins over whatever the form posted, so a caller
    // cannot verify their own inbox and then file the registration — and any
    // certificate that follows — under somebody else's address.
    const verifiedEmail = options.requireVerifiedEmail
      ? this.emailFromVerificationToken(eventId, data.verificationToken)
      : null;

    const core = {
      name: String(data.name ?? '').trim(),
      email: verifiedEmail ?? String(data.email ?? '').trim().toLowerCase(),
      phone: data.phone ? String(data.phone).trim() : null,
      organization: data.organization ? String(data.organization).trim() : null,
      designation: data.designation ? String(data.designation).trim() : null,
      notes: data.notes ? String(data.notes).trim() : null,
    };
    if (!core.name || !core.email) {
      throw new BadRequestError('Name and email are required');
    }
    // Staff adding a walk-in at the desk are not asked the event's extra
    // questions, so required ones must not block them. Public registrations
    // still enforce them.
    const customFields = this.validateCustomFields(
      event.registrationFields,
      data.customFields,
      options.enforceRequiredFields !== false,
    );

    // Re-derived here rather than taken from the request: a caller could
    // otherwise label themselves a founder of any startup they liked.
    const founder = await this.lookupFounder(core.email);
    const attribution = {
      participantType: founder ? 'FOUNDER' : 'PARTICIPANT',
      startupName: founder?.startupName ?? null,
    };

    // For invite-only events, check the invite list
    if (!event.isPublic) {
      const invite = await prisma.eventInvite.findUnique({
        where: { eventId_email: { eventId, email: core.email } },
      });
      if (!invite) {
        throw new BadRequestError('This event is invite-only. Your email is not on the invite list.');
      }
      // Mark invite as accepted
      await prisma.eventInvite.update({
        where: { eventId_email: { eventId, email: core.email } },
        data: { status: 'ACCEPTED' },
      });
    }

    // Prevent duplicate registration
    const existing = await prisma.eventRegistration.findUnique({
      where: { eventId_email: { eventId, email: core.email } },
    });
    if (existing) {
      if (existing.status === 'CANCELLED') {
        // Re-register: restore, issue a new QR token, and take the details
        // supplied this time — the earlier ones may well be out of date.
        const restored = await prisma.eventRegistration.update({
          where: { id: existing.id },
          data: {
            ...core,
            ...attribution,
            customFields,
            status: 'CONFIRMED',
            qrToken: randomUUID(),
            checkedInAt: null,
            checkedInBy: null,
          },
        });
        await this.rememberParticipant(core, customFields);
        await this.sendRegistrationEmail(restored, event);
        return restored;
      }
      throw new BadRequestError('You are already registered for this event');
    }

    const created = await prisma.eventRegistration.create({
      data: {
        eventId,
        ...core,
        ...attribution,
        customFields,
        qrToken: randomUUID(),
        isInvited: !event.isPublic,
        status: 'CONFIRMED',
      },
    });

    await this.rememberParticipant(core, customFields);
    await this.sendRegistrationEmail(created, event);
    return created;
  }

  /**
   * Keeps a single profile per person so a returning attendee does not retype
   * everything. Stored in EventParticipant, which has no relation to User —
   * attending an event never creates a portal account.
   */
  private static async rememberParticipant(
    core: { name: string; email: string; phone: string | null; organization: string | null; designation: string | null },
    customFields: Record<string, any>,
  ) {
    const profile = {
      name: core.name,
      phone: core.phone,
      organization: core.organization,
      designation: core.designation,
      lastSeenAt: new Date(),
    };
    try {
      const previous = await prisma.eventParticipant.findUnique({
        where: { email: core.email },
        select: { customFields: true },
      });
      // Merge rather than replace: a later event asking fewer questions must not
      // wipe answers captured by an earlier one.
      const merged = {
        ...(previous?.customFields && typeof previous.customFields === 'object' ? previous.customFields : {}),
        ...customFields,
      };
      await prisma.eventParticipant.upsert({
        where: { email: core.email },
        create: { email: core.email, ...profile, customFields: merged },
        update: { ...profile, customFields: merged },
      });
    } catch (err) {
      // Prefill is a convenience. Never fail a registration over it.
      console.error('Failed to record participant profile:', err);
    }
  }

  /**
   * Keeps only the keys the event actually declares, so a caller cannot post
   * arbitrary JSON into the row, and enforces the fields marked required.
   */
  private static validateCustomFields(
    definitions: any,
    submitted?: Record<string, any>,
    enforceRequired = true,
  ) {
    const fields = Array.isArray(definitions) ? definitions : [];
    if (!fields.length) return {};

    const answers: Record<string, any> = {};
    const missing: string[] = [];

    for (const field of fields) {
      if (!field?.key) continue;
      const raw = submitted?.[field.key];
      const value = typeof raw === 'string' ? raw.trim() : raw;
      const isBlank = value === undefined || value === null || value === '' || value === false;

      if (enforceRequired && field.required && isBlank) {
        missing.push(field.label || field.key);
        continue;
      }
      if (!isBlank) answers[field.key] = value;
    }

    if (missing.length) {
      throw new BadRequestError(`Please fill in: ${missing.join(', ')}`);
    }
    return answers;
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
