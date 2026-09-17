/**
 * End-to-end check of a screening round.
 *
 *   npx ts-node -T scripts/e2e-screening.ts
 *
 * Creates its own throwaway event, scheme, cohort, applications and judges and
 * removes them again in the finally block, so it is safe against a development
 * database. The service layer is called directly — no server needed — which
 * still covers Prisma, the soft-delete middleware and the real database.
 */
import 'dotenv/config'; // must load before prisma reads DATABASE_URL
import prisma from '../src/lib/prisma';
import { ScreeningService } from '../src/modules/events/screening.service';
import { ApplicationsService } from '../src/modules/applications/applications.service';

const STAMP = Date.now();

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail?: any) {
  if (condition) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    console.log(`  FAIL  ${label}${detail !== undefined ? ` → ${JSON.stringify(detail)}` : ''}`);
  }
}

function section(title: string) {
  console.log(`\n${title}`);
}

/** Did this throw? Used for the guard assertions. */
async function rejects(fn: () => Promise<any>) {
  try {
    await fn();
    return null;
  } catch (err: any) {
    return err?.message || 'threw';
  }
}

async function main() {
  const created: {
    events: string[];
    schemes: string[];
    cohorts: string[];
    users: string[];
    apps: string[];
  } = { events: [], schemes: [], cohorts: [], users: [], apps: [] };
  let aborted: unknown;

  try {
    section('Setup');

    const admin = await prisma.user.create({
      data: { email: `e2e-scr-admin-${STAMP}@example.com`, name: 'E2E Admin', role: 'ADMIN' },
    });
    created.users.push(admin.id);

    const scheme = await prisma.scheme.create({
      data: { name: `E2E Screening Scheme ${STAMP}`, code: `E2ES${STAMP}`, type: 'GRANT', maxGrant: 500000, status: 'ACTIVE' },
    });
    const otherScheme = await prisma.scheme.create({
      data: { name: `E2E Other Scheme ${STAMP}`, code: `E2EO${STAMP}`, type: 'GRANT', maxGrant: 100000, status: 'ACTIVE' },
    });
    created.schemes.push(scheme.id, otherScheme.id);

    const cohort = await prisma.cohort.create({
      data: { name: `E2E Cohort ${STAMP}`, startDate: new Date(), schemeId: scheme.id },
    });
    created.cohorts.push(cohort.id);

    const event = await prisma.event.create({
      data: {
        code: `E2ESCR${STAMP}`,
        title: `E2E Screening Round ${STAMP}`,
        type: 'SCREENING',
        startDate: new Date(),
        endDate: new Date(Date.now() + 3 * 60 * 60 * 1000),
        venue: 'E2E Hall',
        createdBy: admin.id,
      },
    });
    const demoDay = await prisma.event.create({
      data: {
        code: `E2EDEMO${STAMP}`,
        title: `E2E Demo Day ${STAMP}`,
        type: 'DEMO_DAY',
        startDate: new Date(),
        endDate: new Date(Date.now() + 3 * 60 * 60 * 1000),
        createdBy: admin.id,
      },
    });
    created.events.push(event.id, demoDay.id);

    // Three startups that have submitted the trimmed Form A.
    const apps: any[] = [];
    for (const n of [1, 2, 3]) {
      const user = await prisma.user.create({
        data: { email: `e2e-scr-startup${n}-${STAMP}@example.com`, role: 'STARTUP' },
      });
      created.users.push(user.id);
      const app = await ApplicationsService.submitFormA(user.id, {
        startupName: `E2E Startup ${n} ${STAMP}`,
        fullName: `Founder ${n}`,
        email: `e2e-scr-startup${n}-${STAMP}@example.com`,
        mobile: '9999999999',
        legalStatus: 'PRIVATE_LIMITED',
        mainSector: 'AgriTech',
        stage: 'PROTOTYPE',
        briefAbout: 'A throwaway startup created by the screening e2e test.',
        pitchDeck: '/uploads/applications/e2e.pdf',
      });
      created.apps.push(app.id);
      apps.push({ ...app, userId: user.id });
    }
    check('three applications submitted Form A', apps.length === 3);
    check('Form A stores only what it asks for — no invented date of birth', apps[0].dob === null, apps[0].dob);

    // ── The waiting pool ──────────────────────────────────────────────────────
    section('Applications awaiting screening');

    let awaiting = await ScreeningService.getAwaitingScreening();
    const awaitingIds = awaiting.map((a: any) => a.id);
    check('all three are waiting to be screened', created.apps.every((id) => awaitingIds.includes(id)));

    // ── Queueing candidates ───────────────────────────────────────────────────
    section('Queue candidates');

    let candidates = await ScreeningService.addCandidates(event.id, created.apps);
    check('three candidates queued', candidates.length === 3, candidates.length);
    check('running order is 1, 2, 3', candidates.map((c: any) => c.position).join(',') === '1,2,3');
    check('all start PENDING', candidates.every((c: any) => c.outcome === 'PENDING'));

    // The judges' scoring screen reads its list from here, not from the
    // screening table — without a slot a candidate is invisible to judges.
    const slots = await prisma.eventScheduleSlot.findMany({ where: { eventId: event.id } });
    check('a schedule slot was created for each candidate', slots.length === 3, slots.length);

    awaiting = await ScreeningService.getAwaitingScreening();
    check(
      'queued applications drop out of the waiting pool',
      !awaiting.some((a: any) => created.apps.includes(a.id)),
    );

    const dup = await ScreeningService.addCandidates(event.id, [created.apps[0]!]);
    check('re-adding the same application does not duplicate it', dup.length === 3, dup.length);

    // ── Guards on the event type ──────────────────────────────────────────────
    section('Guards');

    check(
      'a demo day cannot be driven as a screening round',
      !!(await rejects(() => ScreeningService.listCandidates(demoDay.id))),
    );

    // ── The panel ─────────────────────────────────────────────────────────────
    section('Panel — including a guest judge');

    const guest = await ScreeningService.inviteJudge(event.id, {
      name: 'Jane Investor',
      email: `e2e-guest-judge-${STAMP}@example.com`,
      organisation: 'Acme Ventures',
      designation: 'Partner',
    });
    created.users.push(guest.judgeId);
    check('a guest judge with no GTU account is created', guest.judge.role === 'EXPERT', guest.judge.role);
    check('flagged as external', guest.isExternal === true);
    check('affiliation is stored on the assignment', guest.organisation === 'Acme Ventures');

    const staffJudge = await ScreeningService.inviteJudge(event.id, { email: admin.email });
    check('an existing admin is reused, not duplicated', staffJudge.judgeId === admin.id);
    check('and is not marked external', staffJudge.isExternal === false);

    const adminRoleAfter = await prisma.user.findUnique({ where: { id: admin.id } });
    check('an existing role is never downgraded', adminRoleAfter?.role === 'ADMIN', adminRoleAfter?.role);

    check(
      'the same judge cannot be added twice',
      !!(await rejects(() => ScreeningService.inviteJudge(event.id, { email: guest.judge.email }))),
    );

    // ── Live control ──────────────────────────────────────────────────────────
    section('Live control');

    const first = candidates[0]!;
    const second = candidates[1]!;

    await ScreeningService.setPresenting(event.id, first.id);
    let live = await ScreeningService.listCandidates(event.id);
    check('exactly one candidate is on stage', live.filter((c: any) => c.isPresenting).length === 1);
    check('and it is the right one', live.find((c: any) => c.isPresenting)?.id === first.id);
    check('presentedAt is stamped', !!live.find((c: any) => c.id === first.id)?.presentedAt);

    await ScreeningService.setPresenting(event.id, second.id);
    live = await ScreeningService.listCandidates(event.id);
    check('moving the stage clears the previous candidate', live.filter((c: any) => c.isPresenting).length === 1);
    check('the stage moved to the second candidate', live.find((c: any) => c.isPresenting)?.id === second.id);

    await ScreeningService.setPresenting(event.id, null);
    live = await ScreeningService.listCandidates(event.id);
    check('the stage can be cleared', live.every((c: any) => !c.isPresenting));

    // ── Scoring and the board ─────────────────────────────────────────────────
    section('Scoring');

    const innovation = await prisma.scorecardCriteria.create({
      data: { eventId: event.id, name: 'Innovation', maxScore: 10, weight: 2, position: 1 },
    });
    const market = await prisma.scorecardCriteria.create({
      data: { eventId: event.id, name: 'Market', maxScore: 5, weight: 1, position: 2 },
    });

    // Guest judge scores candidate 1 full marks on both criteria.
    for (const [criteria, score] of [[innovation, 10], [market, 5]] as const) {
      await prisma.startupScore.create({
        data: {
          eventId: event.id,
          criteriaId: criteria.id,
          judgeId: guest.judgeId,
          startupId: apps[0].userId,
          score,
        },
      });
    }
    // Admin judge scores candidate 1 half marks on both.
    for (const [criteria, score] of [[innovation, 5], [market, 2.5]] as const) {
      await prisma.startupScore.create({
        data: {
          eventId: event.id,
          criteriaId: criteria.id,
          judgeId: admin.id,
          startupId: apps[0].userId,
          score,
        },
      });
    }
    // Only the guest scores candidate 2, and poorly.
    await prisma.startupScore.create({
      data: { eventId: event.id, criteriaId: innovation.id, judgeId: guest.judgeId, startupId: apps[1].userId, score: 2 },
    });

    const board = await ScreeningService.getBoard(event.id);
    const c1 = board.candidates.find((c: any) => c.applicationId === created.apps[0]);
    const c2 = board.candidates.find((c: any) => c.applicationId === created.apps[1]);
    const c3 = board.candidates.find((c: any) => c.applicationId === created.apps[2]);

    // 100% from one judge and 50% from the other, averaged = 75.
    check('scores are normalised and averaged across judges', c1?.averageScore === 75, c1?.averageScore);
    check('judges counted correctly', c1?.judgesScored === 2, c1?.judgesScored);
    // 2/10 = 20%, scored by one judge only; the unscored criterion is ignored
    // rather than counted as zero.
    check('a judge who skipped a criterion does not drag the score to zero', c2?.averageScore === 20, c2?.averageScore);
    check('an unscored candidate has no score rather than a zero', c3?.averageScore === null, c3?.averageScore);
    check('ranked by score', c1?.rank === 1 && c2?.rank === 2, [c1?.rank, c2?.rank]);
    check('an unscored candidate has no rank', c3?.rank === null, c3?.rank);

    check(
      'a judge who has scored cannot be silently removed',
      !!(await rejects(() => ScreeningService.removeJudge(event.id, guest.id))),
    );

    // ── The decision ──────────────────────────────────────────────────────────
    section('Panel decision');

    check(
      'selected requires a cohort or a scheme',
      !!(await rejects(() =>
        ScreeningService.recordOutcome(event.id, first.id, { outcome: 'SELECTED' }, admin.id),
      )),
    );

    check(
      'a cohort from a different scheme is refused',
      !!(await rejects(() =>
        ScreeningService.recordOutcome(
          event.id,
          first.id,
          { outcome: 'SELECTED', cohortId: cohort.id, schemeId: otherScheme.id },
          admin.id,
        ),
      )),
    );

    const selected = await ScreeningService.recordOutcome(
      event.id,
      first.id,
      { outcome: 'SELECTED', cohortId: cohort.id, note: 'Strong team' },
      admin.id,
    );
    check('outcome recorded', selected.outcome === 'SELECTED');
    check('the scheme follows the cohort', selected.schemeId === scheme.id, selected.schemeId);
    check('who decided and when is recorded', !!selected.decidedById && !!selected.decidedAt);

    const approvedApp = await prisma.startupApplication.findUnique({ where: { id: created.apps[0] } });
    check('the application is approved', approvedApp?.status === 'APPROVED', approvedApp?.status);
    check('Form A is approved, which unlocks Form B', approvedApp?.isFormAApproved === true);
    check('the scheme is written to the application', approvedApp?.schemeId === scheme.id);
    check('the cohort is written to the application', approvedApp?.cohortId === cohort.id);

    await ScreeningService.recordOutcome(event.id, second.id, { outcome: 'WAITLISTED' }, admin.id);
    const waitlistedApp = await prisma.startupApplication.findUnique({ where: { id: created.apps[1] } });
    check(
      'waitlisting leaves the application in play rather than rejecting it',
      waitlistedApp?.status !== 'REJECTED' && waitlistedApp?.isFormAApproved === false,
      waitlistedApp?.status,
    );

    const third = candidates[2]!;
    await ScreeningService.recordOutcome(
      event.id,
      third.id,
      { outcome: 'REJECTED', note: 'Too early' },
      admin.id,
    );
    const rejectedApp = await prisma.startupApplication.findUnique({ where: { id: created.apps[2] } });
    check('rejection is reflected on the application', rejectedApp?.status === 'REJECTED', rejectedApp?.status);
    check('with the reason kept', rejectedApp?.rejectionReason === 'Too early', rejectedApp?.rejectionReason);

    check(
      'a decided candidate cannot be quietly removed from the round',
      !!(await rejects(() => ScreeningService.removeCandidate(event.id, first.id))),
    );
  } catch (err) {
    // Captured rather than rethrown so cleanup still runs; the finally block
    // calls process.exit and would otherwise swallow it entirely.
    aborted = err;
  } finally {
    section('Cleanup');
    // Raw SQL: the soft-delete middleware turns deleteMany into an UPDATE,
    // which would leave the test rows behind.
    for (const id of created.events) {
      await prisma.$executeRaw`DELETE FROM "StartupScore" WHERE "eventId" = ${id}`;
      await prisma.$executeRaw`DELETE FROM "ScorecardCriteria" WHERE "eventId" = ${id}`;
      await prisma.$executeRaw`DELETE FROM "JudgeAssignment" WHERE "eventId" = ${id}`;
      await prisma.$executeRaw`DELETE FROM "EventScheduleSlot" WHERE "eventId" = ${id}`;
      await prisma.$executeRaw`DELETE FROM "ScreeningCandidate" WHERE "eventId" = ${id}`;
      await prisma.$executeRaw`DELETE FROM "Event" WHERE "id" = ${id}`;
    }
    for (const id of created.apps) {
      await prisma.$executeRaw`DELETE FROM "ApplicationSchemePreference" WHERE "applicationId" = ${id}`;
      await prisma.$executeRaw`DELETE FROM "StartupApplication" WHERE "id" = ${id}`;
    }
    for (const id of created.cohorts) {
      await prisma.$executeRaw`DELETE FROM "Cohort" WHERE "id" = ${id}`;
    }
    for (const id of created.users) {
      await prisma.$executeRaw`DELETE FROM "StartupProfile" WHERE "userId" = ${id}`;
      await prisma.$executeRaw`DELETE FROM "StartupApplication" WHERE "userId" = ${id}`;
      await prisma.$executeRaw`DELETE FROM "User" WHERE "id" = ${id}`;
    }
    for (const id of created.schemes) {
      await prisma.$executeRaw`DELETE FROM "Scheme" WHERE "id" = ${id}`;
    }
    console.log('  removed test event, applications, judges, cohort and schemes');

    console.log(`\n${passed} passed, ${failed} failed`);
    if (aborted) {
      console.error('\nAborted early:');
      console.error(aborted);
    }
    await prisma.$disconnect();
    process.exit(failed > 0 || aborted ? 1 : 0);
  }
}

main();
