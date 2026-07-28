require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const templates = await prisma.milestoneTemplate.findMany({ select: { id: true, title: true, grantId: true, isActive: true } });
  console.log('Templates:', JSON.stringify(templates, null, 2));
  const allocations = await prisma.startupGrantAllocation.findMany({ select: { id: true, code: true, grantId: true } });
  console.log('Allocations:', JSON.stringify(allocations, null, 2));
  const grants = await prisma.grant.findMany({ select: { id: true, name: true, code: true } });
  console.log('Grants:', JSON.stringify(grants, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
