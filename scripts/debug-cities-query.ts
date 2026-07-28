import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const stateId = 'f7635293-6a58-450f-a3e3-72782e5b4ce8'; // Gujarat
  
  const districts = await prisma.district.findMany({ where: { stateId } });
  console.log('Districts for state:', districts.length);
  
  if (districts.length > 0) {
    const districtIds = districts.map(d => d.id);
    const citiesByDistrictIds = await prisma.city.findMany({ 
      where: { districtId: { in: districtIds } } 
    });
    console.log('Cities by district IDs:', citiesByDistrictIds.length);
    
    const citiesByRelation = await prisma.city.findMany({
      where: {
        district: {
          stateId: stateId
        }
      }
    });
    console.log('Cities by relation:', citiesByRelation.length);
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
