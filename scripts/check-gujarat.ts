import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const gujarat = await prisma.state.findFirst({
    where: { name: { contains: 'Gujarat', mode: 'insensitive' } },
    include: {
      districts: {
         include: {
           cities: true
         }
      }
    }
  });

  if (!gujarat) {
    console.log('Gujarat state not found');
  } else {
    console.log('State found:', gujarat.name, gujarat.id);
    console.log('Districts count:', gujarat.districts.length);
    gujarat.districts.forEach(d => {
       console.log(`District: ${d.name} (${d.id}), Cities count: ${d.cities.length}`);
    });
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
