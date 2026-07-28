import prisma from '../lib/prisma';

async function check() {
  try {
    const apps = await prisma.startupApplication.findMany({
      select: { id: true, applicationNo: true, userId: true, startupName: true }
    });
    console.log('Total Apps:', apps.length);
    console.log('Apps:', JSON.stringify(apps, null, 2));
    
    const profiles = await prisma.startupProfile.findMany();
    console.log('Total Profiles:', profiles.length);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

check();
