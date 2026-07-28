import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

import bcrypt from 'bcryptjs';
import { Pool } from 'pg';

import { PrismaPg } from '@prisma/adapter-pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });


async function createSuperAdmin() {
  const email = 'admin@gtu.edu.in';
  const password = 'admin123';
  const hashedPassword = await bcrypt.hash(password, 10);

  console.log('Creating super admin role...');
  const superAdminRole = await prisma.orgRole.upsert({
    where: { code: 'SUPER_ADMIN' },
    update: {},
    create: {
      name: 'Super Admin',
      code: 'SUPER_ADMIN',
      description: 'Full system access',
    },
  });

  console.log('Creating super admin user...');
  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      password: hashedPassword,
      role: 'SUPER_ADMIN',
      isSetupComplete: true,
      isActive: true
    },
    create: {
      email,
      password: hashedPassword,
      name: 'Super Admin',
      role: 'SUPER_ADMIN',
      isSetupComplete: true,
      isActive: true
    },
  });

  console.log('Assigning role to user...');
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: admin.id,
        roleId: superAdminRole.id,
      },
    },
    update: {},
    create: {
      userId: admin.id,
      roleId: superAdminRole.id,
      isDefault: true,
    },
  });

  console.log('Super Admin user created successfully:', admin.email);
}

createSuperAdmin()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
