import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2] || 'admin@gtu.edu.in';
  const password = process.argv[3] || 'admin123';
  const hashedPassword = await bcrypt.hash(password, 10);

  console.log(`Creating Super Admin user: ${email}...`);

  try {
    // 1. Get the SUPER_ADMIN Organization Role
    const superAdminRole = await prisma.orgRole.findUnique({
      where: { code: 'SUPER_ADMIN' },
    });

    if (!superAdminRole) {
      console.error('SUPER_ADMIN role not found. Please run seed.ts first.');
      return;
    }

    // 2. Create the User with SUPER_ADMIN system role
    const newAdmin = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: 'Super Admin',
        role: 'SUPER_ADMIN',
        isSetupComplete: true,
      },
    });

    // 3. Assign the OrgRole to the User
    await prisma.userRole.create({
      data: {
        userId: newAdmin.id,
        roleId: superAdminRole.id,
        isDefault: true,
      },
    });

    console.log(`\nSuccess! Super Admin created.`);
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);

  } catch (error: any) {
    if (error.code === 'P2002') {
      console.error(`Error: A user with email ${email} already exists.`);
    } else {
      console.error('Error creating super admin:', error);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
