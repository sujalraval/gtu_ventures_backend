import { PrismaClient } from '@prisma/client';
import { ApplicationsService } from '../src/modules/applications/applications.service';

const prisma = new PrismaClient();

async function verifyFix() {
  console.log('--- Verifying CIN Duplicate Fix ---');
  
  // 1. Get/Create two test users
  let user1 = await prisma.user.findUnique({ where: { email: 'test_user1@example.com' } });
  if (!user1) user1 = await prisma.user.create({ data: { email: 'test_user1@example.com', name: 'User 1' } });

  let user2 = await prisma.user.findUnique({ where: { email: 'test_user2@example.com' } });
  if (!user2) user2 = await prisma.user.create({ data: { email: 'test_user2@example.com', name: 'User 2' } });

  console.log(`Using User 1: ${user1.email} (ID: ${user1.id})`);
  console.log(`Using User 2: ${user2.email} (ID: ${user2.id})`);

  // Cleanup existing applications if any to allow re-run
  await prisma.startupApplication.deleteMany({ where: { userId: { in: [user1.id, user2.id] } } });

  const scheme = await prisma.scheme.findFirst();

  // Dummy Application Data
  const getBaseData = (aadhaar: string) => ({
    scheme: scheme?.id || 'some-scheme-id',
    fullName: 'Test User',
    designation: 'Founder',
    email: 'test@example.com',
    mobile: '1234567890',
    aadhaar: aadhaar, // <--- Different Aadhaar
    gender: 'male',
    dateOfBirth: '1990-01-01',
    highestQualification: 'degree',
    fromInstitution: 'University',
    addressLine: '123 Test St',
    locality: 'Test Locality',
    city: 'Ahmedabad',
    district: 'Ahmedabad',
    state: 'Gujarat',
    pinCode: '380001',
    startupName: 'Test Startup',
    mainSector: 'IT',
    subSectors: [],
    stage: 'idea',
    briefAbout: 'Test brief',
    problemStatement: 'Test problem',
    innovationDescription: 'Test innovation',
    isRegistered: false,
    legalStatus: 'NOT_REGISTERED',
    cin: '', // <--- The culprit: empty string
    incorporationDate: '2020-01-01',
    pan: '', // also empty
    hasGst: 'no',
    primaryEmail: 'test@example.com',
    primaryMobile: '1234567890',
    isEmailVerified: true,
    isMobileVerified: true,
    isDeclared: true
  });

  try {
    // 2. Submit for User 1
    console.log(`Submitting for User 1...`);
    await ApplicationsService.submitFormA(user1.id, getBaseData('111122223333'));
    console.log('✅ User 1 submission successful.');

    // 3. Submit for User 2 with EXACTLY the same empty CIN
    console.log(`Submitting for User 2 with empty CIN...`);
    await ApplicationsService.submitFormA(user2.id, getBaseData('444455556666'));
    console.log('✅ User 2 submission successful! Fix verified (no duplicate key error for cin/pan).');

  } catch (error: any) {
    console.error('❌ Verification failed:');
    console.error(error.message);
  } finally {
    await prisma.$disconnect();
  }
}

verifyFix();
