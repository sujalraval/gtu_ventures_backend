-- CreateTable
CREATE TABLE "ScorecardCriteria" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "maxScore" INTEGER NOT NULL DEFAULT 10,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "position" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScorecardCriteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JudgeAssignment" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "judgeId" TEXT NOT NULL,
    "startupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JudgeAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StartupScore" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "criteriaId" TEXT NOT NULL,
    "judgeId" TEXT NOT NULL,
    "startupId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "comment" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StartupScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScorecardCriteria_eventId_idx" ON "ScorecardCriteria"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "ScorecardCriteria_eventId_name_key" ON "ScorecardCriteria"("eventId", "name");

-- CreateIndex
CREATE INDEX "JudgeAssignment_eventId_idx" ON "JudgeAssignment"("eventId");

-- CreateIndex
CREATE INDEX "JudgeAssignment_judgeId_idx" ON "JudgeAssignment"("judgeId");

-- CreateIndex
CREATE UNIQUE INDEX "JudgeAssignment_eventId_judgeId_startupId_key" ON "JudgeAssignment"("eventId", "judgeId", "startupId");

-- CreateIndex
CREATE INDEX "StartupScore_eventId_idx" ON "StartupScore"("eventId");

-- CreateIndex
CREATE INDEX "StartupScore_judgeId_idx" ON "StartupScore"("judgeId");

-- CreateIndex
CREATE INDEX "StartupScore_startupId_idx" ON "StartupScore"("startupId");

-- CreateIndex
CREATE UNIQUE INDEX "StartupScore_eventId_criteriaId_judgeId_startupId_key" ON "StartupScore"("eventId", "criteriaId", "judgeId", "startupId");

-- AddForeignKey
ALTER TABLE "ScorecardCriteria" ADD CONSTRAINT "ScorecardCriteria_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgeAssignment" ADD CONSTRAINT "JudgeAssignment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgeAssignment" ADD CONSTRAINT "JudgeAssignment_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StartupScore" ADD CONSTRAINT "StartupScore_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StartupScore" ADD CONSTRAINT "StartupScore_criteriaId_fkey" FOREIGN KEY ("criteriaId") REFERENCES "ScorecardCriteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StartupScore" ADD CONSTRAINT "StartupScore_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StartupScore" ADD CONSTRAINT "StartupScore_startupId_fkey" FOREIGN KEY ("startupId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
