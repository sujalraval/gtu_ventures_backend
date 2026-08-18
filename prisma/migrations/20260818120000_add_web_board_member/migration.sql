-- CreateTable
CREATE TABLE "WebBoardMember" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "role" TEXT,
    "description" TEXT,
    "photo" TEXT,
    "initials" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "publishState" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebBoardMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebBoardMember_order_idx" ON "WebBoardMember"("order");

-- Seed the six cards currently hard-coded on the About page, so the section
-- looks unchanged after this migration and can then be edited from the CMS.
INSERT INTO "WebBoardMember" ("title", "role", "description", "photo", "initials", "order", "publishState", "updatedAt") VALUES
  ('Chairperson', 'Vice Chancellor, GTU', 'Patron and head of the governing council.', '/assets/img/team/vice-chancellor.jpg', NULL, 1, 'PUBLISHED', CURRENT_TIMESTAMP),
  ('Director', 'GTU Ventures', 'Institutional oversight of the platform.', NULL, 'DR', 2, 'PUBLISHED', CURRENT_TIMESTAMP),
  ('Group CEO', 'Dr. Tushar Panchal', 'Executive leadership of GTU Ventures.', '/assets/img/team/tushar-panchal.jpg', NULL, 3, 'PUBLISHED', CURRENT_TIMESTAMP),
  ('Nominee Directors', 'Government / DST / AIM', 'Representatives of partner bodies.', NULL, 'ND', 4, 'PUBLISHED', CURRENT_TIMESTAMP),
  ('Independent & Industry Directors', 'Industry & Academia', 'External expertise and oversight.', NULL, 'ID', 5, 'PUBLISHED', CURRENT_TIMESTAMP),
  ('Company Secretary / Registrar', 'Gujarat Technological University', 'Compliance and statutory records.', '/assets/img/team/registrar.jpg', NULL, 6, 'PUBLISHED', CURRENT_TIMESTAMP);
