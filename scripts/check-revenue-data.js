
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkData() {
  try {
    const totalCount = await prisma.startupApplication.count();
    const withData = await prisma.startupApplication.count({
      where: {
        AND: [
          { NOT: { revenueModel: null } },
          { NOT: { revenueModel: '' } }
        ]
      }
    });
    
    console.log(`Total Applications: ${totalCount}`);
    console.log(`Applications with revenueModel data: ${withData}`);
    
    if (withData > 0) {
      const examples = await prisma.startupApplication.findMany({
        where: {
          AND: [
            { NOT: { revenueModel: null } },
            { NOT: { revenueModel: '' } }
          ]
        },
        select: { revenueModel: true },
        take: 3
      });
      console.log('Sample data:', examples.map(e => e.revenueModel));
    }
  } catch (error) {
    console.error('Error checking data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();
