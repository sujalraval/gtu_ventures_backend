-- Screening events.
--
-- An admin runs a screening round for applications that have submitted Form A,
-- a panel of judges scores each one live, and the panel records an outcome:
-- which scheme and cohort the startup goes into, or that it is rejected.
--
-- Scoring is NOT rebuilt here. The judging stack already exists and is used by
-- demo days — ScorecardCriteria (weighted rubric), StartupScore (judge x
-- criterion x startup) and JudgeAssignment. Those key on the startup's User id,
-- and a judge's list comes from EventScheduleSlot, so adding a screening
-- candidate also creates a slot and the whole stack works untouched.
--
-- This migration adds only what screening needs on top: the link from an event
-- back to a StartupApplication, who is presenting right now, and the decision.

-- AlterEnum: SCREENING joins DEMO_DAY, INVESTOR_DAY, WORKSHOP, MASTERCLASS,
-- HACKATHON. Added rather than replacing anything, so existing events are
-- unaffected.
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'SCREENING';

-- CreateEnum
CREATE TYPE "ScreeningOutcome" AS ENUM ('PENDING', 'SELECTED', 'WAITLISTED', 'REJECTED', 'HOLD');

-- CreateTable
CREATE TABLE "ScreeningCandidate" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isPresenting" BOOLEAN NOT NULL DEFAULT false,
    "presentedAt" TIMESTAMP(3),
    "outcome" "ScreeningOutcome" NOT NULL DEFAULT 'PENDING',
    "schemeId" TEXT,
    "cohortId" TEXT,
    "decisionNote" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ScreeningCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: one entry per application per event.
CREATE UNIQUE INDEX "ScreeningCandidate_eventId_applicationId_key"
  ON "ScreeningCandidate"("eventId", "applicationId");

-- CreateIndex
CREATE INDEX "ScreeningCandidate_eventId_outcome_idx"
  ON "ScreeningCandidate"("eventId", "outcome");

-- CreateIndex
CREATE INDEX "ScreeningCandidate_applicationId_idx"
  ON "ScreeningCandidate"("applicationId");

-- AddForeignKey
ALTER TABLE "ScreeningCandidate"
  ADD CONSTRAINT "ScreeningCandidate_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreeningCandidate"
  ADD CONSTRAINT "ScreeningCandidate_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "StartupApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: the scheme decided for this candidate. RESTRICT, not CASCADE —
-- deleting a scheme must not silently erase the record of what a panel decided.
ALTER TABLE "ScreeningCandidate"
  ADD CONSTRAINT "ScreeningCandidate_schemeId_fkey"
  FOREIGN KEY ("schemeId") REFERENCES "Scheme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreeningCandidate"
  ADD CONSTRAINT "ScreeningCandidate_cohortId_fkey"
  FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreeningCandidate"
  ADD CONSTRAINT "ScreeningCandidate_decidedById_fkey"
  FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Guest panellists.
--
-- A screening judge is frequently from outside GTU — an investor, a founder, an
-- industry expert. They get a bare EXPERT account so they can sign in and score,
-- and nothing else. Affiliation sits on the assignment rather than the user
-- because the same person may sit on one panel for their firm and another in a
-- personal capacity.
ALTER TABLE "JudgeAssignment"
  ADD COLUMN "isExternal"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "organisation" TEXT,
  ADD COLUMN "designation"  TEXT,
  ADD COLUMN "invitedAt"    TIMESTAMP(3);
