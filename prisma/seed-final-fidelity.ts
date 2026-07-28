import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🚀 Bulletproof Seeding starting...');

  let admin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  let scheme = await prisma.scheme.findFirst();
  let grant = await prisma.grant.findFirst();

  if (!admin || !scheme) {
    console.error('❌ Critical Error: You must have an admin user and a scheme created to seed test cohorts.');
    return;
  }

  // Fallback if grant is missing. Create dummy grant linked to scheme
  if (!grant) {
     console.log("Creating mock parent grant container...");
     grant = await prisma.grant.create({
        data: {
           name: "Standard Innovation Fund",
           code: "STD-INNV-001",
           type: "SEED_SUPPORT",
           source: "GUSEC",
           agency: "SSIP",
           schemeId: scheme.id,
           totalAmount: 10000000,
           maxPerStartup: 500000,
           cycle: "Annual",
           fy: "2026-27",
           startDate: new Date(),
           endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        }
     });
  }

  // 1. Ensure the Cohort
  const targetCohortName = "Women Entrepreneurs Batch 4";
  let cohort = await prisma.cohort.findFirst({ where: { name: targetCohortName } });
  if (!cohort) {
    console.log("Creating operational cohort container...");
    cohort = await prisma.cohort.create({
      data: {
        name: targetCohortName,
        startDate: new Date(),
        domain: "Tech Enabled",
        budget: 7500000,
        schemeId: scheme.id,
        managerId: admin.id
      }
    });
  }

  // 2. Create Dummy Founder with required Startup User role
  const email = "testfounder@incubation.com";
  const startupUser = await prisma.user.upsert({
     where: { email },
     update: {},
     create: {
        email,
        name: "Sneha Sharma",
        role: "STARTUP",
        isSetupComplete: true
     }
  });

  // 3. Create Full Bulletproof StartupApplication mapped to this Cohort
  // MUST provide all required strings from the PostgreSQL schema constraint definitions.
  let app = await prisma.startupApplication.findFirst({ where: { userId: startupUser.id } });
  if (!app) {
     console.log("Building robust StartupApplication graph...");
     app = await prisma.startupApplication.create({
        data: {
           userId: startupUser.id,
           schemeId: scheme.id,
           cohortId: cohort.id,
           startupName: "Aura Health Tech",
           status: "APPROVED",
           fullName: "Sneha Sharma",
           designation: "CEO",
           email: email,
           mobile: "9123456789",
           primaryEmail: email,
           primaryMobile: "9123456789",
           aadhaar: "123456789012",
           gender: "Female",
           dob: new Date("1995-01-01"),
           highestQualification: "B.Tech",
           fromInstitution: "Gujarat University",
           addressLine: "Incubation Center, Block 4",
           city: "Ahmedabad",
           district: "Ahmedabad",
           state: "Gujarat",
           pinCode: "380009",
           mainSector: "Healthcare",
           stage: "PROTOTYPE",
           briefAbout: "Developing affordable biosensors.",
           problemStmt: "High cost of rural diagnostics.",
           solution: "Compact IoT diagnostic stick.",
           isFormBApproved: true,
           isFormCApproved: true,
           isFormBSubmitted: true
        }
     });
  } else {
     // update existing application to the cohort
     app = await prisma.startupApplication.update({
        where: { id: app.id },
        data: { cohortId: cohort.id }
     });
  }

  // 4. Create the Grant Allocation mapped to application
  let alloc = await prisma.startupGrantAllocation.findUnique({ where: { applicationId: app.id } });
  if (!alloc) {
     console.log("Allocating funds registry...");
     alloc = await prisma.startupGrantAllocation.create({
        data: {
           applicationId: app.id,
           grantId: grant.id,
           sanctionedAmount: 500000,
           sanctionDate: new Date(),
           status: "Approved",
           totalReleased: 200000,
           totalUtilised: 45000
        }
     });
  }

  // 5. Check for Categories needed for Milestones
  await prisma.milestoneCategory.upsert({ where: { name: "Technology Development" }, update:{}, create: { name: "Technology Development", color: "bg-blue-500" } });
  await prisma.milestoneCategory.upsert({ where: { name: "Marketing" }, update:{}, create: { name: "Marketing", color: "bg-green-500" } });

  // 6. Inject Tranches
  const trancheCount = await prisma.startupGrantTranche.count({ where: { allocationId: alloc.id } });
  if (trancheCount === 0) {
     console.log("Provisioning installment matrix...");
     // Installment 1
     const t1 = await prisma.startupGrantTranche.create({
        data: {
           allocationId: alloc.id,
           installmentNo: 1,
           amount: 200000,
           status: "Paid",
           paymentDate: new Date("2024-02-10"),
           utr: "BANK-UTR-TEST-123"
        }
     });

     // Link Milestone to Tranche 1
     const m1 = await prisma.milestone.create({
        data: {
           startupId: startupUser.id,
           trancheId: t1.id,
           title: "Hardware Engineering & Alpha v1",
           categoryName: "Technology Development",
           plannedStart: new Date("2024-02-15"),
           plannedEnd: new Date("2024-04-15"),
           status: "COMPLETED",
           allocatedFund: 200000,
           utilizedFund: 200000
        }
     });

     // Link SPR to Milestone 1
     await prisma.startupProgressReport.create({
        data: {
           startupId: startupUser.id,
           milestoneId: m1.id,
           period: "Monthly",
           submissionDate: new Date("2024-03-10"),
           status: "APPROVED"
        }
     });

     // Installment 2
     const t2 = await prisma.startupGrantTranche.create({
        data: {
           allocationId: alloc.id,
           installmentNo: 2,
           amount: 300000,
           status: "Active",
        }
     });

     const m2 = await prisma.milestone.create({
        data: {
           startupId: startupUser.id,
           trancheId: t2.id,
           title: "Pilot Beta Trials",
           categoryName: "Technology Development",
           plannedStart: new Date("2024-05-01"),
           plannedEnd: new Date("2024-08-01"),
           status: "IN_PROGRESS",
           allocatedFund: 300000
        }
     });

     // Pending SPR under it
     await prisma.startupProgressReport.create({
        data: {
           startupId: startupUser.id,
           milestoneId: m2.id,
           period: "Quarterly",
           submissionDate: new Date(),
           status: "SUBMITTED"
        }
     });
  }

  console.log('🎉 MISSION COMPLETE: Relational graph fully constructed. The frontend should exhibit 100% fidelity now!');
}

main()
  .catch(e => { console.error("💥 FAILED TO SEED:", e); })
  .finally(async () => await prisma.$disconnect());
