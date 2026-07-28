import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Seeding Districts and Talukas for Gujarat ---');

  // 1. Find the state of Gujarat (assuming India is already there)
  const gujarat = await prisma.state.findFirst({
    where: { name: 'Gujarat' }
  });

  if (!gujarat) {
    console.error('Gujarat state not found. Please ensure states are seeded first.');
    return;
  }

  // 2. Define some sample Districts and their Talukas
  const sampleData = [
    {
      district: 'Ahmedabad',
      talukas: ['Ahmedabad City', 'Bavla', 'Daskroi', 'Detroj-Rampura', 'Dhandhuka', 'Dholera', 'Dholka', 'Mandal', 'Sanand', 'Viramgam']
    },
    {
      district: 'Gandhinagar',
      talukas: ['Gandhinagar', 'Kalol', 'Dehgam', 'Mansa']
    },
    {
      district: 'Vadodara',
      talukas: ['Vadodara', 'Dabhoi', 'Karjan', 'Padra', 'Savli', 'Sinor', 'Vaghodia', 'Desar']
    },
    {
      district: 'Surat',
      talukas: ['Surat', 'Bardoli', 'Choryasi', 'Kamrej', 'Mahuva', 'Mandvi', 'Olpad', 'Palsana', 'Umarpada']
    },
    {
      district: 'Rajkot',
      talukas: ['Rajkot', 'Gondal', 'Jetpur', 'Dhoraji', 'Kotda Sangani', 'Lodhika', 'Paddhari', 'Upleta', 'Vinchhiya', 'Jasdan']
    }
  ];

  for (const item of sampleData) {
    console.log(`Seeding District: ${item.district}...`);
    
    // Create or Update District
    const district = await prisma.district.upsert({
      where: {
        name_stateId: {
          name: item.district,
          stateId: gujarat.id
        }
      },
      update: {},
      create: {
        name: item.district,
        stateId: gujarat.id
      }
    });

    // Create Talukas (Cities)
    for (const talukaName of item.talukas) {
      await prisma.city.upsert({
        where: {
          name_districtId: {
            name: talukaName,
            districtId: district.id
          }
        },
        update: {},
        create: {
          name: talukaName,
          districtId: district.id
        }
      });
    }
  }

  console.log('--- Seeding Completed successfully ---');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
