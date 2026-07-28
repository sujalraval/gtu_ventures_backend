-- Safe conversion: enum → text, preserving all existing values
-- PostgreSQL supports casting enum → text natively via ::TEXT

ALTER TABLE "EventAnnouncement" ALTER COLUMN "type" TYPE TEXT USING "type"::TEXT;
ALTER TABLE "EventAnnouncement" ALTER COLUMN "type" SET DEFAULT 'GENERAL';

DROP TYPE IF EXISTS "EventAnnouncementType";
