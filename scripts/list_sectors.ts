import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const sectors = await prisma.sector.findMany({
    include: {
      subSectors: {
        orderBy: { name: 'asc' }
      }
    },
    orderBy: { name: 'asc' },
  });

  console.log('List of All Sectors and Subsectors:');
  sectors.forEach((sector) => {
    console.log(`- ${sector.name}`);
    sector.subSectors.forEach((subSector) => {
      console.log(`  - ${subSector.name}`);
    });
  });
}

main()
  .catch((e) => {
    console.error('Error listing sectors and subsectors:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
