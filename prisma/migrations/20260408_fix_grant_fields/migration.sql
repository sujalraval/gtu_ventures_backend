-- Redundant: Columns and indexes already exist in 0_init
-- ALTER TABLE "GrantReceipt" ADD COLUMN "code" TEXT;
-- CREATE UNIQUE INDEX "GrantReceipt_code_key" ON "GrantReceipt"("code");

-- -- AlterTable
-- ALTER TABLE "GrantAllocation" ADD COLUMN "remarks" TEXT;
-- ALTER TABLE "GrantAllocation" ADD COLUMN "code" TEXT;
-- CREATE UNIQUE INDEX "GrantAllocation_code_key" ON "GrantAllocation"("code");
