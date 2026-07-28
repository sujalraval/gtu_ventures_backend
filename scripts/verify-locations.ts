import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const states = await prisma.state.count();
  const districts = await prisma.district.count();
  const cities = await prisma.city.count();

  console.log(`Summary Counts:`);
  console.log(`- States: ${states}`);
  console.log(`- Districts: ${districts}`);
  console.log(`- Cities (Talukas): ${cities}`);

  console.log('\n--- Sample Verification: AHMADABAD (Gujarat) ---');
  const gujarat = await prisma.state.findFirst({ where: { name: 'Gujarat' } });
  if (gujarat) {
    const ahmedabad = await prisma.district.findFirst({
      where: { name: 'AHMADABAD', stateId: gujarat.id },
      include: { cities: true }
    });
    if (ahmedabad) {
      console.log(`Ahmedabad Talukas (${ahmedabad.cities.length}):`);
      console.log(ahmedabad.cities.map(c => c.name).slice(0, 15).join(', '));
    } else {
      console.log('Ahmedabad district not found!');
    }
  }

  console.log('\n--- Sample Verification: PUNE (Maharashtra) ---');
  const maharashtra = await prisma.state.findFirst({ where: { name: 'Maharashtra' } });
  if (maharashtra) {
    const pune = await prisma.district.findFirst({
      where: { name: 'PUNE', stateId: maharashtra.id },
      include: { cities: true }
    });
    if (pune) {
      console.log(`Pune Talukas (${pune.cities.length}):`);
      console.log(pune.cities.map(c => c.name).slice(0, 15).join(', '));
    } else {
      console.log('Pune district not found!');
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
