import { Prisma, ApplicationStatus } from '@prisma/client';
import prisma from '../../lib/prisma';
import { BadRequestError, NotFoundError } from '../../common/utils/apiError';
import { sendEmail } from '../../common/utils/mailer';
import { config } from '../../common/config/env';

/**
 * Screening rounds.
 *
 * Scoring is deliberately not reimplemented here. An event already has a
 * weighted rubric (ScorecardCriteria), per-judge scores (StartupScore), a panel
 * (JudgeAssignment) and a leaderboard. A judge's running order comes from
 * EventScheduleSlot, so adding a candidate creates a slot too and the whole
 * judging stack works untouched.
 *
 * What lives here is what screening adds: pulling in applications that are
 * waiting, tracking who is presenting, and recording the panel's decision.
 */

const candidateInclude = {
  application: {
    select: {
      id: true,
      applicationNo: true,
      startupName: true,
      fullName: true,
      email: true,
      mobile: true,
      mainSector: true,
      stage: true,
      briefAbout: true,
      pitchDeck: true,
      userId: true,
      status: true,
    },
  },
  scheme: { select: { id: true, name: true, code: true } },
  cohort: { select: { id: true, name: true, schemeId: true } },
  decidedBy: { select: { id: true, name: true, email: true } },
};

async function assertScreeningEvent(eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new NotFoundError('Event not found');
  if (event.type !== 'SCREENING') {
    throw new BadRequestError('That event is not a screening round.');
  }
  return event;
}

export class ScreeningService {
  /**
   * Applications waiting to be screened: Form A submitted, not yet approved,
   * and not already queued in some other screening round.
   */
  static async getAwaitingScreening() {
    const alreadyQueued = await prisma.screeningCandidate.findMany({
      select: { applicationId: true },
    });
    const queuedIds = alreadyQueued.map((c) => c.applicationId);

    return prisma.startupApplication.findMany({
      where: {
        isFormASubmitted: true,
        isFormAApproved: false,
        status: { notIn: [ApplicationStatus.DRAFT, ApplicationStatus.REJECTED] },
        ...(queuedIds.length ? { id: { notIn: queuedIds } } : {}),
      },
      select: candidateInclude.application.select,
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Panel for a round, with guest judges flagged.
   */
  static async listJudges(eventId: string) {
    await assertScreeningEvent(eventId);
    return prisma.judgeAssignment.findMany({
      where: { eventId },
      include: { judge: { select: { id: true, name: true, email: true, role: true, lastLogin: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Invite a judge to a round.
   *
   * Handles the common case that the judge does not work at GTU: an investor,
   * a founder, an industry expert. They get an EXPERT account, which grants
   * nothing beyond judging, and sign in with an email OTP — no password to
   * issue, nothing to revoke afterwards beyond removing the assignment.
   *
   * An existing user (a mentor, a staff member) is reused rather than
   * duplicated; their role is never downgraded.
   */
  static async inviteJudge(
    eventId: string,
    input: { name?: string; email: string; organisation?: string; designation?: string },
  ) {
    const event = await assertScreeningEvent(eventId);

    const email = (input.email || '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      throw new BadRequestError('Enter a valid email address for the judge.');
    }

    let user = await prisma.user.findFirst({ where: { email } });
    let isExternal = false;

    if (!user) {
      user = await prisma.user.create({
        data: { email, name: input.name?.trim() || email.split('@')[0], role: 'EXPERT' },
      });
      isExternal = true;
    } else {
      // Anyone who is not GTU staff is a guest on this panel.
      isExternal = !['SUPER_ADMIN', 'ADMIN', 'STAFF'].includes(user.role);
      if (input.name && !user.name) {
        await prisma.user.update({ where: { id: user.id }, data: { name: input.name.trim() } });
      }
    }

    const existing = await prisma.judgeAssignment.findFirst({
      where: { eventId, judgeId: user.id, startupId: null },
    });
    if (existing) {
      throw new BadRequestError('That judge is already on this panel.');
    }

    const assignment = await prisma.judgeAssignment.create({
      data: {
        eventId,
        judgeId: user.id,
        startupId: null, // scores every candidate in the round
        isExternal,
        organisation: input.organisation?.trim() || null,
        designation: input.designation?.trim() || null,
        invitedAt: new Date(),
      },
      include: { judge: { select: { id: true, name: true, email: true, role: true } } },
    });

    // Best-effort: a failed invite email must not undo the assignment, or the
    // admin is left with a judge who exists but cannot be re-invited.
    try {
      await sendEmail(
        email,
        `You are invited to judge: ${event.title}`,
        buildJudgeInvite({
          judgeName: assignment.judge.name || 'there',
          eventTitle: event.title,
          venue: event.venue,
          startDate: event.startDate,
          link: `${(config.APP_URL || '').replace(/\/$/, '')}/events/${eventId}/judge`,
        }),
      );
    } catch (err) {
      console.error('Judge invite email failed for', email, err);
    }

    return assignment;
  }

  static async removeJudge(eventId: string, assignmentId: string) {
    await assertScreeningEvent(eventId);
    const assignment = await prisma.judgeAssignment.findFirst({
      where: { id: assignmentId, eventId },
    });
    if (!assignment) throw new NotFoundError('Judge not found on this panel');

    const scored = await prisma.startupScore.count({
      where: { eventId, judgeId: assignment.judgeId },
    });
    if (scored > 0) {
      throw new BadRequestError(
        'This judge has already scored. Their scores would be orphaned — clear them first if you really mean to remove them.',
      );
    }

    await prisma.judgeAssignment.delete({ where: { id: assignmentId } });
    return this.listJudges(eventId);
  }

  static async listCandidates(eventId: string) {
    await assertScreeningEvent(eventId);
    return prisma.screeningCandidate.findMany({
      where: { eventId },
      include: candidateInclude,
      orderBy: { position: 'asc' },
    });
  }

  /**
   * Queue applications for a round. Also creates the EventScheduleSlot each
   * candidate needs to appear in the judges' list — without it they would be
   * invisible to the scoring screen.
   */
  static async addCandidates(eventId: string, applicationIds: string[]) {
    await assertScreeningEvent(eventId);
    if (!Array.isArray(applicationIds) || applicationIds.length === 0) {
      throw new BadRequestError('Select at least one application.');
    }

    const applications = await prisma.startupApplication.findMany({
      where: { id: { in: applicationIds } },
      select: { id: true, userId: true, startupName: true },
    });
    if (applications.length !== applicationIds.length) {
      throw new BadRequestError('One or more applications could not be found.');
    }

    const existing = await prisma.screeningCandidate.findMany({
      where: { eventId },
      select: { applicationId: true, position: true },
    });
    const already = new Set(existing.map((c) => c.applicationId));
    const toAdd = applications.filter((a) => !already.has(a.id));
    if (toAdd.length === 0) return this.listCandidates(eventId);

    let nextPosition = existing.reduce((max, c) => Math.max(max, c.position), 0) + 1;

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      for (const app of toAdd) {
        const position = nextPosition++;

        await tx.screeningCandidate.create({
          data: { eventId, applicationId: app.id, position },
        });

        // The judging stack reads its running order from here.
        const slot = await tx.eventScheduleSlot.findFirst({
          where: { eventId, startupId: app.userId },
        });
        if (!slot) {
          await tx.eventScheduleSlot.create({
            data: { eventId, startupId: app.userId, position, durationMins: 10, bufferMins: 2 },
          });
        }
      }
    });

    return this.listCandidates(eventId);
  }

  static async removeCandidate(eventId: string, candidateId: string) {
    await assertScreeningEvent(eventId);
    const candidate = await prisma.screeningCandidate.findFirst({
      where: { id: candidateId, eventId },
      include: { application: { select: { userId: true } } },
    });
    if (!candidate) throw new NotFoundError('Candidate not found');
    if (candidate.outcome !== 'PENDING') {
      throw new BadRequestError(
        'This candidate has already been decided. Reset the outcome before removing it.',
      );
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.screeningCandidate.delete({ where: { id: candidateId } });
      await tx.eventScheduleSlot.deleteMany({
        where: { eventId, startupId: candidate.application.userId },
      });
    });
    return this.listCandidates(eventId);
  }

  /** Reorder the running order; keeps the judges' schedule in step. */
  static async reorder(eventId: string, candidateIds: string[]) {
    await assertScreeningEvent(eventId);
    const candidates = await prisma.screeningCandidate.findMany({
      where: { eventId },
      include: { application: { select: { userId: true } } },
    });
    const byId = new Map(candidates.map((c) => [c.id, c]));

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      for (const [index, id] of candidateIds.entries()) {
        const candidate = byId.get(id);
        if (!candidate) continue;
        await tx.screeningCandidate.update({
          where: { id },
          data: { position: index + 1 },
        });
        await tx.eventScheduleSlot.updateMany({
          where: { eventId, startupId: candidate.application.userId },
          data: { position: index + 1 },
        });
      }
    });
    return this.listCandidates(eventId);
  }

  /**
   * Live control: exactly one candidate is on stage at a time, so this clears
   * the flag everywhere else in the round before setting it.
   */
  static async setPresenting(eventId: string, candidateId: string | null) {
    await assertScreeningEvent(eventId);

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.screeningCandidate.updateMany({
        where: { eventId, isPresenting: true },
        data: { isPresenting: false },
      });
      if (!candidateId) return null;

      const candidate = await tx.screeningCandidate.findFirst({
        where: { id: candidateId, eventId },
      });
      if (!candidate) throw new NotFoundError('Candidate not found');

      return tx.screeningCandidate.update({
        where: { id: candidateId },
        data: { isPresenting: true, presentedAt: candidate.presentedAt ?? new Date() },
        include: candidateInclude,
      });
    });
  }

  /**
   * The panel's decision. SELECTED is the only outcome that moves the
   * application forward: it sets the scheme and cohort, approves Form A and so
   * unlocks Form B.
   */
  static async recordOutcome(
    eventId: string,
    candidateId: string,
    input: { outcome: string; schemeId?: string | null; cohortId?: string | null; note?: string },
    adminId: string,
  ) {
    await assertScreeningEvent(eventId);

    const VALID = ['PENDING', 'SELECTED', 'WAITLISTED', 'REJECTED', 'HOLD'];
    if (!VALID.includes(input.outcome)) {
      throw new BadRequestError(`Outcome must be one of: ${VALID.join(', ')}`);
    }

    const candidate = await prisma.screeningCandidate.findFirst({
      where: { id: candidateId, eventId },
      include: { application: { select: { id: true, status: true } } },
    });
    if (!candidate) throw new NotFoundError('Candidate not found');

    let schemeId = input.schemeId ?? null;
    let cohortId = input.cohortId ?? null;

    if (input.outcome === 'SELECTED') {
      if (!cohortId && !schemeId) {
        throw new BadRequestError('Select a cohort or a scheme before marking a startup selected.');
      }

      if (cohortId) {
        const cohort = await prisma.cohort.findUnique({
          where: { id: cohortId },
          select: { id: true, schemeId: true },
        });
        if (!cohort) throw new BadRequestError('That cohort does not exist.');

        // A cohort carries its own scheme. Taking it from there keeps the two
        // from disagreeing when an admin picks a mismatched pair.
        if (schemeId && schemeId !== cohort.schemeId) {
          throw new BadRequestError(
            'That cohort belongs to a different scheme. Pick the cohort and leave the scheme to follow it.',
          );
        }
        schemeId = cohort.schemeId;
      } else if (schemeId) {
        const scheme = await prisma.scheme.findUnique({ where: { id: schemeId }, select: { id: true } });
        if (!scheme) throw new BadRequestError('That scheme does not exist.');
      }
    }

    const decidedAt = new Date();

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await tx.screeningCandidate.update({
        where: { id: candidateId },
        data: {
          outcome: input.outcome as any,
          schemeId,
          cohortId,
          decisionNote: input.note || null,
          decidedById: adminId,
          decidedAt,
          isPresenting: false,
        },
        include: candidateInclude,
      });

      if (input.outcome === 'SELECTED') {
        await tx.startupApplication.update({
          where: { id: candidate.applicationId },
          data: {
            schemeId,
            cohortId,
            isFormAApproved: true,
            status: ApplicationStatus.APPROVED,
            approvedAt: decidedAt,
            reviewedBy: adminId,
          },
        });
      } else if (input.outcome === 'REJECTED') {
        await tx.startupApplication.update({
          where: { id: candidate.applicationId },
          data: {
            status: ApplicationStatus.REJECTED,
            rejectionReason: input.note || 'Not selected at screening',
            reviewedBy: adminId,
          },
        });
      } else if (input.outcome === 'HOLD') {
        await tx.startupApplication.update({
          where: { id: candidate.applicationId },
          data: { status: ApplicationStatus.HOLD, reviewedBy: adminId },
        });
      }
      // WAITLISTED and PENDING leave the application where it is on purpose —
      // a waitlisted startup is still in play and must not read as rejected.

      return updated;
    });
  }

  /**
   * The panel's view: every candidate with its aggregated score.
   *
   * Weighted mean across criteria, averaged over the judges who actually
   * scored — a judge who skipped a startup must not drag its average down.
   */
  static async getBoard(eventId: string) {
    await assertScreeningEvent(eventId);

    const [candidates, criteria, scores] = await Promise.all([
      prisma.screeningCandidate.findMany({
        where: { eventId },
        include: candidateInclude,
        orderBy: { position: 'asc' },
      }),
      prisma.scorecardCriteria.findMany({ where: { eventId }, orderBy: { position: 'asc' } }),
      prisma.startupScore.findMany({ where: { eventId } }),
    ]);

    const weightTotal = criteria.reduce((sum, c) => sum + (c.weight || 0), 0);

    const board = candidates.map((candidate) => {
      const mine = scores.filter((s) => s.startupId === candidate.application.userId);
      const judgeIds = Array.from(new Set(mine.map((s) => s.judgeId)));

      const perJudge = judgeIds.map((judgeId) => {
        const judgeScores = mine.filter((s) => s.judgeId === judgeId);
        let weighted = 0;
        let weightUsed = 0;
        for (const criterion of criteria) {
          const row = judgeScores.find((s) => s.criteriaId === criterion.id);
          if (!row) continue;
          // Normalise to a percentage so criteria with different maxScores are
          // comparable before weighting.
          weighted += (row.score / (criterion.maxScore || 1)) * 100 * (criterion.weight || 0);
          weightUsed += criterion.weight || 0;
        }
        return { judgeId, score: weightUsed ? weighted / weightUsed : null };
      });

      const scored = perJudge.filter((j) => j.score !== null) as { judgeId: string; score: number }[];
      const average = scored.length
        ? scored.reduce((sum, j) => sum + j.score, 0) / scored.length
        : null;

      return {
        ...candidate,
        judgesScored: scored.length,
        averageScore: average === null ? null : Math.round(average * 10) / 10,
      };
    });

    const ranked = [...board]
      .filter((c) => c.averageScore !== null)
      .sort((a, b) => (b.averageScore as number) - (a.averageScore as number));
    const rankById = new Map(ranked.map((c, i) => [c.id, i + 1]));

    return {
      criteria,
      weightTotal,
      candidates: board.map((c) => ({ ...c, rank: rankById.get(c.id) ?? null })),
    };
  }
}

function buildJudgeInvite(o: {
  judgeName: string;
  eventTitle: string;
  venue?: string | null;
  startDate: Date;
  link: string;
}) {
  const when = o.startDate.toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short' });
  return `
    <div style="font-family: sans-serif; max-width: 560px; padding: 24px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #2D3748; margin-top: 0;">You have been invited to judge</h2>
      <p>Hello ${o.judgeName},</p>
      <p>GTU Ventures has invited you to the screening panel for <b>${o.eventTitle}</b>.</p>
      <table style="font-size: 14px; color: #4A5568;">
        <tr><td style="padding: 4px 12px 4px 0;">When</td><td><b>${when}</b></td></tr>
        ${o.venue ? `<tr><td style="padding: 4px 12px 4px 0;">Where</td><td><b>${o.venue}</b></td></tr>` : ''}
      </table>
      <p style="margin-top: 20px;">
        On the day, open the scoring screen and sign in with this email address.
        You will be sent a one-time code — there is no password to remember.
      </p>
      <p><a href="${o.link}" style="background:#4A5568;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block;">Open the scoring screen</a></p>
      <p style="font-size: 12px; color: #718096; margin-top: 24px;">
        If you were not expecting this, you can ignore this email.
      </p>
    </div>
  `;
}
