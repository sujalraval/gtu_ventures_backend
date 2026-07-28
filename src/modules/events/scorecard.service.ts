import prisma from '../../lib/prisma';
import { NotFoundError, BadRequestError } from '../../common/utils/apiError';

export class ScorecardService {

  // ── Criteria (admin sets up scoring template) ─────────────────────────────

  static async getCriteria(eventId: string) {
    await assertEvent(eventId);
    return prisma.scorecardCriteria.findMany({
      where: { eventId },
      orderBy: { position: 'asc' },
    });
  }

  static async upsertCriteria(eventId: string, items: {
    id?: string;
    name: string;
    description?: string;
    maxScore?: number;
    weight?: number;
    position?: number;
  }[]) {
    await assertEvent(eventId);
    const ops = items.map((item, idx) =>
      item.id
        ? prisma.scorecardCriteria.update({
            where: { id: item.id },
            data: {
              name: item.name,
              description: item.description,
              maxScore: item.maxScore ?? 10,
              weight: item.weight ?? 1.0,
              position: item.position ?? idx + 1,
            },
          })
        : prisma.scorecardCriteria.create({
            data: {
              eventId,
              name: item.name,
              description: item.description,
              maxScore: item.maxScore ?? 10,
              weight: item.weight ?? 1.0,
              position: item.position ?? idx + 1,
            },
          })
    );
    await prisma.$transaction(ops);
    return this.getCriteria(eventId);
  }

  static async deleteCriteria(criteriaId: string) {
    const c = await prisma.scorecardCriteria.findUnique({ where: { id: criteriaId } });
    if (!c) throw new NotFoundError('Criteria not found');
    await prisma.scorecardCriteria.delete({ where: { id: criteriaId } });
  }

  // ── Judge assignments ─────────────────────────────────────────────────────

  static async getJudges(eventId: string) {
    await assertEvent(eventId);
    return prisma.judgeAssignment.findMany({
      where: { eventId },
      include: { judge: { select: { id: true, name: true, email: true, role: true } } },
    });
  }

  static async assignJudge(eventId: string, judgeId: string, startupId?: string) {
    await assertEvent(eventId);
    return prisma.judgeAssignment.upsert({
      where: { eventId_judgeId_startupId: { eventId, judgeId, startupId: startupId ?? '' } },
      create: { eventId, judgeId, startupId: startupId ?? null },
      update: {},
      include: { judge: { select: { id: true, name: true, email: true } } },
    });
  }

  static async removeJudge(assignmentId: string) {
    const a = await prisma.judgeAssignment.findUnique({ where: { id: assignmentId } });
    if (!a) throw new NotFoundError('Assignment not found');
    await prisma.judgeAssignment.delete({ where: { id: assignmentId } });
  }

  // ── Scoring (judge submits scores) ───────────────────────────────────────

  static async submitScore(eventId: string, judgeId: string, data: {
    criteriaId: string;
    startupId: string;
    score: number;
    comment?: string;
  }) {
    await assertEvent(eventId);

    // Validate score range
    const criteria = await prisma.scorecardCriteria.findUnique({ where: { id: data.criteriaId } });
    if (!criteria) throw new NotFoundError('Criteria not found');
    if (data.score < 0 || data.score > criteria.maxScore) {
      throw new BadRequestError(`Score must be between 0 and ${criteria.maxScore}`);
    }

    return prisma.startupScore.upsert({
      where: {
        eventId_criteriaId_judgeId_startupId: {
          eventId,
          criteriaId: data.criteriaId,
          judgeId,
          startupId: data.startupId,
        },
      },
      create: {
        eventId,
        criteriaId: data.criteriaId,
        judgeId,
        startupId: data.startupId,
        score: data.score,
        comment: data.comment,
        submittedAt: new Date(),
      },
      update: {
        score: data.score,
        comment: data.comment,
        submittedAt: new Date(),
      },
      include: {
        criteria: { select: { id: true, name: true, maxScore: true, weight: true } },
        startup: { select: { id: true, name: true } },
      },
    });
  }

  static async submitBatchScores(eventId: string, judgeId: string, scores: {
    criteriaId: string;
    startupId: string;
    score: number;
    comment?: string;
  }[]) {
    const results = [];
    for (const s of scores) {
      results.push(await this.submitScore(eventId, judgeId, s));
    }
    return results;
  }

  // ── Get scores for a judge (judge's own view) ────────────────────────────

  static async getJudgeScores(eventId: string, judgeId: string, startupId?: string) {
    return prisma.startupScore.findMany({
      where: { eventId, judgeId, ...(startupId ? { startupId } : {}) },
      include: {
        criteria: { select: { id: true, name: true, maxScore: true, weight: true, position: true } },
        startup: { select: { id: true, name: true } },
      },
      orderBy: [{ startupId: 'asc' }, { criteria: { position: 'asc' } }],
    });
  }

  // ── Leaderboard / results (admin view) ───────────────────────────────────

  static async getLeaderboard(eventId: string) {
    await assertEvent(eventId);

    const criteria = await prisma.scorecardCriteria.findMany({
      where: { eventId },
      orderBy: { position: 'asc' },
    });

    const allScores = await prisma.startupScore.findMany({
      where: { eventId },
      include: {
        startup: { select: { id: true, name: true, email: true } },
        judge: { select: { id: true, name: true } },
        criteria: { select: { id: true, name: true, maxScore: true, weight: true } },
      },
    });

    // Group by startup
    const startupMap = new Map<string, {
      startup: { id: string; name: string | null; email: string };
      totalWeightedScore: number;
      maxPossible: number;
      percentage: number;
      judgeCount: number;
      criteriaBreakdown: { criteriaId: string; name: string; avgScore: number; maxScore: number; weight: number }[];
    }>();

    for (const score of allScores) {
      const key = score.startupId;
      if (!startupMap.has(key)) {
        startupMap.set(key, {
          startup: score.startup,
          totalWeightedScore: 0,
          maxPossible: 0,
          percentage: 0,
          judgeCount: 0,
          criteriaBreakdown: [],
        });
      }
    }

    // Calculate per-criteria averages across judges, then weighted total
    for (const [startupId, entry] of startupMap) {
      const startupScores = allScores.filter(s => s.startupId === startupId);
      const judgeIds = new Set(startupScores.map(s => s.judgeId));
      entry.judgeCount = judgeIds.size;

      let totalWeighted = 0;
      let totalMaxWeighted = 0;

      for (const c of criteria) {
        const criteriaScores = startupScores.filter(s => s.criteriaId === c.id);
        const avg = criteriaScores.length > 0
          ? criteriaScores.reduce((sum, s) => sum + s.score, 0) / criteriaScores.length
          : 0;

        totalWeighted += avg * c.weight;
        totalMaxWeighted += c.maxScore * c.weight;

        entry.criteriaBreakdown.push({
          criteriaId: c.id,
          name: c.name,
          avgScore: Math.round(avg * 100) / 100,
          maxScore: c.maxScore,
          weight: c.weight,
        });
      }

      entry.totalWeightedScore = Math.round(totalWeighted * 100) / 100;
      entry.maxPossible = Math.round(totalMaxWeighted * 100) / 100;
      entry.percentage = totalMaxWeighted > 0
        ? Math.round((totalWeighted / totalMaxWeighted) * 10000) / 100
        : 0;
    }

    const leaderboard = Array.from(startupMap.values())
      .sort((a, b) => b.totalWeightedScore - a.totalWeightedScore)
      .map((entry, idx) => ({ rank: idx + 1, ...entry }));

    return { leaderboard, criteria };
  }

  // ── Startups to score for an event (from schedule) ───────────────────────

  static async getStartupsToScore(eventId: string) {
    await assertEvent(eventId);
    const slots = await prisma.eventScheduleSlot.findMany({
      where: { eventId },
      include: { startup: { select: { id: true, name: true, email: true } } },
      orderBy: { position: 'asc' },
    });
    // Fallback: if no schedule, get startups with accepted pitch decks
    if (slots.length > 0) return slots.map(s => s.startup);

    const decks = await prisma.pitchDeckSubmission.findMany({
      where: { eventId, isActive: true, status: 'ACCEPTED' },
      include: { startup: { select: { id: true, name: true, email: true } } },
    });
    return decks.map(d => d.startup);
  }
}

async function assertEvent(eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new NotFoundError('Event not found');
  return event;
}
