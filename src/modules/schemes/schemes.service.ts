import { SchemeStatus } from '@prisma/client';
import prisma from '../../lib/prisma';
import { NotFoundError } from '../../common/utils/apiError';

export class SchemesService {
  static async getAllSchemes() {
    try {
      return await prisma.scheme.findMany({
        where: { deletedAt: null },
        include: {
          grants: {
            include: {
              receipts: true,
              allocations: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error: any) {
      console.error('Error in getAllSchemes:', error);
      throw error;
    }
  }

  static async getDeletedSchemes() {
    return await prisma.scheme.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
    });
  }

  static async getSchemeById(id: string) {
    const scheme = await prisma.scheme.findUnique({
      where: { id },
    });
    if (!scheme) throw new NotFoundError('Scheme not found');
    return scheme;
  }

  static async generateSchemeCode() {
    const currentYear = new Date().getFullYear();
    const prefix = `SCH-${currentYear}`;
    
    // Find the latest scheme with the same year prefix
    const latestScheme = await prisma.scheme.findFirst({
      where: {
        code: {
          startsWith: prefix
        }
      },
      orderBy: {
        code: 'desc'
      }
    });

    let nextNumber = 1;
    if (latestScheme) {
      const parts = latestScheme.code.split('-');
      const lastNumber = parseInt(parts[parts.length - 1]);
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }

    return `${prefix}-${nextNumber.toString().padStart(3, '0')}`;
  }

  static async createScheme(data: any) {
    const generatedCode = await this.generateSchemeCode();
    
    // Extract everything except direct ID or code
    // Also filter out frontend-only multi-select temporary fields
    const { 
      id, 
      code, 
      applicationDeadline, 
      selectedDepartments,
      selectedCategories,
      selectedSectors,
      selectedBeneficiaries,
      selectedFundingTypes,
      ...rest 
    } = data;

    return await prisma.scheme.create({
      data: {
        ...rest,
        code: generatedCode,
        status: data.status ? data.status.toUpperCase() as SchemeStatus : 'DRAFT',
      },
    });
  }

  static async updateScheme(id: string, data: any) {
    // Check if exists
    await this.getSchemeById(id);

    const { 
      id: _, 
      code, 
      applicationDeadline, 
      selectedDepartments,
      selectedCategories,
      selectedSectors,
      selectedBeneficiaries,
      selectedFundingTypes,
      ...rest 
    } = data;

    return await prisma.scheme.update({
      where: { id },
      data: {
        ...rest,
        status: data.status ? data.status.toUpperCase() as SchemeStatus : undefined,
      },
    });
  }

  static async deleteScheme(id: string) {
    // Check if exists
    await this.getSchemeById(id);

    return await prisma.scheme.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  static async restoreScheme(id: string) {
    return await prisma.scheme.update({
      where: { id },
      data: { deletedAt: null },
    });
  }
}
