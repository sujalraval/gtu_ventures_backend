-- CreateTable
CREATE TABLE "EventParticipant" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "organization" TEXT,
    "designation" TEXT,
    "customFields" JSONB,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventParticipant_email_key" ON "EventParticipant"("email");

-- CreateIndex
CREATE INDEX "EventParticipant_email_idx" ON "EventParticipant"("email");

-- Backfill from registrations already taken, newest first, so returning
-- attendees are recognised straight away rather than only from their next event.
INSERT INTO "EventParticipant" ("id", "email", "name", "phone", "organization", "designation", "customFields", "lastSeenAt", "createdAt", "updatedAt")
SELECT
    -- Plain text id rather than gen_random_uuid(), which needs PG13+ or the
    -- pgcrypto extension. The column is TEXT, so any unique string works.
    md5(random()::text || clock_timestamp()::text || r."id"),
    LOWER(r."email"),
    r."name",
    r."phone",
    r."organization",
    r."designation",
    r."customFields",
    r."createdAt",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT ON (LOWER("email")) *
    FROM "EventRegistration"
    WHERE "status" <> 'CANCELLED'
    ORDER BY LOWER("email"), "createdAt" DESC
) r
ON CONFLICT ("email") DO NOTHING;
