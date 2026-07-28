import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const sectorsData = [
  {
    name: "Agriculture & Allied",
    subSectors: ["AgriTech", "Food Processing", "Dairy & Animal Husbandry", "Fisheries & Aquaculture", "Precision Farming", "Farm Mechanization"]
  },
  {
    name: "Healthcare & Life Sciences",
    subSectors: ["HealthTech", "Medical Devices", "Biotechnology", "Pharma & Diagnostics", "Telemedicine", "Wellness & Fitness"]
  },
  {
    name: "Education & Skill Development",
    subSectors: ["EdTech", "Skill Development", "Online Learning Platforms", "Assessment & Testing", "Vocational Training"]
  },
  {
    name: "Information Technology (IT) & ITES",
    subSectors: ["Software Development", "SaaS Platforms", "Cloud Computing", "Cyber Security", "Data Analytics", "ERP & MIS Systems"]
  },
  {
    name: "Artificial Intelligence & Emerging Tech",
    subSectors: ["Artificial Intelligence (AI)", "Machine Learning (ML)", "Blockchain", "Internet of Things (IoT)", "AR / VR / MR", "Robotics & Automation"]
  },
  {
    name: "FinTech",
    subSectors: ["Digital Payments", "Lending & Credit Platforms", "InsurTech", "RegTech", "WealthTech"]
  },
  {
    name: "Manufacturing & Industry 4.0",
    subSectors: ["Smart Manufacturing", "Industrial Automation", "Additive Manufacturing (3D Printing)", "Tooling & Machining", "Quality & Process Automation"]
  },
  {
    name: "CleanTech & Sustainability",
    subSectors: ["Renewable Energy", "Waste Management", "Water & Sanitation", "Electric Mobility", "Carbon Management", "ESG Solutions"]
  },
  {
    name: "Energy",
    subSectors: ["Solar & Wind", "Energy Storage", "Smart Grid", "Bioenergy", "Hydrogen Technologies"]
  },
  {
    name: "Mobility & Transportation",
    subSectors: ["EV & Charging Infrastructure", "Autonomous Vehicles", "Logistics Tech", "Fleet Management", "Smart Transportation"]
  },
  {
    name: "Retail & E-Commerce",
    subSectors: ["Marketplaces", "D2C Brands", "Retail Tech", "Supply Chain Platforms"]
  },
  {
    name: "Logistics & Supply Chain",
    subSectors: ["Warehousing", "Cold Chain", "Last-Mile Delivery", "Supply Chain Analytics"]
  },
  {
    name: "Media, Entertainment & Gaming",
    subSectors: ["Digital Media", "OTT Platforms", "Gaming & eSports", "Content Creation Tools"]
  },
  {
    name: "Tourism, Travel & Hospitality",
    subSectors: ["TravelTech", "Hospitality Management", "Experience Platforms", "Smart Tourism"]
  },
  {
    name: "Real Estate & Construction (PropTech)",
    subSectors: ["Property Management", "Construction Tech", "Smart Buildings", "Infrastructure Tech"]
  },
  {
    name: "Fashion, Textile & Lifestyle",
    subSectors: ["Apparel Tech", "Textile Innovation", "Handloom & Craft Tech", "Sustainable Fashion"]
  },
  {
    name: "Social Impact & Rural Innovation",
    subSectors: ["Livelihood Generation", "Women Empowerment", "Rural Development", "Inclusive Technologies"]
  },
  {
    name: "GovTech & Civic Innovation",
    subSectors: ["e-Governance", "Public Service Platforms", "Smart City Solutions", "Digital Identity & Records"]
  },
  {
    name: "LegalTech",
    subSectors: ["Legal Automation", "Compliance Platforms", "Contract Management", "IP & Trademark Tech"]
  },
  {
    name: "Defense & Aerospace",
    subSectors: ["Defense Electronics", "UAV / Drones", "Aerospace Components", "Surveillance Systems"]
  },
  {
    name: "Chemical & Materials",
    subSectors: ["Specialty Chemicals", "Advanced Materials", "Nanotechnology", "Polymers & Composites"]
  },
  {
    name: "Electronics & Hardware",
    subSectors: ["Embedded Systems", "Semiconductor Design", "Consumer Electronics", "IoT Hardware"]
  },
  {
    name: "FoodTech",
    subSectors: ["Cloud Kitchens", "Packaged Foods", "Alternative Proteins", "Nutrition Tech"]
  },
  {
    name: "SportsTech",
    subSectors: ["Sports Analytics", "Fitness Devices", "Athlete Management", "eSports Platforms"]
  },
  {
    name: "Other / Emerging Sector",
    subSectors: ["Emerging Innovations", "Cross-Sector Solutions"]
  }
];


async function main() {
  console.log('Starting comprehensive seeding of sectors and subsectors...');

  // Optional: Mark previous ones as inactive if they are not in the new list?
  // For now, we just add the new ones to ensure both are available if needed.

  for (const sectorData of sectorsData) {
    // 1. Create or Find Sector
    const sector = await prisma.sector.upsert({
      where: { name: sectorData.name },
      update: { isActive: true }, 
      create: {
        name: sectorData.name,
        isActive: true,
      },
    });

    console.log(`Sector: ${sector.name} (${sector.id})`);

    // 2. Create or Find SubSectors
    for (const subSectorName of sectorData.subSectors) {
      await prisma.subSector.upsert({
        where: {
          name_sectorId: {
            name: subSectorName,
            sectorId: sector.id,
          },
        },
        update: { isActive: true },
        create: {
          name: subSectorName,
          sectorId: sector.id,
          isActive: true,
        },
      });
      console.log(`  - SubSector: ${subSectorName}`);
    }
  }

  console.log('Comprehensive seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding sectors and subsectors:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
