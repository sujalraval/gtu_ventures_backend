/** Confirms the scheme-preference backfill produced sensible rows. Read-only. */
import prisma from '../src/lib/prisma';

async function main() {
  const apps = await prisma.startupApplication.count();
  const withScheme = await prisma.startupApplication.count({ where: { schemeId: { not: null } } });
  const withoutScheme = await prisma.startupApplication.count({ where: { schemeId: null } });
  const prefs = await prisma.applicationSchemePreference.count();
  const selected = await prisma.applicationSchemePreference.count({ where: { status: 'SELECTED' } });

  console.log(`applications:            ${apps}`);
  console.log(`  with a scheme:         ${withScheme}`);
  console.log(`  without (NULL):        ${withoutScheme}`);
  console.log(`scheme preference rows:  ${prefs}`);
  console.log(`  status SELECTED:       ${selected}`);

  // Every application that has a scheme should have a matching SELECTED row.
  const mismatched = await prisma.startupApplication.findMany({
    where: { schemeId: { not: null } },
    select: { id: true, applicationNo: true, schemeId: true, intent: true, schemePreferences: { select: { schemeId: true, status: true } } },
  });
  const bad = mismatched.filter(
    (a) => !a.schemePreferences.some((p) => p.schemeId === a.schemeId && p.status === 'SELECTED'),
  );
  console.log(`applications whose schemeId has no SELECTED preference: ${bad.length}`);
  for (const a of bad.slice(0, 5)) console.log(`  ${a.applicationNo || a.id} -> ${a.schemeId}`);

  const intents = await prisma.startupApplication.groupBy({ by: ['intent'], _count: true });
  console.log('intents:', intents.map((i: any) => `${i.intent}=${i._count}`).join(', '));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
