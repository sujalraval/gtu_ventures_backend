import 'dotenv/config';
import prisma from '../src/lib/prisma';
import { SchemeStatus } from '@prisma/client';

async function main() {
  console.log('Seeding default scheme...');
  const existing = await prisma.scheme.findFirst();
  if (existing) {
    console.log('Scheme already exists:', existing.name);
    return;
  }

  const scheme = await prisma.scheme.create({
    data: {
      id: "a3a84be0-b2f4-4c91-88df-d2b7b250c337",
      name: "Startup India Seed Fund Scheme (SISFS)",
      code: "SCH-2026-001",
      type: "GRANT",
      providedBy: "DPIIT",
      organizationName: "Startup India",
      categories: ["General", "OBC", "SC/ST", "Women Entrepreneurs"],
      sectors: ["Healthcare", "Agriculture", "DeepTech", "SaaS", "Education"],
      departments: ["Incubation", "Finance"],
      description: "Financial assistance to early-stage startups for proof of concept, prototype development, product trials, market entry, and commercialization.",
      objectives: "To provide financial assistance to startups for proof of concept, prototype development, product trials, market entry and commercialization.",
      eligibility: "Startups must be registered with DPIIT and incorporated not more than 2 years ago.",
      targetBeneficiaries: ["Early-stage startups", "Student entrepreneurs"],
      totalBudget: 10000000,
      maxGrant: 500000,
      fundingType: ["Milestone-based", "Tranche-based"],
      status: SchemeStatus.ACTIVE,
    }
  });

  console.log('Default scheme seeded successfully:', scheme.name);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
