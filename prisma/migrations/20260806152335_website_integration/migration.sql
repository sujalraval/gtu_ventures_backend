-- CreateEnum
CREATE TYPE "WebRole" AS ENUM ('SUPER_ADMIN', 'EDITOR', 'CONTRIBUTOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "WebPartnerType" AS ENUM ('CORPORATE', 'ECOSYSTEM', 'ACADEMIC', 'INVESTOR');

-- CreateTable
CREATE TABLE "WebUser" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "WebRole" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebMedia" (
    "id" SERIAL NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "altText" TEXT,
    "refCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebSetting" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebAuditLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "before" TEXT,
    "after" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebStartup" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "logoEmoji" TEXT,
    "logoPath" TEXT,
    "sector" TEXT,
    "stage" TEXT,
    "ecosystem" TEXT,
    "registered" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "businessModel" TEXT,
    "problem" TEXT,
    "market" TEXT,
    "revenueModel" TEXT,
    "technology" TEXT,
    "traction" TEXT,
    "awards" TEXT,
    "press" TEXT,
    "funding" JSONB,
    "regulatory" JSONB,
    "team" JSONB,
    "mentors" TEXT,
    "publishState" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebStartup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebMentor" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "initials" TEXT,
    "photo" TEXT,
    "designation" TEXT,
    "org" TEXT,
    "industry" TEXT,
    "years" TEXT,
    "mtype" JSONB,
    "bio" TEXT,
    "expertise" JSONB,
    "support" JSONB,
    "engagement" TEXT,
    "mode" TEXT,
    "sectors" TEXT,
    "languages" TEXT,
    "achievements" JSONB,
    "linkedin" TEXT,
    "website" TEXT,
    "email" TEXT,
    "publishState" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebMentor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebPartner" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT,
    "link" TEXT,
    "category" TEXT,
    "about" TEXT,
    "mou" JSONB,
    "type" "WebPartnerType" NOT NULL DEFAULT 'CORPORATE',
    "publishState" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebPartner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebMou" (
    "id" SERIAL NOT NULL,
    "org" TEXT NOT NULL,
    "emoji" TEXT,
    "logo" TEXT,
    "link" TEXT,
    "status" TEXT,
    "number" TEXT,
    "title" TEXT,
    "date" TEXT,
    "effective" TEXT,
    "expiry" TEXT,
    "scope" JSONB,
    "benefits" JSONB,
    "activities" JSONB,
    "brief" TEXT,
    "objective" TEXT,
    "pdf" TEXT,
    "press" TEXT,
    "publishState" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebMou_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebScheme" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "desc" TEXT,
    "objectives" TEXT,
    "eligibility" TEXT,
    "beneficiaries" JSONB,
    "providedBy" TEXT,
    "authority" TEXT,
    "type" TEXT,
    "installments" TEXT,
    "departments" JSONB,
    "category" JSONB,
    "sectors" JSONB,
    "budget" TEXT,
    "maxGrant" TEXT,
    "fundingType" TEXT,
    "duration" TEXT,
    "equityPct" TEXT,
    "apply" TEXT,
    "publishState" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebScheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebVertical" (
    "id" SERIAL NOT NULL,
    "vid" TEXT,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "logoPath" TEXT,
    "backer" TEXT,
    "emoji" TEXT,
    "about" TEXT,
    "offerings" JSONB,
    "forWho" TEXT,
    "publishState" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebVertical_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebLab" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "location" TEXT,
    "equipment" JSONB,
    "availability" TEXT,
    "bookingLink" TEXT,
    "images" JSONB,
    "publishState" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebLab_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebAnnouncement" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "date" TEXT,
    "category" TEXT,
    "content" TEXT,
    "link" TEXT,
    "image" TEXT,
    "publishState" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebStory" (
    "id" SERIAL NOT NULL,
    "startupName" TEXT NOT NULL,
    "founder" TEXT,
    "challenge" TEXT,
    "solution" TEXT,
    "impact" JSONB,
    "quote" TEXT,
    "coverImage" TEXT,
    "publishState" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebStory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebTestimonial" (
    "id" SERIAL NOT NULL,
    "authorName" TEXT NOT NULL,
    "designation" TEXT,
    "organization" TEXT,
    "quote" TEXT,
    "photo" TEXT,
    "rating" INTEGER,
    "publishState" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebTestimonial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebOrg" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "logo" TEXT,
    "website" TEXT,
    "description" TEXT,
    "contact" JSONB,
    "publishState" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebOrg_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebEvent" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "date" TEXT,
    "location" TEXT,
    "description" TEXT,
    "image" TEXT,
    "link" TEXT,
    "status" TEXT,
    "publishState" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebTeamMember" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "designation" TEXT,
    "photo" TEXT,
    "bio" TEXT,
    "linkedin" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "publishState" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebTeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebResource" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT,
    "url" TEXT,
    "description" TEXT,
    "publishState" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebLead" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "inquiryType" TEXT,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebUser_email_key" ON "WebUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "WebSetting_key_key" ON "WebSetting"("key");

-- AddForeignKey
ALTER TABLE "WebAuditLog" ADD CONSTRAINT "WebAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "WebUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
