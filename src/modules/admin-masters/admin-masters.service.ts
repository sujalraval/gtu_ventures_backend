import prisma from '../../lib/prisma';

export class AdminMastersService {
  // Institutions
  static async getAllInstitutions() {
    return await prisma.institution.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  static async createInstitution(name: string) {
    return await prisma.institution.create({
      data: { name },
    });
  }

  static async deleteInstitution(id: string) {
    return await prisma.institution.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // Departments
  static async getAllDepartments() {
    return await prisma.department.findMany({
      where: { isActive: true },
      include: { institution: true },
      orderBy: { name: 'asc' },
    });
  }

  static async getDepartmentsByInstitution(institutionId: string) {
    return await prisma.department.findMany({
      where: { institutionId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  static async createDepartment(name: string, institutionId: string) {
    return await prisma.department.create({
      data: { name, institutionId },
    });
  }

  static async deleteDepartment(id: string) {
    return await prisma.department.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // Designations
  static async getAllDesignations() {
    return await prisma.designation.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  static async createDesignation(name: string) {
    return await prisma.designation.create({
      data: { name },
    });
  }

  static async deleteDesignation(id: string) {
    return await prisma.designation.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // Org Roles
  static async getAllOrgRoles() {
    return await prisma.orgRole.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  static async createOrgRole(name: string, code: string, description?: string) {
    // If an inactive role with the same code exists, reactivate it instead
    const existing = await prisma.orgRole.findUnique({ where: { code } });
    if (existing) {
      if (!existing.isActive) {
        return await prisma.orgRole.update({
          where: { code },
          data: { name, description, isActive: true },
        });
      }
      throw Object.assign(new Error('Role code already exists'), { code: 'P2002', meta: { target: ['code'] } });
    }
    return await prisma.orgRole.create({
      data: { name, code, description },
    });
  }

  static async updateOrgRole(id: string, name: string, code: string, description?: string, isActive?: boolean) {
    const existing = await prisma.orgRole.findFirst({ where: { code, NOT: { id } } });
    if (existing) {
      throw Object.assign(new Error('Role code already exists'), { code: 'P2002', meta: { target: ['code'] } });
    }
    return await prisma.orgRole.update({
      where: { id },
      data: { name, code, description, ...(isActive !== undefined && { isActive }) },
    });
  }

  static async deleteOrgRole(id: string) {
    return await prisma.orgRole.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // Sectors
  static async getAllSectors() {
    return await prisma.sector.findMany({
      where: { isActive: true },
      include: { subSectors: true },
      orderBy: { name: 'asc' },
    });
  }

  static async createSector(name: string) {
    return await prisma.sector.create({
      data: { name },
    });
  }

  static async deleteSector(id: string) {
    return await prisma.sector.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // SubSectors
  static async getAllSubSectors() {
    return await prisma.subSector.findMany({
      where: { isActive: true },
      include: { sector: true },
      orderBy: { name: 'asc' },
    });
  }

  static async getSubSectorsBySector(sectorId: string) {
    return await prisma.subSector.findMany({
      where: { sectorId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  static async createSubSector(name: string, sectorId: string) {
    return await prisma.subSector.create({
      data: { name, sectorId },
    });
  }

  static async deleteSubSector(id: string) {
    return await prisma.subSector.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // Incubation Center Profile
  static async getCenterProfile() {
    return await prisma.incubationCenter.findFirst();
  }

  static async updateCenterProfile(data: any) {
    const existing = await prisma.incubationCenter.findFirst();
    if (existing) {
      return await prisma.incubationCenter.update({
        where: { id: existing.id },
        data,
      });
    }
    return await prisma.incubationCenter.create({
      data,
    });
  }

  // Allocation Heads
  static async getAllAllocationHeads() {
    return await prisma.allocationHeadMaster.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  static async createAllocationHead(name: string) {
    return await prisma.allocationHeadMaster.create({
      data: { name },
    });
  }

  static async deleteAllocationHead(id: string) {
    return await prisma.allocationHeadMaster.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
