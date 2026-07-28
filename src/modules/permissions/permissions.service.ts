import { Prisma } from "@prisma/client";
import prisma from "../../lib/prisma";

export class PermissionsService {
  async seedDefaultModules() {
    const modules = [
      { key: "dashboard",       label: "Dashboard",            group: "Core" },
      { key: "applications",    label: "Applications",         group: "Core" },
      { key: "users",           label: "User Management",      group: "Core" },
      { key: "master",          label: "Master",               group: "Core" },
      { key: "spr",             label: "SPR Monitoring",       group: "Core" },
      { key: "staff",           label: "Staff & Review",       group: "Core" },
      { key: "grants",          label: "Grants",               group: "Grants" },
      { key: "grant_allocation",label: "Grant Allocation",     group: "Grants" },
      { key: "tranches",        label: "Tranche Management",   group: "Grants" },
      { key: "utilisation",     label: "Utilisation Tracking", group: "Grants" },
      { key: "milestones",      label: "Milestone Tracking",   group: "Grants" },
      { key: "incubation",      label: "Incubation Center",    group: "Operations" },
      { key: "coworking",       label: "Coworking Space",      group: "Operations" },
      { key: "communication",   label: "Communication",        group: "Operations" },
      { key: "finance",         label: "Finance & Accounts",   group: "Finance" },
      { key: "reports",         label: "Reports & Audit",      group: "Reports" },
      { key: "announcements",   label: "Announcements",        group: "Core" },
      { key: "alumni",          label: "Alumni Network",       group: "Operations" },
      { key: "events",          label: "Events & Demo Day",    group: "Operations" },
      { key: "inventory",       label: "Inventory Management", group: "Operations" },
      { key: "cohorts",         label: "Cohort Management",    group: "Operations" },
    ];

    let created = 0;
    for (const mod of modules) {
      const existing = await prisma.permissionModule.findUnique({ where: { key: mod.key } });
      if (!existing) {
        await prisma.permissionModule.create({ data: mod });
        created++;
      }
    }
    return { total: modules.length, created, skipped: modules.length - created };
  }

  async getModules() {
    return await prisma.permissionModule.findMany({
      orderBy: [{ group: "asc" }, { label: "asc" }],
    });
  }

  async getRoles() {
    return await prisma.orgRole.findMany({
      include: {
        permissions: {
          include: {
            module: true,
          },
        },
        _count: {
          select: { userRoles: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async createRole(data: { name: string; code: string; description?: string; permissions: Record<string, string[]> }) {
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Create Role
      const role = await tx.orgRole.create({
        data: {
          name: data.name,
          code: data.code,
          description: data.description,
        },
      });

      // 2. Create Permissions
      const modules = await tx.permissionModule.findMany();
      const permissionData = Object.entries(data.permissions)
        .filter(([_, actions]) => actions.length > 0)
        .map(([moduleKey, actions]) => {
          const mod = modules.find((m: any) => m.key === moduleKey);
          if (!mod) return null;
          return {
            roleId: role.id,
            moduleId: mod.id,
            actions,
          };
        })
        .filter((p): p is any => p !== null);

      if (permissionData.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionData,
        });
      }

      return role;
    });
  }

  async updateRole(id: string, data: { name: string; code: string; description?: string; isActive?: boolean }) {
    const existing = await prisma.orgRole.findFirst({ where: { code: data.code, NOT: { id } } });
    if (existing) {
      throw Object.assign(new Error('Role code already exists'), { statusCode: 409 });
    }
    return await prisma.orgRole.update({
      where: { id },
      data: {
        name: data.name,
        code: data.code,
        description: data.description,
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
  }

  async updateRolePermissions(roleId: string, permissions: Record<string, string[]>) {
    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const modules = await tx.permissionModule.findMany();

      // Delete all existing permissions for the role
      await tx.rolePermission.deleteMany({ where: { roleId } });

      // Recreate with new values
      const permissionData = Object.entries(permissions)
        .filter(([_, actions]) => actions.length > 0)
        .map(([moduleKey, actions]) => {
          const mod = modules.find((m: any) => m.key === moduleKey);
          if (!mod) return null;
          return { roleId, moduleId: mod.id, actions };
        })
        .filter((p): p is any => p !== null);

      if (permissionData.length > 0) {
        await tx.rolePermission.createMany({ data: permissionData });
      }

      return { success: true };
    });
  }

  async getUserMappings() {
    const users = await prisma.user.findMany({
      where: { 
        deletedAt: null,
        role: { not: 'STARTUP' }
      },
      include: {
        personalDetails: true,
        departmentMappings: {
          include: { department: true },
        },
        userRoles: {
          include: { role: true },
        },
      },
    });

    return users.map((u: any) => {
      const firstName = u.personalDetails?.firstName || '';
      const lastName = u.personalDetails?.lastName || '';
      const fullName = u.name || [firstName, lastName].filter(Boolean).join(' ') || u.email;
      return {
        userId: u.id,
        name: fullName,
        email: u.email,
        role: u.role,
        department: u.departmentMappings[0]?.department?.name || "N/A",
        roles: u.userRoles.map((ur: any) => ur.role.code),
      };
    });
  }

  async mapRoleToUser(userId: string, roleCode: string) {
    const role = await prisma.orgRole.findUnique({ where: { code: roleCode } });
    if (!role) throw new Error("Role not found");

    return await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId,
          roleId: role.id,
        },
      },
      update: {},
      create: {
        userId,
        roleId: role.id,
      },
    });
  }

  async removeRoleFromUser(userId: string, roleCode: string) {
    const role = await prisma.orgRole.findUnique({ where: { code: roleCode } });
    if (!role) throw new Error("Role not found");

    return await prisma.userRole.delete({
      where: {
        userId_roleId: {
          userId,
          roleId: role.id,
        },
      },
    });
  }
}

export const permissionsService = new PermissionsService();
