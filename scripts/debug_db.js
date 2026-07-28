const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkApp() {
  try {
    const appId = '264087f7-b26d-4684-a294-665d4b7a43a5';
    const app = await prisma.startupApplication.findUnique({
      where: { id: appId },
      select: { currentLevel: true, status: true }
    });
    console.log(JSON.stringify(app));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

checkApp();
