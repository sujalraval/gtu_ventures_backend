import crypto from 'crypto';
import prisma from '../../lib/prisma';
import { BadRequestError, NotFoundError } from '../../common/utils/apiError';
import { sendEmail } from '../../common/utils/mailer';
import { MandatesService } from './mandates.service';

/**
 * Panel invitations: invite, accept or decline, confirm the panel, then tell the
 * startups.
 *
 * The accept/decline link carries a random token and nothing else - an external
 * evaluator has no login, so the token is the whole of the authentication. Two
 * consequences shape the design:
 *
 *   - The emailed link opens a *page*, and the answer is sent by POST from that
 *     page. A GET that recorded the answer would be triggered by Outlook Safe
 *     Links and Gmail prefetching the URL, accepting on the evaluator's behalf
 *     before they had read the message.
 *   - The token is looked up on its own and reveals only what the invitation is
 *     about. It grants no other access.
 *
 * A panel is confirmed only once enough of the right people have accepted, which
 * is what then releases the notification to the startups.
 */

/** How long an invitation link stays usable. */
const TOKEN_DAYS = 30;

/**
 * 32 random bytes, url-safe.
 *
 * Long enough that guessing one is not a strategy, which matters because the
 * token is the only thing authenticating the response.
 */
const newToken = () => crypto.randomBytes(32).toString('base64url');

const evaluatorName = (e: any) =>
  [e?.firstName, e?.middleName, e?.lastName].filter(Boolean).join(' ').trim() || 'Evaluator';

const esc = (v: unknown) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

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

const panelContext = {
  id: true,
  name: true,
  requiredEvaluators: true,
  confirmedAt: true,
  mandateId: true,
  scheme: { select: { id: true, name: true, code: true } },
  pitchingSession: {
    select: {
      id: true,
      name: true,
      round: true,
      presentationDate: true,
      startTime: true,
      endTime: true,
      reportingTime: true,
      session: true,
      mode: true,
      venue: true,
      meetingLink: true,
      instructions: true,
    },
  },
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
          expertCategories: true,
        },
      },
    },
  },
  _count: { select: { allocations: true } },
} as const;

export class PanelInvitationsService {
  // ── Inviting ──────────────────────────────────────────────────────────────

  /**
   * Invite the panel's seated evaluators, or a named subset.
   *
   * One invitation row per evaluator per panel, reused on a resend so the token
   * stays stable and the attempt count stays on one row.
   */
  static async invite(
    panelId: string,
    input: { evaluatorIds?: string[]; contactPerson?: string | null } = {},
  ) {
    // Checked before anything is sent. An invitation exists to carry a link an
    // evaluator can click; without a base URL that link is a bare path, which is
    // dead in an email client, so the whole batch would go out unanswerable.
    // Better to refuse loudly than to deliver invitations nobody can accept.
    if (!(process.env.APP_URL || '').trim()) {
      throw new BadRequestError(
        'APP_URL is not configured on the server, so invitation links cannot be ' +
          'built. Set APP_URL to the site address (for example ' +
          'https://gusec.example.org) and send the invitations again.',
      );
    }

    const panel = await prisma.evaluationPanel.findUnique({
      where: { id: panelId },
      select: panelContext,
    });
    if (!panel) throw new NotFoundError('Panel not found');

    const wanted = new Set((input.evaluatorIds ?? []).filter(Boolean));
    const seats = (panel.members ?? []).filter(
      (m) => wanted.size === 0 || wanted.has(m.evaluator.id),
    );
    if (seats.length === 0) {
      throw new BadRequestError(
        'No evaluators to invite. Add members to the panel first.',
      );
    }

    let sent = 0;
    const failures: Array<{ evaluatorId: string; email?: string; error: string }> = [];

    for (const seat of seats) {
      const ev = seat.evaluator;
      const email = (ev.officialEmail || ev.personalEmail || '').trim().toLowerCase();
      if (!email) {
        failures.push({ evaluatorId: ev.id, error: 'No email address on the evaluator record' });
        continue;
      }

      const existing = await prisma.pitchInvitation.findFirst({
        where: { panelId, evaluatorId: ev.id },
        select: { id: true, token: true, status: true, resendCount: true },
      });

      // Kept across resends so a link already in an inbox keeps working.
      const token = existing?.token || newToken();
      const expires = new Date(Date.now() + TOKEN_DAYS * 86_400_000);

      const { subject, html } = this.renderInvite(panel, ev, token, input.contactPerson);

      let ok = false;
      let error: string | null = null;
      try {
        await sendEmail(email, subject, html);
        ok = true;
        sent++;
      } catch (e: any) {
        error = String(e?.message || 'Send failed');
        failures.push({ evaluatorId: ev.id, email, error });
      }

      // A previously accepted or declined invitation keeps that answer: resending
      // the details must not quietly reset someone's response.
      const keepsAnswer = existing?.status === 'ACCEPTED' || existing?.status === 'DECLINED';
      const status = keepsAnswer
        ? existing!.status
        : ok
          ? existing && existing.status !== 'PENDING'
            ? 'RESENT'
            : 'SENT'
          : 'FAILED';

      if (existing) {
        await prisma.pitchInvitation.update({
          where: { id: existing.id },
          data: {
            status: status as any,
            token,
            tokenExpiresAt: expires,
            sentAt: ok ? new Date() : undefined,
            resendCount:
              ok && existing.status !== 'PENDING' ? existing.resendCount + 1 : existing.resendCount,
            lastError: error,
            recipientName: evaluatorName(ev),
            recipientEmail: email,
            recipientType: seat.role === 'CHAIRPERSON' ? 'COMMITTEE_CHAIRPERSON' : 'PANEL_MEMBER',
          },
        });
      } else {
        await prisma.pitchInvitation.create({
          data: {
            panelId,
            evaluatorId: ev.id,
            recipientType: seat.role === 'CHAIRPERSON' ? 'COMMITTEE_CHAIRPERSON' : 'PANEL_MEMBER',
            recipientName: evaluatorName(ev),
            recipientEmail: email,
            token,
            tokenExpiresAt: expires,
            status: status as any,
            sentAt: ok ? new Date() : null,
            lastError: error,
          },
        });
      }
    }

    return { sentCount: sent, failedCount: failures.length, attempted: seats.length, failures };
  }

  private static renderInvite(panel: any, ev: any, token: string, contactPerson?: string | null) {
    const base = (process.env.APP_URL || '').replace(/\/$/, '');
    const link = `${base}/evaluator/invitation/${token}`;
    const s = panel.pitchingSession;

    const rows: Array<[string, string | null]> = [
      ['Scheme', panel.scheme ? `${panel.scheme.name} (${panel.scheme.code})` : null],
      ['Round', s?.round ?? null],
      ['Panel', panel.name],
      ['Date', s ? fmtDate(s.presentationDate) : 'To be confirmed'],
      ['Reporting Time', s ? fmtTime(s.reportingTime) : null],
      [
        'Session Time',
        s && fmtTime(s.startTime)
          ? `${fmtTime(s.startTime)}${fmtTime(s.endTime) ? ` – ${fmtTime(s.endTime)}` : ''}`
          : null,
      ],
      ['Session', s?.name ?? null],
      ['Mode', s?.mode ?? null],
      ['Venue', s?.venue ?? null],
      ['Meeting Link', s?.meetingLink ?? null],
      ['Startups to evaluate', panel._count?.allocations ? String(panel._count.allocations) : null],
      ['Contact Person', contactPerson ?? null],
    ];

    const body = rows
      .filter(([, v]) => !!v)
      .map(
        ([k, v]) =>
          `<tr><td style="padding:6px 12px;color:#64748b;white-space:nowrap">${esc(k)}</td>` +
          `<td style="padding:6px 12px;font-weight:600">${esc(v)}</td></tr>`,
      )
      .join('');

    const html = `
<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:620px;color:#0f172a">
  <p>Dear ${esc(evaluatorName(ev))},</p>
  <p>You are invited to join <strong>${esc(panel.name)}</strong> as an evaluator.</p>
  <table style="border-collapse:collapse;margin:16px 0;border:1px solid #e2e8f0;border-radius:6px">
    ${body}
  </table>
  ${
    s?.instructions
      ? `<p style="margin:12px 0"><strong>Instructions</strong><br>${esc(s.instructions).replace(/\n/g, '<br>')}</p>`
      : ''
  }
  <p style="margin:24px 0">
    <a href="${esc(link)}"
       style="background:#0f172a;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:600">
      Confirm or decline
    </a>
  </p>
  <p style="font-size:12px;color:#64748b">
    The link opens a page where you can accept or decline. It is personal to you,
    so please do not forward it. It stays valid for ${TOKEN_DAYS} days.
  </p>
</div>`.trim();

    const subject = `Evaluator invitation — ${panel.name}${
      s ? ` on ${fmtDate(s.presentationDate)}` : ''
    }`;
    return { subject, html };
  }

  // ── The public side: one token, read then answered ────────────────────────

  /**
   * What the invitation page shows.
   *
   * Only what the evaluator needs to decide. No application details and no
   * other evaluator's response, because the token is the only credential and a
   * leaked link should expose as little as possible.
   */
  static async describeByToken(token: string) {
    const invitation = await prisma.pitchInvitation.findUnique({
      where: { token },
      select: {
        id: true,
        status: true,
        sentAt: true,
        respondedAt: true,
        tokenExpiresAt: true,
        recipientName: true,
        responseNote: true,
        panel: { select: panelContext },
      },
    });
    if (!invitation || !invitation.panel) {
      throw new NotFoundError('This invitation link is not valid.');
    }

    const expired =
      !!invitation.tokenExpiresAt && invitation.tokenExpiresAt.getTime() < Date.now();
    const s = invitation.panel.pitchingSession;

    return {
      invitationId: invitation.id,
      recipientName: invitation.recipientName,
      status: invitation.status,
      respondedAt: invitation.respondedAt,
      responseNote: invitation.responseNote,
      expired,
      /** False once answered or expired, so the page knows to hide the buttons. */
      canRespond:
        !expired && invitation.status !== 'ACCEPTED' && invitation.status !== 'DECLINED',
      panel: {
        name: invitation.panel.name,
        scheme: invitation.panel.scheme,
        startupCount: invitation.panel._count?.allocations ?? 0,
      },
      session: s
        ? {
            name: s.name,
            round: s.round,
            presentationDate: s.presentationDate,
            startTime: s.startTime,
            endTime: s.endTime,
            reportingTime: s.reportingTime,
            mode: s.mode,
            venue: s.venue,
            meetingLink: s.meetingLink,
            instructions: s.instructions,
          }
        : null,
    };
  }

  /** Record the answer. Called by POST from the invitation page, never a GET. */
  static async respond(token: string, accept: boolean, note?: string | null) {
    const invitation = await prisma.pitchInvitation.findUnique({
      where: { token },
      select: {
        id: true,
        panelId: true,
        status: true,
        tokenExpiresAt: true,
      },
    });
    if (!invitation) throw new NotFoundError('This invitation link is not valid.');

    if (invitation.tokenExpiresAt && invitation.tokenExpiresAt.getTime() < Date.now()) {
      throw new BadRequestError(
        'This invitation link has expired. Please contact the incubation team.',
      );
    }
    if (invitation.status === 'ACCEPTED' || invitation.status === 'DECLINED') {
      throw new BadRequestError(
        `You have already ${invitation.status.toLowerCase()} this invitation.`,
      );
    }

    await prisma.pitchInvitation.update({
      where: { id: invitation.id },
      data: {
        status: accept ? 'ACCEPTED' : 'DECLINED',
        respondedAt: new Date(),
        responseNote: note?.trim() || null,
      },
    });

    // An acceptance may complete the panel, which is what releases the startup
    // notification. A decline may un-complete it, so both are re-evaluated.
    const confirmation = invitation.panelId
      ? await this.refreshConfirmation(invitation.panelId)
      : null;

    return { status: accept ? 'ACCEPTED' : 'DECLINED', confirmation };
  }

  // ── Confirmation and notification ─────────────────────────────────────────

  /**
   * Whether a panel now has what it needs, and the consequences of that.
   *
   * Required headcount comes from the panel if set, else the mandate's minimum.
   * Categories come from the mandate. Both are measured over accepted
   * evaluators only - a panel full of unanswered invitations is not a panel.
   */
  static async refreshConfirmation(panelId: string, opts: { notify?: boolean } = {}) {
    const panel = await prisma.evaluationPanel.findUnique({
      where: { id: panelId },
      select: {
        id: true,
        requiredEvaluators: true,
        confirmedAt: true,
        mandateId: true,
        members: { select: { evaluatorId: true } },
      },
    });
    if (!panel) throw new NotFoundError('Panel not found');

    const invitations = await prisma.pitchInvitation.findMany({
      where: { panelId, evaluatorId: { not: null } },
      select: { evaluatorId: true, status: true },
    });

    const accepted = invitations.filter((i) => i.status === 'ACCEPTED');
    const declined = invitations.filter((i) => i.status === 'DECLINED');
    const pending = invitations.filter(
      (i) => i.status !== 'ACCEPTED' && i.status !== 'DECLINED',
    );

    const compliance = await MandatesService.panelCompliance(panelId, { confirmedOnly: true });

    const requiredCount =
      panel.requiredEvaluators ?? compliance.minMembers ?? 0;
    const countMet = accepted.length >= requiredCount && requiredCount > 0;
    const categoriesMet = compliance.isCompliant;
    const isConfirmed = countMet && categoriesMet;

    // Recorded both ways: a withdrawn acceptance has to un-confirm the panel, or
    // the startups would have been told about a sitting that can no longer run.
    if (isConfirmed && !panel.confirmedAt) {
      await prisma.evaluationPanel.update({
        where: { id: panelId },
        data: { confirmedAt: new Date() },
      });
    } else if (!isConfirmed && panel.confirmedAt) {
      await prisma.evaluationPanel.update({
        where: { id: panelId },
        data: { confirmedAt: null },
      });
    }

    let notified = 0;
    if (isConfirmed && opts.notify !== false) {
      notified = (await this.notifyStartups(panelId)).notifiedCount;
    }

    return {
      panelId,
      requiredEvaluators: requiredCount,
      invitedCount: invitations.length,
      acceptedCount: accepted.length,
      declinedCount: declined.length,
      pendingCount: pending.length,
      /** How many more acceptances are needed on headcount alone. */
      shortfall: Math.max(0, requiredCount - accepted.length),
      seatedCount: panel.members.length,
      countMet,
      categoriesMet,
      categoryBlockers: compliance.blockers,
      isConfirmed,
      notifiedCount: notified,
    };
  }

  /**
   * Tell the startups in this panel's session that their pitch is on.
   *
   * Only once per booking: startupNotifiedAt is the guard, so a second
   * acceptance arriving after the panel is already confirmed does not send a
   * duplicate.
   */
  static async notifyStartups(panelId: string) {
    const panel = await prisma.evaluationPanel.findUnique({
      where: { id: panelId },
      select: {
        id: true,
        name: true,
        confirmedAt: true,
        sessionId: true,
        scheme: { select: { name: true, code: true } },
        pitchingSession: {
          select: {
            name: true,
            round: true,
            presentationDate: true,
            startTime: true,
            endTime: true,
            reportingTime: true,
            mode: true,
            venue: true,
            meetingLink: true,
            instructions: true,
          },
        },
      },
    });
    if (!panel) throw new NotFoundError('Panel not found');
    if (!panel.confirmedAt) {
      throw new BadRequestError(
        'This panel is not confirmed yet, so its startups should not be told to attend.',
      );
    }

    // Bookings in this panel's session that have not been told yet.
    const schedules = await prisma.pitchSchedule.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        status: { notIn: ['CANCELLED'] },
        startupNotifiedAt: null,
        application: { deletedAt: null },
        OR: [
          { panelId },
          ...(panel.sessionId ? [{ sessionId: panel.sessionId }] : []),
        ],
      },
      select: {
        id: true,
        startTime: true,
        endTime: true,
        application: {
          select: {
            id: true,
            applicationNo: true,
            startupName: true,
            fullName: true,
            primaryEmail: true,
            email: true,
          },
        },
      },
    });

    let notified = 0;
    const failures: Array<{ scheduleId: string; error: string }> = [];
    const s = panel.pitchingSession;

    for (const sc of schedules) {
      const app = sc.application;
      const to = (app?.primaryEmail || app?.email || '').trim();
      if (!to) {
        failures.push({ scheduleId: sc.id, error: 'No contact email on the application' });
        continue;
      }

      const rows: Array<[string, string | null]> = [
        ['Startup', app?.startupName ?? null],
        ['Application No', app?.applicationNo ?? null],
        ['Scheme', panel.scheme ? `${panel.scheme.name} (${panel.scheme.code})` : null],
        ['Round', s?.round ?? null],
        ['Date', s ? fmtDate(s.presentationDate) : null],
        ['Reporting Time', s ? fmtTime(s.reportingTime) : null],
        [
          'Your Slot',
          fmtTime(sc.startTime)
            ? `${fmtTime(sc.startTime)}${fmtTime(sc.endTime) ? ` – ${fmtTime(sc.endTime)}` : ''}`
            : null,
        ],
        ['Session', s?.name ?? null],
        ['Mode', s?.mode ?? null],
        ['Venue', s?.venue ?? null],
        ['Meeting Link', s?.meetingLink ?? null],
      ];

      const html = `
<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:620px;color:#0f172a">
  <p>Dear ${esc(app?.fullName || 'Founder')},</p>
  <p>
    Your pitch has been scheduled and the evaluation panel is confirmed. Please
    find the details below.
  </p>
  <table style="border-collapse:collapse;margin:16px 0;border:1px solid #e2e8f0;border-radius:6px">
    ${rows
      .filter(([, v]) => !!v)
      .map(
        ([k, v]) =>
          `<tr><td style="padding:6px 12px;color:#64748b;white-space:nowrap">${esc(k)}</td>` +
          `<td style="padding:6px 12px;font-weight:600">${esc(v)}</td></tr>`,
      )
      .join('')}
  </table>
  ${
    s?.instructions
      ? `<p style="margin:12px 0"><strong>Instructions</strong><br>${esc(s.instructions).replace(/\n/g, '<br>')}</p>`
      : ''
  }
  <p style="color:#64748b;font-size:12px;margin-top:20px">
    Please arrive by the reporting time. If you cannot attend, reply to this email
    as soon as possible.
  </p>
</div>`.trim();

      try {
        await sendEmail(
          to,
          `Your pitch is scheduled${s ? ` — ${fmtDate(s.presentationDate)}` : ''}`,
          html,
        );
        await prisma.pitchSchedule.update({
          where: { id: sc.id },
          data: { startupNotifiedAt: new Date() },
        });
        // Also in the application's own email history, so it is visible on the
        // screen an admin checks.
        await prisma.notificationLog.create({
          data: {
            relatedType: 'StartupApplication',
            relatedId: app!.id,
            recipientEmail: to,
            subject: 'Your pitch is scheduled',
            body: html,
            sendMode: 'MANUAL',
            channel: 'EMAIL',
            status: 'SENT',
            sentAt: new Date(),
          },
        });
        notified++;
      } catch (e: any) {
        failures.push({ scheduleId: sc.id, error: String(e?.message || 'Send failed') });
      }
    }

    return { notifiedCount: notified, failedCount: failures.length, failures };
  }

  /** Section 6's panel-wise response dashboard. */
  static async dashboard(params: { sessionId?: string; schemeId?: string }) {
    const panels = await prisma.evaluationPanel.findMany({
      where: {
        deletedAt: null,
        ...(params.sessionId?.trim() ? { sessionId: params.sessionId.trim() } : {}),
        ...(params.schemeId?.trim() ? { schemeId: params.schemeId.trim() } : {}),
      },
      select: {
        id: true,
        name: true,
        status: true,
        requiredEvaluators: true,
        confirmedAt: true,
        mandate: { select: { id: true, name: true, minMembers: true } },
        scheme: { select: { id: true, name: true, code: true } },
        pitchingSession: {
          select: { id: true, name: true, round: true, presentationDate: true },
        },
        members: { select: { evaluatorId: true } },
        invitations: {
          select: {
            id: true,
            evaluatorId: true,
            recipientName: true,
            recipientEmail: true,
            status: true,
            sentAt: true,
            respondedAt: true,
            responseNote: true,
            resendCount: true,
          },
        },
        _count: { select: { allocations: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    return {
      items: panels.map((p) => {
        const inv = p.invitations ?? [];
        const accepted = inv.filter((i) => i.status === 'ACCEPTED').length;
        const declined = inv.filter((i) => i.status === 'DECLINED').length;
        const pending = inv.length - accepted - declined;
        const required = p.requiredEvaluators ?? p.mandate?.minMembers ?? 0;
        return {
          ...p,
          requiredCount: required,
          seatedCount: p.members.length,
          invitedCount: inv.length,
          acceptedCount: accepted,
          declinedCount: declined,
          pendingCount: pending,
          shortfall: Math.max(0, required - accepted),
          /** Seated but never invited - easy to miss and stalls the panel. */
          uninvitedCount: Math.max(0, p.members.length - inv.length),
          isConfirmed: !!p.confirmedAt,
          applicationCount: p._count.allocations,
        };
      }),
      total: panels.length,
    };
  }
}

export default PanelInvitationsService;
