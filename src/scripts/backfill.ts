import prisma from '../lib/prisma';

async function backfill() {
  console.log('Starting backfill for Receipts and Allocations...');

  // 1. Backfill GrantReceipts
  const receipts = await prisma.grantReceipt.findMany({
    where: { code: null },
    orderBy: { createdAt: 'asc' }
  });

  console.log(`Found ${receipts.length} receipts to update.`);
  for (let i = 0; i < receipts.length; i++) {
    const code = `REC-2024-${(i + 1).toString().padStart(3, '0')}`;
    await prisma.grantReceipt.update({
      where: { id: receipts[i].id },
      data: { code }
    });
    console.log(`Updated receipt ${receipts[i].id} -> ${code}`);
  }

  // 2. Backfill GrantAllocations
  const allocations = await prisma.grantAllocation.findMany({
    where: { code: null },
    orderBy: { createdAt: 'asc' }
  });

  console.log(`Found ${allocations.length} allocations to update.`);
  for (let i = 0; i < allocations.length; i++) {
    const code = `ALC-2024-${(i + 1).toString().padStart(3, '0')}`;
    await prisma.grantAllocation.update({
      where: { id: allocations[i].id },
      data: { code }
    });
    console.log(`Updated allocation ${allocations[i].id} -> ${code}`);
  }

  console.log('Backfill completed successfully.');
}

backfill()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
