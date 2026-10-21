import prisma from '../../lib/prisma';
import { BadRequestError, NotFoundError } from '../../common/utils/apiError';
import { sendEmail } from '../../common/utils/mailer';

/**
 * Section 21: presentation invitations.
 *
 * Recipients are built from the schedule rather than typed in, so an
 * invitation cannot be sent to a founder who is not on the application or an
 * evaluator who is not on the panel.
 *
 * Every send is recorded twice, deliberately:
 *   - PitchInvitation is the per-recipient status section 21 asks for, and
 *     what Resend works from.
 *   - NotificationLog, against relatedType 'StartupApplication', is what the
 *     Communication module's email history reads. Without that row an
 *     invitation would be invisible on the screen an admin checks when asked
 *     "what have we sent this startup?".
 */

const fmtDate = (d?: Date | null) =>
  d
    ? new Date(d).toLocaleDateString('en-IN', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : 'To be confirmed';

const fmtTime = (d?: Date | null) =>
  d
    ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
    : null;

const esc = (v: unknown) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const evaluatorName = (e: any) =>
  [e?.firstName, e?.middleName, e?.lastName].filter(Boolean).join(' ').trim();

export type RecipientType =
  | 'FOUNDER'
  | 'CO_FOUNDER'
  | 'EVALUATOR'
  | 'PANEL_MEMBER'
  | 'COMMITTEE_CHAIRPERSON';

interface Recipient {
  type: RecipientType;
  name: string | null;
  email: string;
  evaluatorId?: string | null;
}

export class InvitationsService {
  /**
   * Who section 21 says to invite, as far as the data actually supports.
   *
   * Panel members are returned as PANEL_MEMBER with the chairperson flagged;
   * EVALUATOR and PANEL_MEMBER would otherwise be the same people listed
   * twice, and sending one person two copies is worse than a tidy category.
   */
  static async buildRecipients(scheduleId: string) {
    const schedule = await prisma.pitchSchedule.findUnique({
      where: { id: scheduleId },
      select: {
        id: true,
        panelId: true,
        schemeId: true,
        application: {
          select: {
            id: true,
            primaryEmail: true,
            email: true,
            fullName: true,
            startupName: true,
            // Co-founders live on Form B, which may not have been submitted.
            formB: {
              select: {
                founders: { select: { name: true, email: true, designation: true } },
              },
            },
          },
        },
        panel: {
          select: {
            id: true,
            name: true,
            members: {
              select: {
                role: true,
                evaluator: {
                  select: {
                    id: true,
                    firstName: true,
                    middleName: true,
                    lastName: true,
                    officialEmail: true,
                    personalEmail: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!schedule) throw new NotFoundError('Schedule not found');

    /**
     * Section 21 lists the committee chairperson separately from the panel's
     * own members, so the chair of a committee covering this scheme is
     * included too. Previously only the panel's chair was, which is a
     * different person.
     */
    const schemeId =
      (schedule as any).schemeId ??
      (schedule as any).scheme?.id ??
      null;
    const committeeChairs = await prisma.committeeMember.findMany({
      where: {
        role: 'CHAIRPERSON',
        leftAt: null,
        committee: {
          deletedAt: null,
          status: 'ACTIVE',
          ...(schemeId ? { OR: [{ schemeId }, { schemeId: null }] } : {}),
        },
      },
      select: {
        evaluator: {
          select: {
            id: true,
            firstName: true,
            middleName: true,
            lastName: true,
            officialEmail: true,
            personalEmail: true,
          },
        },
      },
    });

    const out: Recipient[] = [];
    const seen = new Set<string>();

    const push = (r: Recipient) => {
      const key = r.email.trim().toLowerCase();
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push({ ...r, email: key });
    };

    const app = schedule.application;
    const founderEmail = app?.primaryEmail || app?.email;
    if (founderEmail) {
      push({ type: 'FOUNDER', name: app?.fullName ?? null, email: founderEmail });
    }

    (app?.formB?.founders ?? []).forEach((f) => {
      if (f?.email) push({ type: 'CO_FOUNDER', name: f.name ?? null, email: f.email });
    });

    (schedule.panel?.members ?? []).forEach((m) => {
      const email = m.evaluator?.officialEmail || m.evaluator?.personalEmail;
      if (!email) return;
      push({
        type: m.role === 'CHAIRPERSON' ? 'COMMITTEE_CHAIRPERSON' : 'PANEL_MEMBER',
        name: evaluatorName(m.evaluator) || null,
        email,
        evaluatorId: m.evaluator?.id ?? null,
      });
    });

    // After the panel members, so a person who is both keeps the panel role
    // the dedupe already gave them rather than being listed twice.
    committeeChairs.forEach((c) => {
      const email = c.evaluator?.officialEmail || c.evaluator?.personalEmail;
      if (!email) return;
      push({
        type: 'COMMITTEE_CHAIRPERSON',
        name: evaluatorName(c.evaluator) || null,
        email,
        evaluatorId: c.evaluator?.id ?? null,
      });
    });

    return { scheduleId, recipients: out, panelName: schedule.panel?.name ?? null };
  }

  /** The invitation body. Everything section 21 lists, omitting what is unset. */
  private static renderEmail(schedule: any, recipient: Recipient, contactPerson?: string | null) {
    const scheme = schedule.scheme
      ? `${schedule.scheme.name} (${schedule.scheme.code})`
      : 'Scheme not yet assigned';

    const start = fmtTime(schedule.startTime);
    const end = fmtTime(schedule.endTime);
    const presentationTime = start ? (end ? `${start} – ${end}` : start) : 'To be confirmed';

    const forFounder = recipient.type === 'FOUNDER' || recipient.type === 'CO_FOUNDER';

    const rows: Array<[string, string | null]> = [
      ['Startup', schedule.application?.startupName ?? null],
      ['Application No', schedule.application?.applicationNo ?? null],
      ['Scheme', scheme],
      ['Date', fmtDate(schedule.presentationDate)],
      ['Reporting Time', fmtTime(schedule.reportingTime)],
      ['Presentation Time', presentationTime],
      ['Duration', schedule.durationMins ? `${schedule.durationMins} minutes` : null],
      ['Session', schedule.session ?? null],
      ['Mode', schedule.mode ?? null],
      ['Venue', schedule.venue ?? null],
      ['Meeting Link', schedule.meetingLink ?? null],
      ['Panel', schedule.panel?.name ?? null],
      ['Contact Person', contactPerson ?? null],
    ];

    const body = rows
      .filter(([, v]) => !!v)
      .map(
        ([k, v]) =>
          `<tr><td style="padding:6px 12px;color:#64748b;white-space:nowrap">${esc(
            k,
          )}</td><td style="padding:6px 12px;font-weight:600">${esc(v)}</td></tr>`,
      )
      .join('');

    const intro = forFounder
      ? `Your startup <strong>${esc(
          schedule.application?.startupName,
        )}</strong> has been scheduled to present. Please find the details below.`
      : `You are invited to evaluate the following presentation${
          schedule.panel?.name ? ` as part of ${esc(schedule.panel.name)}` : ''
        }.`;

    const subject = forFounder
      ? `Presentation scheduled — ${schedule.application?.startupName ?? 'your application'}`
      : `Evaluation invitation — ${schedule.application?.startupName ?? 'pitch'} on ${fmtDate(
          schedule.presentationDate,
        )}`;

    const html = `
<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:620px;color:#0f172a">
  <p>Dear ${esc(recipient.name || 'Sir/Madam')},</p>
  <p>${intro}</p>
  <table style="border-collapse:collapse;margin:16px 0;border:1px solid #e2e8f0;border-radius:6px">
    ${body}
  </table>
  ${
    schedule.instructions
      ? `<p style="margin:12px 0"><strong>Instructions</strong><br>${esc(
          schedule.instructions,
        ).replace(/\n/g, '<br>')}</p>`
      : ''
  }
  <p style="color:#64748b;font-size:12px;margin-top:20px">
    This is an automated invitation from the GUSEC Incubation ERP.
  </p>
</div>`.trim();

    return { subject, html };
  }

  /**
   * Send, or resend, to the chosen recipients.
   *
   * One PitchInvitation row per email address, reused on a resend so the
   * attempt count and the last error stay on one row rather than accumulating
   * a row per attempt.
   */
  static async send(
    scheduleId: string,
    input: {
      /** Emails to send to. Omitted means everyone buildRecipients found. */
      emails?: string[];
      recipientTypes?: RecipientType[];
      contactPerson?: string | null;
      /** True when this is a deliberate resend rather than a first send. */
      resend?: boolean;
    },
  ) {
    const schedule = await prisma.pitchSchedule.findUnique({
      where: { id: scheduleId },
      select: {
        id: true,
        presentationDate: true,
        startTime: true,
        endTime: true,
        durationMins: true,
        reportingTime: true,
        session: true,
        mode: true,
        venue: true,
        meetingLink: true,
        instructions: true,
        status: true,
        applicationId: true,
        scheme: { select: { id: true, name: true, code: true } },
        panel: { select: { id: true, name: true } },
        application: { select: { id: true, applicationNo: true, startupName: true } },
      },
    });
    if (!schedule) throw new NotFoundError('Schedule not found');
    if (schedule.status === 'CANCELLED') {
      throw new BadRequestError('This pitch is cancelled, so no invitation can be sent for it');
    }

    const { recipients } = await this.buildRecipients(scheduleId);

    const wantedEmails = (input.emails ?? []).map((e) => e.trim().toLowerCase()).filter(Boolean);
    const targets = recipients.filter((r) => {
      if (wantedEmails.length > 0) return wantedEmails.includes(r.email);
      if (input.recipientTypes?.length) return input.recipientTypes.includes(r.type);
      return true;
    });

    if (targets.length === 0) {
      throw new BadRequestError(
        'No recipients to send to. The application needs a contact email, or the panel needs members with email addresses.',
      );
    }

    let sent = 0;
    const failures: Array<{ email: string; error: string }> = [];

    for (const r of targets) {
      const { subject, html } = this.renderEmail(schedule, r, input.contactPerson);

      const existing = await prisma.pitchInvitation.findFirst({
        where: { scheduleId, recipientEmail: r.email },
        select: { id: true, resendCount: true, status: true },
      });

      let ok = false;
      let error: string | null = null;
      try {
        await sendEmail(r.email, subject, html);
        ok = true;
        sent++;
      } catch (e: any) {
        const message = String(e?.message || 'Send failed');
        error = message;
        failures.push({ email: r.email, error: message });
      }

      const status = ok ? (existing && existing.status !== 'PENDING' ? 'RESENT' : 'SENT') : 'FAILED';

      if (existing) {
        await prisma.pitchInvitation.update({
          where: { id: existing.id },
          data: {
            status: status as any,
            sentAt: ok ? new Date() : undefined,
            // Counts deliberate repeats, so a first send stays at zero.
            resendCount: ok && existing.status !== 'PENDING' ? existing.resendCount + 1 : existing.resendCount,
            lastError: error,
            recipientName: r.name,
            recipientType: r.type as any,
            evaluatorId: r.evaluatorId ?? null,
          },
        });
      } else {
        await prisma.pitchInvitation.create({
          data: {
            scheduleId,
            recipientType: r.type as any,
            recipientName: r.name,
            recipientEmail: r.email,
            evaluatorId: r.evaluatorId ?? null,
            status: status as any,
            sentAt: ok ? new Date() : null,
            lastError: error,
          },
        });
      }

      // The Communication module's history reads this, so an invitation shows
      // up alongside every other email about the application.
      await prisma.notificationLog.create({
        data: {
          relatedType: 'StartupApplication',
          relatedId: schedule.applicationId,
          recipientEmail: r.email,
          subject,
          body: html,
          sendMode: 'MANUAL',
          channel: 'EMAIL',
          status: ok ? 'SENT' : 'FAILED',
          errorMessage: error,
          sentAt: ok ? new Date() : null,
        },
      });
    }

    // Only a first successful send advances the pitch status; a resend of an
    // already-scheduled pitch should not move it backwards.
    if (sent > 0) {
      const state = await prisma.applicationPceState.findUnique({
        where: { applicationId: schedule.applicationId },
        select: { pitchStatus: true },
      });
      if (state?.pitchStatus === 'INVITATION_PENDING') {
        await prisma.applicationPceState.update({
          where: { applicationId: schedule.applicationId },
          data: { pitchStatus: 'INVITATION_SENT' },
        });
      }
    }

    return {
      sentCount: sent,
      failedCount: failures.length,
      attempted: targets.length,
      failures,
    };
  }

  /** Section 21: invitation status for a schedule. */
  static async status(scheduleId: string) {
    const rows = await prisma.pitchInvitation.findMany({
      where: { scheduleId },
      orderBy: [{ recipientType: 'asc' }, { createdAt: 'asc' }],
    });
    return {
      items: rows,
      total: rows.length,
      sentCount: rows.filter((r) => r.status === 'SENT' || r.status === 'RESENT').length,
      failedCount: rows.filter((r) => r.status === 'FAILED').length,
    };
  }
}

export default InvitationsService;
