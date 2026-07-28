-- CreateTable
CREATE TABLE "ApplicationFunding" (
    "id" TEXT NOT NULL,
    "formBId" TEXT NOT NULL,
    "roundType" TEXT NOT NULL,
    "amountInr" DOUBLE PRECISION NOT NULL,
    "fundingDate" TIMESTAMP(3),
    "investors" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationFunding_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ApplicationFunding" ADD CONSTRAINT "ApplicationFunding_formBId_fkey" FOREIGN KEY ("formBId") REFERENCES "ApplicationFormB"("id") ON DELETE CASCADE ON UPDATE CASCADE;
