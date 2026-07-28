import { PrismaClient } from '@prisma/client';

// Use the existing prisma client if possible, or create a new one pointing to the same DB
const prisma = new PrismaClient();

async function main() {
  const id = '264087f7-b26d-4684-a294-665d4b7a43a5';
  
  try {
    const app = await prisma.startupApplication.findUnique({
      where: { id },
      include: { reviews: true }
    });
    
    if (!app) {
      console.log("Application not found");
      return;
    }
    
    console.log("Application State:");
    console.log(JSON.stringify({
      id: app.id,
      status: app.status,
      currentLevel: app.currentLevel,
      isFormASubmitted: app.isFormASubmitted,
      isFormAApproved: app.isFormAApproved,
      isFormBSubmitted: app.isFormBSubmitted,
      isFormBApproved: app.isFormBApproved,
      reviewsCount: app.reviews.length
    }, null, 2));
    
  } catch (err) {
    console.error("Error fetching application:", err);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
