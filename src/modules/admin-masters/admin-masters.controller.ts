import { Request, Response } from 'express';
import { AdminMastersService } from './admin-masters.service';
import asyncHandler from '../../common/utils/asyncHandler';

export class AdminMastersController {
  // Institutions
  static getInstitutions = asyncHandler(async (req: Request, res: Response) => {
    const institutions = await AdminMastersService.getAllInstitutions();
    res.json({
      success: true,
      data: institutions
    });
  });

  static createInstitution = asyncHandler(async (req: Request, res: Response) => {
    const { name } = req.body;
    const institution = await AdminMastersService.createInstitution(name);
    res.status(201).json({
      success: true,
      data: institution
    });
  });

  static deleteInstitution = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await AdminMastersService.deleteInstitution(id as string);
    res.json({ success: true, message: 'Institution deleted successfully' });
  });

  // Departments
  static getDepartments = asyncHandler(async (req: Request, res: Response) => {
    const { institutionId } = req.query;
    let departments;
    if (institutionId) {
      departments = await AdminMastersService.getDepartmentsByInstitution(institutionId as string);
    } else {
      departments = await AdminMastersService.getAllDepartments();
    }
    res.json({
      success: true,
      data: departments
    });
  });

  static createDepartment = asyncHandler(async (req: Request, res: Response) => {
    const { name, institutionId } = req.body;
    const department = await AdminMastersService.createDepartment(name, institutionId);
    res.status(201).json({
      success: true,
      data: department
    });
  });

  static deleteDepartment = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await AdminMastersService.deleteDepartment(id as string);
    res.json({ success: true, message: 'Department deleted successfully' });
  });

  // Designations
  static getDesignations = asyncHandler(async (req: Request, res: Response) => {
    const designations = await AdminMastersService.getAllDesignations();
    res.json({
      success: true,
      data: designations
    });
  });

  static createDesignation = asyncHandler(async (req: Request, res: Response) => {
    const { name } = req.body;
    const designation = await AdminMastersService.createDesignation(name);
    res.status(201).json({
      success: true,
      data: designation
    });
  });

  static deleteDesignation = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await AdminMastersService.deleteDesignation(id as string);
    res.json({ success: true, message: 'Designation deleted successfully' });
  });

  // Org Roles
  static getOrgRoles = asyncHandler(async (req: Request, res: Response) => {
    const roles = await AdminMastersService.getAllOrgRoles();
    res.json({
      success: true,
      data: roles
    });
  });

  static createOrgRole = asyncHandler(async (req: Request, res: Response) => {
    const { name, code, description } = req.body;
    if (!name || !code) {
      return res.status(400).json({ success: false, message: "Name and Role Code are required" });
    }
    try {
      const role = await AdminMastersService.createOrgRole(name, code, description);
      res.status(201).json({ success: true, data: role });
    } catch (err: any) {
      if (err.code === 'P2002') {
        return res.status(400).json({ success: false, message: `A role with this ${err.meta?.target?.includes('name') ? 'name' : 'code'} already exists` });
      }
      throw err;
    }
  });

  static updateOrgRole = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, code, description, isActive } = req.body;
    if (!name || !code) {
      return res.status(400).json({ success: false, message: "Name and Role Code are required" });
    }
    try {
      const role = await AdminMastersService.updateOrgRole(id, name, code, description, isActive);
      res.json({ success: true, data: role });
    } catch (err: any) {
      if (err.code === 'P2002') {
        return res.status(409).json({ success: false, message: 'A record with this value already exists. Please use a unique value.' });
      }
      throw err;
    }
  });

  static deleteOrgRole = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await AdminMastersService.deleteOrgRole(id as string);
    res.json({ success: true, message: 'Role deleted successfully' });
  });

  // Sectors
  static getSectors = asyncHandler(async (req: Request, res: Response) => {
    const sectors = await AdminMastersService.getAllSectors();
    res.json({
      success: true,
      data: sectors
    });
  });

  static createSector = asyncHandler(async (req: Request, res: Response) => {
    const { name } = req.body;
    const sector = await AdminMastersService.createSector(name);
    res.status(201).json({
      success: true,
      data: sector
    });
  });

  static deleteSector = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await AdminMastersService.deleteSector(id as string);
    res.json({ success: true, message: 'Sector deleted successfully' });
  });

  // SubSectors
  static getSubSectors = asyncHandler(async (req: Request, res: Response) => {
    const { sectorId } = req.query;
    let subSectors;
    if (sectorId) {
      subSectors = await AdminMastersService.getSubSectorsBySector(sectorId as string);
    } else {
      subSectors = await AdminMastersService.getAllSubSectors();
    }
    res.json({
      success: true,
      data: subSectors
    });
  });

  static createSubSector = asyncHandler(async (req: Request, res: Response) => {
    const { name, sectorId } = req.body;
    const subSector = await AdminMastersService.createSubSector(name, sectorId);
    res.status(201).json({
      success: true,
      data: subSector
    });
  });

  static deleteSubSector = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await AdminMastersService.deleteSubSector(id as string);
    res.json({ success: true, message: 'SubSector deleted successfully' });
  });

  // Incubation Center Profile
  static getCenterProfile = asyncHandler(async (req: Request, res: Response) => {
    const profile = await AdminMastersService.getCenterProfile();
    res.json({
      success: true,
      data: profile
    });
  });

  static updateCenterProfile = asyncHandler(async (req: Request, res: Response) => {
    const profile = await AdminMastersService.updateCenterProfile(req.body);
    res.json({
      success: true,
      data: profile,
      message: 'Center profile updated successfully'
    });
  });

  // Allocation Heads
  static getAllocationHeads = asyncHandler(async (req: Request, res: Response) => {
    const heads = await AdminMastersService.getAllAllocationHeads();
    res.json({
      success: true,
      data: heads
    });
  });

  static createAllocationHead = asyncHandler(async (req: Request, res: Response) => {
    const { name } = req.body;
    const head = await AdminMastersService.createAllocationHead(name);
    res.status(201).json({
      success: true,
      data: head
    });
  });

  static deleteAllocationHead = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await AdminMastersService.deleteAllocationHead(id as string);
    res.json({ success: true, message: 'Allocation Head deleted successfully' });
  });
}
