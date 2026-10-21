/**
 * Grant the PCE permissions to one or more roles.
 *
 * Why this exists: PCE routes are now gated by `authorizePce`, which consults
 * the `pce_*` keys in Role Rights. Only SUPER_ADMIN bypasses that check, so a
 * role that has never been granted those keys loses access the moment the gate
 * goes live — and the keys seed *unticked*. Run this once for the roles that
 * should keep working, before or immediately after the deploy.
 *
 * It is additive and idempotent: existing actions on other modules are left
 * alone, and re-running changes nothing.
 *
 * Usage (from backend/):
 *   npx ts-node scripts/grant-pce-permissions.ts --list
 *   npx ts-node scripts/grant-pce-permissions.ts --role "Admin" --role "Programme Staff"
 *   npx ts-node scripts/grant-pce-permissions.ts --role "Admin" --actions view
 *   npx ts-node scripts/grant-pce-permissions.ts --role "Admin" --dry-run
 *
 * Bank details are deliberately excluded unless --include-bank is passed:
 * `pce_evaluator_bank` exposes account numbers, so it should be a decision
 * rather than something swept in by a bulk grant.
 */

// Loaded before prisma is required: src/lib/prisma reads process.env.DATABASE_URL
// at import time and throws if it is unset. The Prisma CLI loads .env on its own,
// but ts-node running a script does not, so without this the script dies on a
// missing DATABASE_URL even though .env has one.
import dotenv from 'dotenv';
dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error(
    [
      'DATABASE_URL is not set, and no .env in this directory supplies it.',
      'Run this from the backend directory (the one holding .env), or pass it inline:',
      '  DATABASE_URL="postgresql://..." npx ts-node scripts/grant-pce-permissions.ts --list',
    ].join('\n'),
  );
  process.exit(2);
}

// Required lazily so the check above runs first.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const prisma = require('../src/lib/prisma').default;

const argv = process.argv.slice(2);

const flagValues = (name: string): string[] => {
  const out: string[] = [];
  argv.forEach((a, i) => {
    if (a === `--${name}` && argv[i + 1]) out.push(argv[i + 1]);
    else if (a.startsWith(`--${name}=`)) out.push(a.slice(name.length + 3));
  });
  return out;
};
const hasFlag = (name: string) => argv.includes(`--${name}`);

const LIST = hasFlag('list');
const DRY = hasFlag('dry-run');
const INCLUDE_BANK = hasFlag('include-bank');
const roleNames = flagValues('role');
const actions = flagValues('actions').flatMap((a) => a.split(',')).filter(Boolean);
const ACTIONS = actions.length ? actions : ['view', 'edit'];

async function main() {
  let modules = await prisma.permissionModule.findMany({
    where: { key: { startsWith: 'pce_' } },
    select: { id: true, key: true, label: true },
    orderBy: { key: 'asc' },
  });

  if (modules.length === 0) {
    // Seeded rather than refused. The modules are normally created the first time
    // the Role Rights page loads roles, which makes this script depend on someone
    // having opened a screen first - a chicken-and-egg precisely when nobody can
    // open that screen because they have no permissions yet.
    console.log('No pce_* permission modules exist yet. Seeding them first.');
    const { permissionsService } = require('../src/modules/permissions/permissions.service');
    await permissionsService.seedDefaultModules();

    modules = await prisma.permissionModule.findMany({
      where: { key: { startsWith: 'pce_' } },
      select: { id: true, key: true, label: true },
      orderBy: { key: 'asc' },
    });
    if (modules.length === 0) {
      console.error('Seeding produced no pce_* modules. Check PERMISSION_MODULES in permissions.service.ts.');
      process.exit(1);
    }
    console.log(`Seeded ${modules.length} PCE permission modules.`);
  }

  const grantable = INCLUDE_BANK
    ? modules
    : modules.filter((m: any) => m.key !== 'pce_evaluator_bank');

  if (LIST || roleNames.length === 0) {
    const roles = await prisma.orgRole.findMany({
      select: {
        id: true,
        name: true,
        isActive: true,
        permissions: {
          where: { module: { key: { startsWith: 'pce_' } } },
          select: { module: { select: { key: true } }, actions: true },
        },
        _count: { select: { userRoles: true } },
      },
      orderBy: { name: 'asc' },
    });

    console.log(`\n${modules.length} PCE permission modules exist.\n`);
    console.log('Roles and what they currently hold for PCE:\n');
    roles.forEach((r: any) => {
      const held = r.permissions.length;
      console.log(
        `  ${r.name.padEnd(28)} ${String(r._count.userRoles).padStart(3)} user(s)  ` +
          `${held}/${modules.length} PCE modules${r.isActive ? '' : '  [inactive]'}`,
      );
    });
    console.log(
      '\nSUPER_ADMIN users bypass permissions entirely and are unaffected either way.',
    );
    console.log('\nTo grant:  --role "<name>"   (repeatable)\n');
    await prisma.$disconnect();
    return;
  }

  const roles = await prisma.orgRole.findMany({
    where: { name: { in: roleNames } },
    select: { id: true, name: true },
  });

  const missing = roleNames.filter((n) => !roles.some((r: any) => r.name === n));
  if (missing.length) {
    console.error(`No such role: ${missing.join(', ')}\nRun with --list to see the names.`);
    process.exit(1);
  }

  console.log(
    `\n${DRY ? '[dry run] ' : ''}Granting [${ACTIONS.join(', ')}] on ` +
      `${grantable.length} PCE modules to ${roles.length} role(s).`,
  );
  if (!INCLUDE_BANK) {
    console.log('Excluding pce_evaluator_bank — pass --include-bank to include it.\n');
  }

  for (const role of roles) {
    let added = 0;
    let widened = 0;
    let unchanged = 0;

    for (const mod of grantable) {
      const existing = await prisma.rolePermission.findUnique({
        where: { roleId_moduleId: { roleId: role.id, moduleId: mod.id } },
        select: { id: true, actions: true },
      });

      if (!existing) {
        if (!DRY) {
          await prisma.rolePermission.create({
            data: { roleId: role.id, moduleId: mod.id, actions: ACTIONS },
          });
        }
        added++;
        continue;
      }

      // Additive: never remove an action the role already had.
      const merged = Array.from(new Set([...existing.actions, ...ACTIONS]));
      if (merged.length === existing.actions.length) {
        unchanged++;
        continue;
      }
      if (!DRY) {
        await prisma.rolePermission.update({
          where: { id: existing.id },
          data: { actions: merged },
        });
      }
      widened++;
    }

    console.log(
      `  ${role.name.padEnd(28)} ${added} added, ${widened} widened, ${unchanged} already correct`,
    );
  }

  console.log(
    DRY
      ? '\nNothing was written. Re-run without --dry-run to apply.\n'
      : '\nDone. Users must sign in again: permissions are baked into the JWT at sign-in.\n',
  );

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
