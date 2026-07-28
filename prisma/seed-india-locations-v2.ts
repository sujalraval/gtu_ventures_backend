import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const STATE_MAPPING: Record<string, string> = {
  "1": "Andhra Pradesh",
  "2": "Assam",
  "3": "Bihar",
  "4": "Gujarat",
  "5": "Haryana",
  "6": "Himachal Pradesh",
  "7": "Jammu and Kashmir",
  "8": "Karnataka",
  "9": "Kerala",
  "10": "Madhya Pradesh",
  "11": "Maharashtra",
  "12": "Manipur",
  "13": "Meghalaya",
  "14": "Nagaland",
  "15": "Odisha",
  "16": "Punjab",
  "17": "Rajasthan",
  "18": "Tamil Nadu",
  "19": "Tripura",
  "20": "Uttar Pradesh",
  "21": "West Bengal",
  "22": "Sikkim",
  "23": "Chhattisgarh",
  "24": "Jharkhand",
  "25": "Uttarakhand",
  "26": "Telangana",
  "31": "Andaman and Nicobar Islands",
  "32": "Arunachal Pradesh",
  "33": "Chandigarh",
  "34": "Dadra and Nagar Haveli",
  "35": "Delhi",
  "36": "Daman and Diu",
  "37": "Lakshadweep",
  "38": "Mizoram",
  "39": "Puducherry",
  "40": "Goa"
};

async function main() {
  console.log('--- Seeding Comprehensive All-India Locations ---');

  // 1. Ensure Country: India
  const india = await prisma.country.upsert({
    where: { name: 'India' },
    update: { code: 'IN' },
    create: { name: 'India', code: 'IN' }
  });

  // 2. Read Large JSON Data
  const jsonPath = path.join(__dirname, 'seed_data', 'locations.json');
  if (!fs.existsSync(jsonPath)) {
    console.error(`Error: Data file not found at ${jsonPath}`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(jsonPath, 'utf8');
  const data = JSON.parse(rawData);

  console.log(`Loaded ${data.length} district records.`);

  // 3. Process Data
  // Group by stateCode to minimize state upserts
  const stateGroups: Record<string, any[]> = {};
  for (const district of data) {
    const sc = district.stateCode;
    if (!stateGroups[sc]) stateGroups[sc] = [];
    stateGroups[sc].push(district);
  }

  for (const stateCode in stateGroups) {
    const stateName = STATE_MAPPING[stateCode] || `State Code ${stateCode}`;
    console.log(`Seeding State: ${stateName} (Code: ${stateCode})...`);

    const state = await prisma.state.upsert({
      where: { name_countryId: { name: stateName, countryId: india.id } },
      update: {},
      create: { name: stateName, countryId: india.id }
    });

    const districts = stateGroups[stateCode];

    for (const d of districts) {
      console.log(`  Seeding District: ${d.name}...`);
      const district = await prisma.district.upsert({
        where: { name_stateId: { name: d.name, stateId: state.id } },
        update: {},
        create: { name: d.name, stateId: state.id, pincodePrefixes: [] }
      });

      // Seeding Talukas/Blocks
      if (d.blockList && d.blockList.length > 0) {
        for (const block of d.blockList) {
          await prisma.city.upsert({
            where: { name_districtId: { name: block.name, districtId: district.id } },
            update: {},
            create: { name: block.name, districtId: district.id }
          });
        }
      } else {
        // Fallback for districts without blocks - create a generic "Main City" or same as district name
        await prisma.city.upsert({
          where: { name_districtId: { name: d.name, districtId: district.id } },
          update: {},
          create: { name: d.name, districtId: district.id }
        });
      }
    }
  }

  console.log('--- ALL-INDIA SEEDING COMPLETED SUCCESSFULY ---');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
