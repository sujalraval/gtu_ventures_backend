import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- SYNCING USER ROLES ---');

  // 1. Get all roles
  const allRoles = await prisma.orgRole.findMany();
  console.log(`Found ${allRoles.length} roles in OrgRole table.`);

  // 2. Get all users who are not STARTUP (since startups use a different permission path)
  const users = await prisma.user.findMany({
    where: {
      role: { not: 'STARTUP' },
      deletedAt: null
    },
    include: {
      userRoles: true
    }
  });

  console.log(`Checking ${users.length} administrative users...`);

  let fixCount = 0;

  for (const user of users) {
    // If user has NO userRoles, we need to fix it
    if (user.userRoles.length === 0) {
      console.log(`User ${user.email} (Current Role: ${user.role}) has no UserRole mapping. Fixing...`);
      
      // Find the corresponding OrgRole
      const matchingRole = allRoles.find(r => r.code.toUpperCase() === user.role.toUpperCase());
      
      if (matchingRole) {
        await prisma.userRole.create({
          data: {
            userId: user.id,
            roleId: matchingRole.id,
            isDefault: true
          }
        });
        console.log(`  - Linked to OrgRole: ${matchingRole.name} (${matchingRole.id})`);
        fixCount++;
      } else {
        console.error(`  - Could not find matching OrgRole for code: ${user.role}`);
      }
    } else {
      console.log(`User ${user.email} already has ${user.userRoles.length} role mapping(s).`);
    }
  }

  console.log(`\nDONE: Fixed ${fixCount} user mappings.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
