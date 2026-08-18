-- CreateTable
CREATE TABLE "EventEmailOtp" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventEmailOtp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventEmailOtp_email_idx" ON "EventEmailOtp"("email");

-- CreateIndex
CREATE INDEX "EventEmailOtp_expiresAt_idx" ON "EventEmailOtp"("expiresAt");
