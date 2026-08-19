/**
 * End-to-end check of the public event participation flow.
 *
 *   npx ts-node -T scripts/e2e-events.ts
 *
 * Needs the dev server running on API_BASE. Creates its own throwaway event,
 * participant and startup rows and removes them again in the finally block, so
 * it is safe to run against a development database.
 *
 * Public endpoints are driven over HTTP so routing, rate limiters and the
 * error handler are all covered. Admin-only steps call the service directly to
 * avoid needing a login.
 */
import 'dotenv/config'; // must load before prisma reads DATABASE_URL
import bcrypt from 'bcryptjs';
import prisma from '../src/lib/prisma';
import { buildCertificate } from '../src/modules/events/certificates.service';

const API = process.env.API_BASE || 'http://localhost:5000/api';
const STAMP = Date.now();
const EMAIL = `e2e-participant-${STAMP}@example.com`;
const FOUNDER_EMAIL = `e2e-founder-${STAMP}@example.com`;
const CODE = '424242';

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

async function api(method: string, path: string, body?: any) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json };
}

/** The real code is bcrypt-hashed and mailed, so plant a known one instead. */
async function plantOtp(email: string) {
  await prisma.eventEmailOtp.updateMany({
    where: { email, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  await prisma.eventEmailOtp.create({
    data: {
      email,
      codeHash: await bcrypt.hash(CODE, 10),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });
}

async function main() {
  const created: { events: string[]; userId?: string } = { events: [] };
  let aborted: any = null;

  try {
    // ── Setup ────────────────────────────────────────────────────────────────
    const admin = await prisma.user.findFirst({ select: { id: true } });
    if (!admin) throw new Error('No user in the database to own the test event');

    const published = await prisma.event.create({
      data: {
        code: `E2E-${STAMP}-A`,
        title: `E2E Test Event ${STAMP}`,
        type: 'WORKSHOP',
        status: 'PUBLISHED',
        mode: 'IN_PERSON',
        venue: 'B-0 Auditorium, GTU',
        startDate: new Date(Date.now() + 86400000),
        endDate: new Date(Date.now() + 90000000),
        isPublic: true,
        createdBy: admin.id,
        registrationFields: [
          { key: 'college', label: 'College', type: 'text', required: true },
          { key: 'semester', label: 'Semester', type: 'select', required: false, options: ['1', '2'] },
        ],
        certificateTemplate: {
          enabled: true,
          title: 'Certificate of Participation',
          programmeLine: 'E2E Programme',
          bodyText: 'This is to certify that {{name}} attended {{event}} on {{date}}.',
          accentColor: '#4A2870',
          logos: [],
          signatories: [{ name: 'Director', designation: 'GTU Ventures' }],
        },
      },
    });
    created.events.push(published.id);

    const draft = await prisma.event.create({
      data: {
        code: `E2E-${STAMP}-B`,
        title: 'E2E Draft Event',
        type: 'WORKSHOP',
        status: 'DRAFT',
        mode: 'IN_PERSON',
        startDate: new Date(Date.now() + 86400000),
        endDate: new Date(Date.now() + 90000000),
        isPublic: true,
        createdBy: admin.id,
      },
    });
    created.events.push(draft.id);

    // ── 1. Public discovery ──────────────────────────────────────────────────
    section('1. Public discovery');
    const list = await api('GET', '/events/public');
    check('GET /events/public returns 200', list.status === 200, list.status);
    const listed = (list.body?.data || []).find((e: any) => e.id === published.id);
    check('published event appears in the public list', !!listed);
    check('draft event is hidden from the public list',
      !(list.body?.data || []).some((e: any) => e.id === draft.id));
    check('public list omits internal columns',
      listed && listed.createdBy === undefined && listed.targetCohorts === undefined);

    const details = await api('GET', `/events/${published.id}/public`);
    check('GET /events/:id/public returns 200', details.status === 200, details.status);
    check('registration fields are exposed to the form',
      Array.isArray(details.body?.data?.registrationFields) &&
      details.body.data.registrationFields.length === 2);

    const draftDetails = await api('GET', `/events/${draft.id}/public`);
    check('draft event details are not readable (404)', draftDetails.status === 404, draftDetails.status);

    // ── 2. OTP ───────────────────────────────────────────────────────────────
    section('2. Email verification');
    await plantOtp(EMAIL);

    const wrong = await api('POST', `/events/${published.id}/registrations/verify-otp`,
      { email: EMAIL, code: '000000' });
    check('wrong code is rejected', wrong.status === 400, wrong.status);

    const verified = await api('POST', `/events/${published.id}/registrations/verify-otp`,
      { email: EMAIL, code: CODE });
    check('correct code returns 200', verified.status === 200, verified.body);
    const token = verified.body?.data?.verificationToken;
    check('a verification token is issued', typeof token === 'string' && token.length > 20);
    check('first-timer has no stored profile', verified.body?.data?.profile == null);

    const replay = await api('POST', `/events/${published.id}/registrations/verify-otp`,
      { email: EMAIL, code: CODE });
    check('the same code cannot be used twice', replay.status === 400, replay.status);

    // ── 3. Registration ──────────────────────────────────────────────────────
    section('3. Registration');
    const noToken = await api('POST', `/events/${published.id}/registrations`,
      { name: 'No Token', email: EMAIL, customFields: { college: 'X' } });
    check('registration without a token is rejected', noToken.status === 400, noToken.status);

    const missingRequired = await api('POST', `/events/${published.id}/registrations`,
      { name: 'E2E Participant', email: EMAIL, verificationToken: token, customFields: {} });
    check('required custom field is enforced', missingRequired.status === 400, missingRequired.status);

    const reg = await api('POST', `/events/${published.id}/registrations`, {
      name: 'E2E Participant',
      email: 'attacker@example.com',            // must be ignored in favour of the token
      phone: '9999999999',
      organization: 'Test College',
      designation: 'Student',
      status: 'CHECKED_IN',                     // must be ignored
      checkedInAt: new Date().toISOString(),    // must be ignored
      qrToken: 'forged-token',                  // must be ignored
      verificationToken: token,
      customFields: { college: 'GTU', semester: '2', injected: 'nope' },
    });
    check('registration succeeds', reg.status === 201, reg.body);
    const regId = reg.body?.data?.id;

    const stored = await prisma.eventRegistration.findUnique({ where: { id: regId } });
    check('email comes from the verified token, not the form body', stored?.email === EMAIL, stored?.email);
    check('checkedInAt cannot be forged', stored?.checkedInAt === null, stored?.checkedInAt);
    check('status cannot be forged', stored?.status === 'CONFIRMED', stored?.status);
    check('qrToken cannot be forged', stored?.qrToken !== 'forged-token');
    check('declared custom fields are stored',
      (stored?.customFields as any)?.college === 'GTU');
    check('undeclared custom fields are dropped',
      (stored?.customFields as any)?.injected === undefined);
    check('a plain participant is not marked as a founder',
      stored?.participantType === 'PARTICIPANT', stored?.participantType);

    const participant = await prisma.eventParticipant.findUnique({ where: { email: EMAIL } });
    check('participant profile is recorded', !!participant);
    check('participant is stored outside the ERP user table',
      !(await prisma.user.findUnique({ where: { email: EMAIL } })));

    // ── 4. Prefill on a second event ─────────────────────────────────────────
    section('4. Prefill for a returning attendee');
    await plantOtp(EMAIL);
    const second = await api('POST', `/events/${draft.id}/registrations/verify-otp`,
      { email: EMAIL, code: CODE });
    check('returning attendee gets their profile back', second.body?.data?.profile?.name === 'E2E Participant',
      second.body?.data?.profile);
    check('previous custom answers are carried over',
      (second.body?.data?.profile?.customFields as any)?.college === 'GTU');

    await plantOtp(EMAIL);
    const already = await api('POST', `/events/${published.id}/registrations/verify-otp`,
      { email: EMAIL, code: CODE });
    check('already-registered is detected before the form',
      already.body?.data?.alreadyRegistered === true);
    check('the existing ticket is returned for recovery',
      typeof already.body?.data?.qrToken === 'string');

    // ── 5. Founder linkage ───────────────────────────────────────────────────
    section('5. Founder linkage');
    const founderUser = await prisma.user.create({
      data: {
        email: FOUNDER_EMAIL,
        role: 'STARTUP',
        name: 'E2E Founder',
        startupProfile: { create: { companyName: 'E2E Ventures Pvt Ltd', stage: 'SEED' } },
      },
    });
    created.userId = founderUser.id;

    await plantOtp(FOUNDER_EMAIL);
    const fVerify = await api('POST', `/events/${published.id}/registrations/verify-otp`,
      { email: FOUNDER_EMAIL, code: CODE });
    check('founder is recognised from the verified email',
      fVerify.body?.data?.founder?.startupName === 'E2E Ventures Pvt Ltd', fVerify.body?.data?.founder);

    const fReg = await api('POST', `/events/${published.id}/registrations`, {
      name: 'E2E Founder',
      verificationToken: fVerify.body?.data?.verificationToken,
      customFields: { college: 'N/A' },
    });
    check('founder registration succeeds', fReg.status === 201, fReg.body);
    const fStored = await prisma.eventRegistration.findUnique({ where: { id: fReg.body?.data?.id } });
    check('registration is stamped FOUNDER', fStored?.participantType === 'FOUNDER', fStored?.participantType);
    check('startup name is snapshotted', fStored?.startupName === 'E2E Ventures Pvt Ltd');

    // ── 6. Certificates ──────────────────────────────────────────────────────
    section('6. Certificates');
    let refused = false;
    try {
      await buildCertificate(published.id, regId);
    } catch {
      refused = true;
    }
    check('certificate is refused before check-in', refused);

    await prisma.eventRegistration.update({
      where: { id: regId },
      data: { checkedInAt: new Date() },
    });

    const cert = await buildCertificate(published.id, regId);
    check('certificate builds after check-in', Buffer.isBuffer(cert.buffer) && cert.buffer.length > 1000);
    check('output is a real PDF', cert.buffer.subarray(0, 4).toString() === '%PDF');
    check('certificate number is not guessable',
      /^GTUV-.+-\d{4}-[A-Z0-9]{4}$/.test(cert.certificateNo), cert.certificateNo);

    const again = await buildCertificate(published.id, regId);
    check('re-issuing keeps the same number', again.certificateNo === cert.certificateNo);

    const verify = await api('GET', `/events/certificates/verify/${encodeURIComponent(cert.certificateNo)}`);
    check('public verification returns the holder', verify.status === 200 &&
      verify.body?.data?.name === 'E2E Participant', verify.body);

    const bogus = await api('GET', '/events/certificates/verify/GTUV-NOPE-0001-ZZZZ');
    check('unknown certificate number 404s', bogus.status === 404, bogus.status);

  } catch (err) {
    // Captured rather than rethrown so cleanup still runs; the finally block
    // calls process.exit and would otherwise swallow it entirely.
    aborted = err;
  } finally {
    // ── Cleanup ──────────────────────────────────────────────────────────────
    section('Cleanup');
    // Raw SQL: a soft-delete middleware turns deleteMany into an UPDATE, which
    // would leave the test rows behind.
    for (const id of created.events) {
      await prisma.$executeRaw`DELETE FROM "EventRegistration" WHERE "eventId" = ${id}`;
      await prisma.$executeRaw`DELETE FROM "Event" WHERE "id" = ${id}`;
    }
    for (const mail of [EMAIL, FOUNDER_EMAIL]) {
      await prisma.$executeRaw`DELETE FROM "EventParticipant" WHERE "email" = ${mail}`;
      await prisma.$executeRaw`DELETE FROM "EventEmailOtp" WHERE "email" = ${mail}`;
    }
    if (created.userId) {
      await prisma.$executeRaw`DELETE FROM "StartupProfile" WHERE "userId" = ${created.userId}`;
      await prisma.$executeRaw`DELETE FROM "User" WHERE "id" = ${created.userId}`;
    }
    console.log('  test data removed');

    if (aborted) {
      console.error(`\nRun aborted: ${aborted?.message || aborted}`);
      if (String(aborted?.message || '').includes('fetch failed')) {
        console.error(`Is the dev server running on ${API}?`);
      }
    }
    console.log(`\n${passed} passed, ${failed} failed`);
    await prisma.$disconnect();
    process.exit(aborted || failed > 0 ? 1 : 0);
  }
}

main().catch(async (err) => {
  console.error('\nTest run aborted:', err);
  await prisma.$disconnect();
  process.exit(1);
});
