import 'dotenv/config';
import prisma from './lib/prisma';

async function main() {
  const heads = [
    "Seed Funding",
    "Infrastructure",
    "Operational Expenses",
    "Startup Support Programs",
    "Mentorship & Training",
    "Marketing & Outreach"
  ];

  console.log('Seeding default Allocation Heads into PG...');
  for (const name of heads) {
    try {
      await prisma.allocationHeadMaster.upsert({
        where: { name },
        update: { deletedAt: null },
        create: { name }
      });
      console.log(`✅ Seeded: ${name}`);
    } catch (e: any) {
      console.error(`❌ Error seeding ${name}:`, e.message);
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
