import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'teststartup@gusec.edu.in';
  const password = 'password123';
  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: { role: 'STARTUP' },
    create: {
      email,
      password: hashedPassword,
      name: 'Test Startup',
      role: 'STARTUP',
      isSetupComplete: true,
    },
  });

  console.log('Startup user created/updated:', user.email);
}

main().catch(console.error).finally(() => prisma.$disconnect());
