import 'dotenv/config';
import prisma from '../src/lib/prisma';

const IDs = {
  institutionId: "3a45c421-ad29-4d22-adb7-dd39445c5cda",
  departmentId: "e4f4e2b3-3e20-4a20-9aa8-fdb3a454bff2",
  designationId: "e369d0f2-68e1-4f61-a6a4-adf67454cf66",
};

async function main() {
  const email = 'admin@gusec.edu.in';

  console.log(`Finding user ${email}...`);
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    console.error(`Error: User ${email} not found. Please run scripts/create_super_admin.ts first.`);
    return;
  }

  console.log(`Seeding profile data for user: ${user.email} (${user.id})`);

  await prisma.$transaction(async (tx) => {
    // 1. Personal Details
    console.log('Populating Personal Details...');
    await tx.userPersonalDetails.upsert({
      where: { userId: user.id },
      update: {
        title: "Mr",
        firstName: "Super",
        lastName: "Admin",
        gender: "male",
        dob: new Date("1990-01-01"),
        pob: "Ahmedabad",
        maritalStatus: "single",
        category: "gen",
        bloodGroup: "O+",
        pan: "ABCDE1234F",
        aadhaar: "123456789012",
        fatherSpouseName: "System Admin",
        phone: "9999999999",
        staffCode: "GUSEC-SA-001",
        punchId: "P-SA-001",
        shift: "General",
        policy: "Standard",
        status: "active",
        isPartTime: false,
        isExternalStaff: false,
      },
      create: {
        userId: user.id,
        title: "Mr",
        firstName: "Super",
        lastName: "Admin",
        gender: "male",
        dob: new Date("1990-01-01"),
        pob: "Ahmedabad",
        maritalStatus: "single",
        category: "gen",
        bloodGroup: "O+",
        pan: "ABCDE1234F",
        aadhaar: "123456789012",
        fatherSpouseName: "System Admin",
        phone: "9999999999",
        staffCode: "GUSEC-SA-001",
        punchId: "P-SA-001",
        shift: "General",
        policy: "Standard",
        status: "active",
        isPartTime: false,
        isExternalStaff: false,
      },
    });

    // 2. Addresses
    console.log('Populating Addresses...');
    await tx.userAddress.deleteMany({ where: { userId: user.id } });
    await tx.userAddress.createMany({
      data: [
        {
          userId: user.id,
          type: "RESIDENTIAL",
          addressLine: "GUSEC, Gujarat University",
          city: "Ahmedabad",
          state: "Gujarat",
          country: "India",
          pinCode: "380001",
          isDefault: true,
        },
        {
          userId: user.id,
          type: "COMMUNICATION",
          addressLine: "GUSEC, Gujarat University",
          city: "Ahmedabad",
          state: "Gujarat",
          country: "India",
          pinCode: "380001",
          isDefault: false,
        },
      ],
    });

    // 2b. Master Records for Department Mapping
    console.log('Populating Institution, Department, and Designation Masters...');
    await tx.institution.upsert({
      where: { id: IDs.institutionId },
      update: { name: "GUSEC", isActive: true },
      create: { id: IDs.institutionId, name: "GUSEC", isActive: true }
    });

    await tx.department.upsert({
      where: { name_institutionId: { name: "Administration", institutionId: IDs.institutionId } },
      update: { isActive: true },
      create: { id: IDs.departmentId, name: "Administration", institutionId: IDs.institutionId, isActive: true }
    });

    await tx.designation.upsert({
      where: { name: "Super Admin" },
      update: { isActive: true },
      create: { id: IDs.designationId, name: "Super Admin", isActive: true }
    });

    // 3. Department Mapping
    console.log('Populating Department Mapping...');
    await tx.userDepartmentMapping.deleteMany({ where: { userId: user.id } });
    await tx.userDepartmentMapping.create({
      data: {
        userId: user.id,
        institutionId: IDs.institutionId,
        departmentId: IDs.departmentId,
        designationId: IDs.designationId,
        dateOfJoining: new Date("2024-01-01"),
        isDefault: true,
      },
    });

    // 4. Reporting Hierarchy
    console.log('Populating Reporting Hierarchy...');
    await tx.userReportingHierarchy.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        reportLevel1: user.id, // Self-reporting for super admin
      },
      update: {
        reportLevel1: user.id,
      },
    });

    // 5. Bank Details
    console.log('Populating Bank Details...');
    await tx.userBankDetails.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        bankName: "SBI",
        accountHolder: "Super Admin",
        accountNo: "123456789012",
        ifsc: "SBIN0001234",
        branchName: "University Campus",
        status: "active",
      },
      update: {
        bankName: "SBI",
        accountHolder: "Super Admin",
        accountNo: "123456789012",
        ifsc: "SBIN0001234",
        branchName: "University Campus",
        status: "active",
      },
    });

    // 6. Professional Metrics
    console.log('Populating Professional Metrics...');
    await tx.userProfessionalMetrics.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        technicalSkills: "System Administration, Database Management",
        domainExpertise: "Incubation & Entrepreneurship",
      },
      update: {
        technicalSkills: "System Administration, Database Management",
        domainExpertise: "Incubation & Entrepreneurship",
      },
    });

    // 7. Education
    console.log('Populating Education...');
    await tx.userEducation.deleteMany({ where: { userId: user.id } });
    await tx.userEducation.create({
      data: {
        userId: user.id,
        qualification: "Masters in Computer Applications",
        passingDate: new Date("2015-05-15"),
      },
    });
  });

  console.log('SUCCESS: Super Admin profile data seeded successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
