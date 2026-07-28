import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Fixing role codes...");
  const roles = await prisma.orgRole.findMany();
  for (const role of roles) {
    const code = role.name.toUpperCase().replace(/\s/g, "_");
    await prisma.orgRole.update({
      where: { id: role.id },
      data: { code },
    });
    console.log(`Updated role ${role.name} to ${code}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
