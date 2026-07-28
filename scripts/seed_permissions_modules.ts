import 'dotenv/config';
import prisma from '../src/lib/prisma';


const moduleData = [
  // Core
  { key: "dashboard", label: "Dashboard", group: "Core" },
  { key: "users", label: "Users & Roles", group: "Core" },
  
  // Masters
  { key: "scheme_master", label: "Scheme Master", group: "Masters" },
  { key: "form_master", label: "Application Forms", group: "Masters" },
  { key: "startup_master", label: "Startup Master", group: "Masters" },
  { key: "document_master", label: "Document Master", group: "Masters" },
  { key: "workflow_master", label: "Workflow Master", group: "Masters" },
  
  // Applications
  { key: "applications", label: "Applications", group: "Applications" },
  { key: "evaluation", label: "Evaluation", group: "Applications" },
  
  // Grants
  { key: "grants", label: "Grants Management", group: "Grants" },
  { key: "grant_allocation", label: "Grant Allocation", group: "Grants" },
  { key: "tranches", label: "Tranches", group: "Grants" },
  { key: "utilisation", label: "Utilisation", group: "Grants" },
  { key: "uc_management", label: "UC Management", group: "Grants" },
  { key: "milestones", label: "Milestones", group: "Grants" },
];

const actions = ["view", "create", "edit", "delete", "export", "approve"];

async function main() {
  console.log('Seeding permission modules and initial permissions...');
  
  // 1. Seed Modules
  const upsertedModules = [];
  for (const mod of moduleData) {
    const item = await prisma.permissionModule.upsert({
      where: { key: mod.key },
      update: {
        label: mod.label,
        group: mod.group,
      },
      create: mod,
    });
    upsertedModules.push(item);
  }
  
  // 2. Find Super Admin Role
  const superAdminRole = await prisma.orgRole.findFirst({
    where: { OR: [{ code: 'SUPER_ADMIN' }, { code: 'super_admin' }, { code: 'Super Admin' }] }
  });
  
  if (superAdminRole) {
    console.log(`Found Super Admin role (${superAdminRole.id}). Assigning all permissions...`);
    
    for (const mod of upsertedModules) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_moduleId: {
            roleId: superAdminRole.id,
            moduleId: mod.id,
          }
        },
        update: {
          actions: actions,
        },
        create: {
          roleId: superAdminRole.id,
          moduleId: mod.id,
          actions: actions,
        }
      });
    }
    console.log('Super Admin permissions updated.');
  } else {
    console.warn('Super Admin role not found. Skipping permissions assignment.');
  }
  
  console.log('Done!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
