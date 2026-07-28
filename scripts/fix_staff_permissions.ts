import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Fixing STAFF permissions...');

  // 1. Find the STAFF role
  const staffRole = await prisma.orgRole.findFirst({
    where: { 
      OR: [
        { code: 'STAFF' },
        { code: 'staff' },
        { name: 'Staff' },
        { name: 'STAFF' }
      ] 
    }
  });

  if (!staffRole) {
    console.error('STAFF role not found. Please ensure roles are seeded.');
    return;
  }

  console.log(`Found STAFF role with ID: ${staffRole.id}`);

  // 2. Find the applications module
  const appModule = await prisma.permissionModule.findUnique({
    where: { key: 'applications' }
  });

  if (!appModule) {
    console.error('Applications module not found. Please run seed_permissions_modules.ts first.');
    return;
  }

  // 3. Define modules and actions for STAFF
  const staffPermissions = [
    { key: 'dashboard', actions: ['view'] },
    { key: 'applications', actions: ['view', 'edit', 'approve'] },
    { key: 'evaluation', actions: ['view', 'edit'] },
    { key: 'grants', actions: ['view'] },
    { key: 'utilisation', actions: ['view'] },
    { key: 'milestones', actions: ['view'] },
    { key: 'startup_master', actions: ['view'] },
    { key: 'scheme_master', actions: ['view'] },
  ];

  for (const perm of staffPermissions) {
    const mod = await prisma.permissionModule.findUnique({
      where: { key: perm.key }
    });

    if (mod) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_moduleId: {
            roleId: staffRole.id,
            moduleId: mod.id,
          }
        },
        update: {
          actions: perm.actions,
        },
        create: {
          roleId: staffRole.id,
          moduleId: mod.id,
          actions: perm.actions,
        }
      });
      console.log(`Updated permissions for module: ${perm.key}`);
    } else {
      console.warn(`Module not found: ${perm.key}, skipping...`);
    }
  }

  console.log('\nSTAFF permissions updated successfully.');
  console.log('IMPORTANT: The user must LOG OUT and LOG IN again for the changes to take effect.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
