-- A judge's written verdict on one startup in a screening round.
--
-- Scores already live in StartupScore, one row per criterion. This holds the
-- part that belongs to no criterion — the overall note and USP observation the
-- Form A review asked for — kept per judge so the panel chair reads each
-- opinion separately rather than one merged blob.
--
-- Keyed on the startup's User id, matching StartupScore, so the two aggregate
-- together without a translation step.

-- CreateTable
CREATE TABLE "ScreeningJudgeNote" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "judgeId" TEXT NOT NULL,
    "startupId" TEXT NOT NULL,
    "note" TEXT,
    "uspNote" TEXT,
    "recommendation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScreeningJudgeNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: one verdict per judge per startup per round, so saving again
-- updates rather than appends.
CREATE UNIQUE INDEX "ScreeningJudgeNote_eventId_judgeId_startupId_key"
  ON "ScreeningJudgeNote"("eventId", "judgeId", "startupId");

-- CreateIndex
CREATE INDEX "ScreeningJudgeNote_eventId_startupId_idx"
  ON "ScreeningJudgeNote"("eventId", "startupId");

-- AddForeignKey
ALTER TABLE "ScreeningJudgeNote"
  ADD CONSTRAINT "ScreeningJudgeNote_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreeningJudgeNote"
  ADD CONSTRAINT "ScreeningJudgeNote_judgeId_fkey"
  FOREIGN KEY ("judgeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreeningJudgeNote"
  ADD CONSTRAINT "ScreeningJudgeNote_startupId_fkey"
  FOREIGN KEY ("startupId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
