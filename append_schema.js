const fs = require('fs');

const models = `
model AlumniReferral {
  id                  String   @id @default(uuid())
  referredBy          String
  referredName        String
  referredEmail       String
  referredStartupName String
  sector              String
  stage               String
  note                String?
  targetCohortId      String?
  status              String   @default("PENDING")
  statusNote          String?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
}

model AlumniSuccessStory {
  id          String   @id @default(uuid())
  startupId   String
  startupName String
  title       String
  type        String
  description String
  externalUrl String?
  amount      Float?
  mediaOutlet String?
  eventDate   DateTime
  isPublic    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model AlumniEngagementFlag {
  id         String   @id @default(uuid())
  alumniId   String?
  alumniName String
  sector     String?
  types      String[]
  priority   String   @default("MEDIUM")
  notes      String?
  status     String   @default("PENDING")
  activities Json?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

model AlumniKpiSnapshot {
  id            String   @id @default(uuid())
  alumniId      String?
  alumniName    String
  sector        String?
  cohort        String?
  snapshotYear  Int
  snapshotType  String
  revenue       Float    @default(0)
  employees     Int      @default(0)
  fundingRaised Float    @default(0)
  customers     Int      @default(0)
  patentsFiled  Int      @default(0)
  stage         String?
  isActive      Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([alumniName, snapshotYear, snapshotType])
}
`;

fs.appendFileSync('prisma/schema.prisma', '\n' + models);
console.log('Appended models');
