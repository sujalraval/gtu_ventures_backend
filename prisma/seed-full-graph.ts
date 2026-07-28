import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🚀 Deep Seeding starting for full monitoring capabilities...');

  let admin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  let scheme = await prisma.scheme.findFirst();

  if (!admin || !scheme) {
    console.error('❌ Must have Admin and Scheme existing.');
    return;
  }

  // 1. Upsert Cohort
  const cohort = await prisma.cohort.upsert({
    where: { id: 'mock-cohort-dt-2024' },
    update: {},
    create: {
      id: 'mock-cohort-dt-2024',
      name: "DeepTech Spring 2024",
      startDate: new Date("2024-01-01"),
      domain: "DeepTech",
      budget: 5000000,
      schemeId: scheme.id,
      managerId: admin.id
    }
  });

  // 2. Create Mock Startup User
  const startupUser = await prisma.user.upsert({
    where: { email: 'founder1@lexa-ai.com' },
    update: {},
    create: {
      email: 'founder1@lexa-ai.com',
      name: "Lexa AI Founder",
      role: 'STARTUP',
      isSetupComplete: true
    }
  });

  // 3. Create Application mapped to Cohort
  const app = await prisma.startupApplication.upsert({
    where: { userId: startupUser.id },
    update: { cohortId: cohort.id },
    create: {
      userId: startupUser.id,
      schemeId: scheme.id,
      startupName: "Lexa AI Solutions",
      email: startupUser.email,
      mobile: "9876543210",
      cohortId: cohort.id,
      status: 'APPROVED',
      isFormBApproved: true,
      isFormCApproved: true,
      isFormDApproved: true,
      isFormESubmitted: true
    }
  });

  // 4. Create Grant Allocation
  const allocation = await prisma.startupGrantAllocation.upsert({
    where: { applicationId: app.id },
    update: {},
    create: {
      applicationId: app.id,
      sanctionedAmount: 1000000,
      totalUtilised: 150000,
      currentTrancheIndex: 1
    }
  });

  // 5. Prepare Categories
  await prisma.milestoneCategory.upsert({
    where: { name: "Technology Development" },
    update: {},
    create: { name: "Technology Development", color: "bg-blue-500" }
  });
  await prisma.milestoneCategory.upsert({
    where: { name: "Operations" },
    update: {},
    create: { name: "Operations", color: "bg-indigo-500" }
  });

  // 5. Tranche 1
  const tranche1 = await prisma.startupGrantTranche.create({
    data: {
      allocationId: allocation.id,
      installmentNo: 1,
      sanctionedAmount: 300000,
      releasedAmount: 300000,
      status: 'Paid',
      paymentDate: new Date("2024-02-01")
    }
  });

  // Milestone for Tranche 1
  const m1 = await prisma.milestone.create({
    data: {
      startupId: startupUser.id,
      trancheId: tranche1.id,
      title: "R&D and Alpha Prototyping",
      categoryName: "Technology Development", // Existing default assumption
      plannedStart: new Date("2024-02-01"),
      plannedEnd: new Date("2024-04-01"),
      status: 'COMPLETED',
      allocatedFund: 300000,
      utilizedFund: 300000
    }
  });

  // Add SPR under Milestone
  await prisma.startupProgressReport.create({
    data: {
      startupId: startupUser.id,
      milestoneId: m1.id,
      period: "Quarterly",
      submissionDate: new Date("2024-03-15"),
      status: 'APPROVED',
      productStatus: "Alpha Done"
    }
  });

  // 6. Tranche 2 (Active)
  const tranche2 = await prisma.startupGrantTranche.create({
    data: {
      allocationId: allocation.id,
      installmentNo: 2,
      sanctionedAmount: 300000,
      releasedAmount: 0,
      status: 'Active'
    }
  });

  const m2 = await prisma.milestone.create({
    data: {
      startupId: startupUser.id,
      trancheId: tranche2.id,
      title: "Beta Testing and Hiring",
      categoryName: "Operations",
      plannedStart: new Date("2024-05-01"),
      plannedEnd: new Date("2024-07-01"),
      status: 'IN_PROGRESS',
      allocatedFund: 300000
    }
  });
  
  // Incomplete SPR under it
  await prisma.startupProgressReport.create({
    data: {
      startupId: startupUser.id,
      milestoneId: m2.id,
      period: "Monthly",
      submissionDate: new Date(),
      status: 'SUBMITTED'
    }
  });

  console.log('🎉 Seeding complete with nested relational graph!');
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
