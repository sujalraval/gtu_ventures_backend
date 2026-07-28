import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const schemes = await prisma.scheme.findMany({
    select: { id: true, name: true, sectors: true }
  });
  console.log(JSON.stringify(schemes, null, 2));
}
main().finally(() => prisma.$disconnect());
