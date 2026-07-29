import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@gtu.edu.in';
  const password = 'admin123';
  const hashedPassword = await bcrypt.hash(password, 10);

  console.log('--- Starting Super Admin Creation ---');

  try {
    // 1. Ensure Super Admin role exists
    console.log('Ensuring SUPER_ADMIN role exists...');
    const role = await prisma.orgRole.upsert({
      where: { code: 'SUPER_ADMIN' },
      update: {},
      create: {
        name: 'Super Admin',
        code: 'SUPER_ADMIN',
        description: 'Full system access',
      },
    });
    console.log(`Role: ${role.name} (${role.id})`);

    // 2. Create/Update the Admin User
    console.log(`Ensuring User ${email} exists...`);
    const admin = await prisma.user.upsert({
      where: { email },
      update: {
        password: hashedPassword,
        role: 'SUPER_ADMIN',
        isSetupComplete: true,
        isActive: true,
      },
      create: {
        email,
        password: hashedPassword,
        name: 'Super Admin',
        role: 'SUPER_ADMIN',
        isSetupComplete: true,
        isActive: true,
      },
    });
    console.log(`User: ${admin.email} (${admin.id})`);

    // 3. Link User to Role in UserRole table (RBAC)
    console.log('Linking user to role...');
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: admin.id,
          roleId: role.id,
        },
      },
      update: {},
      create: {
        userId: admin.id,
        roleId: role.id,
        isDefault: true,
      },
    });
    console.log('User linked to role successfully.');

    console.log('--- Super Admin Created Successfully! ---');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);

  } catch (error) {
    console.error('Error creating super admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
