import { config } from 'dotenv';
config();

import prisma from '../lib/prisma';
import bcrypt from 'bcryptjs';

async function main() {
  const email = 'admin@gtu.edu.in';
  const password = 'admin123';
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const user = await (prisma as any).user.upsert({
      where: { email },
      update: {
        password: hashedPassword,
        role: 'SUPER_ADMIN',
      },
      create: {
        email,
        password: hashedPassword,
        name: 'Super Admin',
        role: 'SUPER_ADMIN',
        isActive: true,
        isSetupComplete: true
      },
    });

    console.log('Super admin created or updated successfully:', user.email);
  } catch (err: any) {
    console.error('Error creating user:', err.message);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
