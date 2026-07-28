import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const id = '264087f7-b26d-4684-a294-665d4b7a43a5';
  const app = await prisma.startupApplication.findUnique({
    where: { id },
    include: { reviews: true }
  });
  console.log(JSON.stringify(app, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
