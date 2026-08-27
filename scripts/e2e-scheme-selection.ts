/**
 * End-to-end check of multiple scheme selection.
 *
 *   npx ts-node -T scripts/e2e-scheme-selection.ts
 *
 * Creates its own throwaway schemes, users and applications and removes them
 * again in the finally block, so it is safe against a development database.
 * No server needed — the service layer is called directly, which still covers
 * Prisma, the soft-delete middleware and the real database.
 */
import 'dotenv/config'; // must load before prisma reads DATABASE_URL
import prisma from '../src/lib/prisma';
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

/** Minimum Form A payload — every other column has a fallback in the service. */
function formA(extra: Record<string, any>) {
  return {
    isDraft: true,
    fullName: 'E2E Founder',
    designation: 'Founder',
    email: `e2e-scheme-${STAMP}@example.com`,
    mobile: '9999999999',
    aadhaar: '000000000000',
    gender: 'Other',
    startupName: `E2E Scheme Co ${STAMP}`,
    ...extra,
  };
}

async function prefsFor(applicationId: string) {
  return prisma.applicationSchemePreference.findMany({
    where: { applicationId },
    orderBy: { priority: 'asc' },
  });
}

async function main() {
  const created: { schemes: string[]; users: string[]; apps: string[] } = {
    schemes: [],
    users: [],
    apps: [],
  };
  let aborted: unknown;

  try {
    section('Setup');

    const schemeA = await prisma.scheme.create({
      data: { name: `E2E Scheme A ${STAMP}`, code: `E2EA${STAMP}`, type: 'GRANT', maxGrant: 100000, status: 'ACTIVE' },
    });
    const schemeB = await prisma.scheme.create({
      data: { name: `E2E Scheme B ${STAMP}`, code: `E2EB${STAMP}`, type: 'GRANT', maxGrant: 200000, status: 'ACTIVE' },
    });
    const schemeC = await prisma.scheme.create({
      data: { name: `E2E Scheme C ${STAMP}`, code: `E2EC${STAMP}`, type: 'GRANT', maxGrant: 300000, status: 'ACTIVE' },
    });
    created.schemes.push(schemeA.id, schemeB.id, schemeC.id);

    const startupUser = await prisma.user.create({
      data: { email: `e2e-startup-${STAMP}@example.com`, role: 'STARTUP' },
    });
    const spaceUser = await prisma.user.create({
      data: { email: `e2e-space-${STAMP}@example.com`, role: 'STARTUP' },
    });
    const admin = await prisma.user.create({
      data: { email: `e2e-admin-${STAMP}@example.com`, role: 'ADMIN' },
    });
    created.users.push(startupUser.id, spaceUser.id, admin.id);
    check('setup created three schemes and three users', true);

    // ── Multi-scheme submission ───────────────────────────────────────────────
    section('Startup selects two schemes');

    let app: any = await ApplicationsService.submitFormA(
      startupUser.id,
      formA({ schemes: [schemeA.id, schemeB.id], intent: 'SCHEME_WITH_SPACE' }),
    );
    created.apps.push(app.id);

    check('schemeId defaults to the first choice', app.schemeId === schemeA.id, app.schemeId);
    check('intent is stored', app.intent === 'SCHEME_WITH_SPACE', app.intent);

    let prefs = await prefsFor(app.id);
    check('two preference rows created', prefs.length === 2, prefs.length);
    check('ranked in the order chosen', prefs[0]?.schemeId === schemeA.id && prefs[1]?.schemeId === schemeB.id);
    check('both start as REQUESTED', prefs.every((p) => p.status === 'REQUESTED'));

    // ── Admin decision ────────────────────────────────────────────────────────
    section('Admin picks the second choice');

    const decided: any = await ApplicationsService.decideScheme(app.id, schemeB.id, admin.id, 'Better fit');
    check('schemeId moves to the chosen scheme', decided.schemeId === schemeB.id, decided.schemeId);

    prefs = await prefsFor(app.id);
    const prefA = prefs.find((p) => p.schemeId === schemeA.id);
    const prefB = prefs.find((p) => p.schemeId === schemeB.id);
    check('chosen scheme is SELECTED', prefB?.status === 'SELECTED', prefB?.status);
    check('the other is NOT_SELECTED', prefA?.status === 'NOT_SELECTED', prefA?.status);
    check('decision records who and when', !!prefB?.decidedById && !!prefB?.decidedAt);
    check('note is stored', prefB?.note === 'Better fit', prefB?.note);

    // ── The regression this test exists for ───────────────────────────────────
    section("Re-submitting the draft must not undo the admin's decision");

    app = await ApplicationsService.submitFormA(
      startupUser.id,
      formA({ schemes: [schemeA.id, schemeB.id], intent: 'SCHEME_WITH_SPACE' }),
    );
    check('schemeId still the admin choice, not the first choice', app.schemeId === schemeB.id, app.schemeId);

    prefs = await prefsFor(app.id);
    check(
      'SELECTED survives the re-submit',
      prefs.find((p) => p.schemeId === schemeB.id)?.status === 'SELECTED',
      prefs.find((p) => p.schemeId === schemeB.id)?.status,
    );
    check(
      'NOT_SELECTED survives the re-submit',
      prefs.find((p) => p.schemeId === schemeA.id)?.status === 'NOT_SELECTED',
      prefs.find((p) => p.schemeId === schemeA.id)?.status,
    );

    // ── Adding and dropping choices ───────────────────────────────────────────
    section('Startup adds a third scheme, then drops it');

    await ApplicationsService.submitFormA(
      startupUser.id,
      formA({ schemes: [schemeA.id, schemeB.id, schemeC.id], intent: 'SCHEME_WITH_SPACE' }),
    );
    prefs = await prefsFor(app.id);
    check('third choice added as REQUESTED', prefs.find((p) => p.schemeId === schemeC.id)?.status === 'REQUESTED');

    await ApplicationsService.submitFormA(
      startupUser.id,
      formA({ schemes: [schemeA.id, schemeB.id], intent: 'SCHEME_WITH_SPACE' }),
    );
    prefs = await prefsFor(app.id);
    check(
      'a dropped choice is WITHDRAWN, not deleted',
      prefs.find((p) => p.schemeId === schemeC.id)?.status === 'WITHDRAWN',
      prefs.find((p) => p.schemeId === schemeC.id)?.status,
    );
    check('history is kept — still three rows', prefs.length === 3, prefs.length);

    // ── Guards ────────────────────────────────────────────────────────────────
    section('Guards');

    let rejected = false;
    try {
      await ApplicationsService.decideScheme(app.id, schemeC.id, admin.id);
    } catch {
      rejected = true;
    }
    check('cannot select a scheme the startup withdrew', rejected, rejected);

    let unrequested = false;
    try {
      const stray = await prisma.scheme.create({
        data: { name: `E2E Stray ${STAMP}`, code: `E2EX${STAMP}`, type: 'GRANT', maxGrant: 1, status: 'ACTIVE' },
      });
      created.schemes.push(stray.id);
      await ApplicationsService.decideScheme(app.id, stray.id, admin.id);
    } catch {
      unrequested = true;
    }
    check('cannot select a scheme never requested', unrequested, unrequested);

    // ── Incubation space only ─────────────────────────────────────────────────
    section('Incubation space only');

    const spaceApp: any = await ApplicationsService.submitFormA(
      spaceUser.id,
      formA({ schemes: [], intent: 'SPACE_ONLY', email: `e2e-space-${STAMP}@example.com` }),
    );
    created.apps.push(spaceApp.id);

    check('schemeId is NULL, not a sentinel', spaceApp.schemeId === null, spaceApp.schemeId);
    check('intent is SPACE_ONLY', spaceApp.intent === 'SPACE_ONLY', spaceApp.intent);
    check('no preference rows', (await prefsFor(spaceApp.id)).length === 0);

    let spaceRejected = false;
    try {
      await ApplicationsService.decideScheme(spaceApp.id, schemeA.id, admin.id);
    } catch {
      spaceRejected = true;
    }
    check('admin cannot set a scheme on a space-only application', spaceRejected, spaceRejected);

    section('Switching to space-only withdraws outstanding schemes');

    const switcher: any = await ApplicationsService.submitFormA(
      spaceUser.id,
      formA({ schemes: [schemeA.id], intent: 'SCHEME_ONLY', email: `e2e-space-${STAMP}@example.com` }),
    );
    check('scheme requested again', (await prefsFor(switcher.id)).some((p) => p.status === 'REQUESTED'));

    const switched: any = await ApplicationsService.submitFormA(
      spaceUser.id,
      formA({ schemes: [], intent: 'SPACE_ONLY', email: `e2e-space-${STAMP}@example.com` }),
    );
    check('schemeId cleared to NULL', switched.schemeId === null, switched.schemeId);
    check(
      'outstanding request withdrawn',
      (await prefsFor(switched.id)).every((p) => p.status !== 'REQUESTED'),
    );
  } catch (err) {
    // Captured rather than rethrown so cleanup still runs; the finally block
    // calls process.exit and would otherwise swallow it entirely.
    aborted = err;
  } finally {
    section('Cleanup');
    // Raw SQL: the soft-delete middleware turns deleteMany into an UPDATE,
    // which would leave the test rows behind.
    for (const id of created.apps) {
      await prisma.$executeRaw`DELETE FROM "ApplicationSchemePreference" WHERE "applicationId" = ${id}`;
      await prisma.$executeRaw`DELETE FROM "StartupApplication" WHERE "id" = ${id}`;
    }
    for (const id of created.users) {
      await prisma.$executeRaw`DELETE FROM "StartupProfile" WHERE "userId" = ${id}`;
      await prisma.$executeRaw`DELETE FROM "StartupApplication" WHERE "userId" = ${id}`;
      await prisma.$executeRaw`DELETE FROM "User" WHERE "id" = ${id}`;
    }
    for (const id of created.schemes) {
      await prisma.$executeRaw`DELETE FROM "Scheme" WHERE "id" = ${id}`;
    }
    console.log('  removed test schemes, users and applications');

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
