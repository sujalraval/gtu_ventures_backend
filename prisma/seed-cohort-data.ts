import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🚀 Starting Cohort data seeding...');

  // 1. Fetch context dependencies
  let admin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  let scheme = await prisma.scheme.findFirst({ where: { status: 'ACTIVE' } });
  
  // Fallback if no active scheme exists
  if (!scheme) {
      scheme = await prisma.scheme.findFirst();
  }

  if (!admin || !scheme) {
    console.error('❌ Prerequisite Failed: Ensure you have at least one User and one Scheme in database before seeding cohorts.');
    return;
  }

  console.log(`Found Admin: ${admin.email}, Scheme: ${scheme.name}`);

  const mockCohorts = [
    {
      name: "DeepTech Spring 2024",
      startDate: new Date("2024-01-15"),
      domain: "DeepTech",
      budget: 5000000,
      status: "Active",
      schemeId: scheme.id,
      managerId: admin.id
    },
    {
      name: "Women Entrepreneurs Batch 4",
      startDate: new Date("2024-03-01"),
      domain: "Tech Enabled",
      budget: 7500000,
      status: "Active",
      schemeId: scheme.id,
      managerId: admin.id
    }
  ];

  for (const c of mockCohorts) {
    const existing = await prisma.cohort.findFirst({ where: { name: c.name } });
    if (!existing) {
      await prisma.cohort.create({ data: c });
      console.log(`✅ Created Cohort: ${c.name}`);
    } else {
      console.log(`ℹ️ Cohort already exists: ${c.name}`);
    }
  }

  console.log('🏁 Finished seeding Cohorts successfully.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
