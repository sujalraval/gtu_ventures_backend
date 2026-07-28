import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const countriesCount = await prisma.country.count();
  const statesCount = await prisma.state.count();
  const districtsCount = await prisma.district.count();
  const citiesCount = await prisma.city.count();

  console.log('Countries count:', countriesCount);
  console.log('States count:', statesCount);
  console.log('Districts count:', districtsCount);
  console.log('Cities count:', citiesCount);

  if (statesCount > 0) {
    const states = await prisma.state.findMany({ take: 5, include: { _count: { select: { districts: true } } } });
    console.log('Sample states:', JSON.stringify(states, null, 2));

    for (const state of states) {
        if (state._count.districts > 0) {
            const districts = await prisma.district.findMany({
                where: { stateId: state.id },
                take: 5,
                include: { _count: { select: { cities: true } } }
            });
            console.log(`Districts for ${state.name}:`, JSON.stringify(districts, null, 2));
        }
    }
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
