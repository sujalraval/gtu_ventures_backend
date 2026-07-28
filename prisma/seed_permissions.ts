import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const modules = [
  { key: "dashboard", label: "Dashboard", group: "Core" },
  { key: "applications", label: "Applications", group: "Core" },
  { key: "users", label: "User Management", group: "Core" },
  { key: "grants", label: "Grants Dashboard", group: "Grants" },
  { key: "grant_allocation", label: "Grant Allocation", group: "Grants" },
  { key: "tranches", label: "Tranche Management", group: "Grants" },
  { key: "utilisation", label: "Utilisation Tracking", group: "Grants" },
  { key: "uc_management", label: "UC Management", group: "Grants" },
  { key: "evaluation", label: "Committee Evaluation", group: "Grants" },
  { key: "milestones", label: "Milestone Tracking", group: "Grants" },
  { key: "scheme_master", label: "Scheme Master", group: "Masters" },
  { key: "form_master", label: "Form Master", group: "Masters" },
  { key: "startup_master", label: "Startup Master", group: "Masters" },
  { key: "document_master", label: "Document Master", group: "Masters" },
  { key: "workflow_master", label: "Workflow Master", group: "Masters" },
];

const permissionActions = ["view", "create", "edit", "delete", "export", "approve"];

async function main() {
  console.log("Seeding permissions...");

  // 1. Seed Modules
  for (const mod of modules) {
    await prisma.permissionModule.upsert({
      where: { key: mod.key },
      update: { label: mod.label, group: mod.group },
      create: mod,
    });
  }
  console.log(`Seeded ${modules.length} modules.`);

  // 2. Fix existing roles if they have null codes
  const roles = await prisma.orgRole.findMany();
  for (const role of roles) {
    if (!role.code) {
      const code = role.name.toUpperCase().replace(/\s/g, "_");
      await prisma.orgRole.update({
        where: { id: role.id },
        data: { code },
      });
      console.log(`Updated role ${role.name} with code ${code}`);
    }
  }

  // 3. Seed Super Admin Role if not exists
  const superAdmin = await prisma.orgRole.upsert({
    where: { code: "SUPER_ADMIN" },
    update: {},
    create: {
      name: "Super Admin",
      code: "SUPER_ADMIN",
      description: "Full system access",
    },
  });

  // 4. Assign all permissions to Super Admin
  const allModules = await prisma.permissionModule.findMany();
  for (const mod of allModules) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_moduleId: {
          roleId: superAdmin.id,
          moduleId: mod.id,
        },
      },
      update: { actions: permissionActions },
      create: {
        roleId: superAdmin.id,
        moduleId: mod.id,
        actions: permissionActions,
      },
    });
  }
  console.log("Super Admin permissions seeded.");

  console.log("Seeding complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
