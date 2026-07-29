import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = 'admin@gtu.edu.in';
  const password = 'admin123';
  const hashedPassword = await bcrypt.hash(password, 10);

  // 1. Seed OrgRoles
  const roles = [
    { name: 'Super Admin', code: 'SUPER_ADMIN', description: 'Full system access' },
    { name: 'admin', code: 'ADMIN', description: 'Administrator access' },
    { name: 'staff', code: 'STAFF', description: 'Staff/Reviewer access' },
    { name: 'startup', code: 'STARTUP', description: 'Startup applicant access' },
  ];

  console.log('Seeding roles...');
  for (const role of roles) {
    await prisma.orgRole.upsert({
      where: { code: role.code },
      update: { name: role.name, description: role.description },
      create: role,
    });
  }

  const superAdminRole = await prisma.orgRole.findUnique({ where: { code: 'SUPER_ADMIN' } });

  // 2. Seed Super Admin User
  const admin = await prisma.user.upsert({
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
      isSetupComplete: true,
    },
  });

  // 3. Assign Role to User if not already assigned
  if (superAdminRole) {
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
  }

  console.log('Super Admin user created or updated:', admin);

  // 4. Seed default FinancialAccounts (Chart of Accounts)
  const defaultAccounts = [
    { name: "State Bank of India (Bank A/c)", type: "ASSET", code: "1001", description: "Primary GTU bank operational escrow account" },
    { name: "Accounts Receivable", type: "ASSET", code: "1002", description: "Outstanding coworking space rent and amenities invoices" },
    { name: "SISFS Grant Reserves", type: "RESERVE", code: "2001", description: "Committed reserves for Startup India Seed Fund Scheme" },
    { name: "NIDHI-SSS Grant Reserves", type: "RESERVE", code: "2002", description: "Committed reserves for Central DST Seed Support" },
    { name: "BIRAC LEAP Grant Reserves", type: "RESERVE", code: "2003", description: "Committed reserves for Biotech Ministry grants" },
    { name: "Government Grant Receipts", type: "REVENUE", code: "3001", description: "Inbound capital funding allocations received from central/state government" },
    { name: "Incubation Program Revenue", type: "REVENUE", code: "3002", description: "Incomes generated from incubation services and mentorship camps" },
    { name: "WiFi & Utility Recoveries", type: "REVENUE", code: "3003", description: "Rebilled utility fees collected from startup occupants" },
    { name: "Electricity & Utilities Cost", type: "EXPENSE", code: "4001", description: "Incubator electricity, water, and building maintenance bills" },
    { name: "Mentorship Expense", type: "EXPENSE", code: "4002", description: "Professional honorariums paid to expert coaches and pitch advisors" },
    { name: "Facility Maintenance Cost", type: "EXPENSE", code: "4003", description: "Day-to-day clean-up staff, hardware repairs, and logistics fees" },
    { name: "Audit & Legal Fees", type: "EXPENSE", code: "4004", description: "Professional audit certifications and corporate filing costs" },
    { name: "Startup Seed Grants Outflow", type: "EXPENSE", code: "4005", description: "Seed grants disbursed directly to incubated startup teams" }
  ];

  console.log("Seeding Chart of Accounts (FinancialAccount)...");
  for (const acc of defaultAccounts) {
    await prisma.financialAccount.upsert({
      where: { name: acc.name },
      update: { type: acc.type, code: acc.code, description: acc.description },
      create: acc,
    });
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
