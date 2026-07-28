import { Request, Response } from "express";
import { permissionsService } from "./permissions.service";
import asyncHandler from "../../common/utils/asyncHandler";

export class PermissionsController {
  seedModules = asyncHandler(async (req: Request, res: Response) => {
    const result = await permissionsService.seedDefaultModules();
    res.json({ success: true, data: result, message: `Seeded ${result.created} new modules (${result.skipped} already existed)` });
  });

  getModules = asyncHandler(async (req: Request, res: Response) => {
    const modules = await permissionsService.getModules();
    res.json({
      success: true,
      data: modules
    });
  });

  getRoles = asyncHandler(async (req: Request, res: Response) => {
    const roles = await permissionsService.getRoles();
    // Transform to match frontend expectations
    const transformed = roles.map((r: any) => ({
      id: r.id,
      name: r.name,
      code: r.code,
      description: r.description || "",
      usersCount: r._count.userRoles,
      status: r.isActive ? "active" : "inactive",
      createdDate: r.createdAt.toISOString().split("T")[0],
      permissions: r.permissions.reduce((acc: any, p: any) => {
        acc[p.module.key] = p.actions;
        return acc;
      }, {}),
    }));
    res.json({
      success: true,
      data: transformed
    });
  });

  createRole = asyncHandler(async (req: Request, res: Response) => {
    const role = await permissionsService.createRole(req.body);
    res.json({
      success: true,
      data: role
    });
  });

  updateRole = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, code, description, isActive } = req.body;
    if (!name || !code) return res.status(400).json({ success: false, message: "Name and code are required" });
    try {
      const role = await permissionsService.updateRole(id, { name, code: code.toUpperCase(), description, isActive });
      res.json({ success: true, data: role });
    } catch (err: any) {
      if (err.statusCode === 409) return res.status(409).json({ success: false, message: 'A record with this value already exists. Please use a unique value.' });
      throw err;
    }
  });

  updateRolePermissions = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const { permissions } = req.body;
    const result = await permissionsService.updateRolePermissions(id, permissions);
    res.json({ success: true, data: result });
  });

  getUserMappings = asyncHandler(async (req: Request, res: Response) => {
    const mappings = await permissionsService.getUserMappings();
    res.json({
      success: true,
      data: mappings
    });
  });

  mapRoleToUser = asyncHandler(async (req: Request, res: Response) => {
    const { userId, roleCode } = req.body;
    const result = await permissionsService.mapRoleToUser(userId, roleCode);
    res.json({
      success: true,
      data: result
    });
  });

  removeRoleFromUser = asyncHandler(async (req: Request, res: Response) => {
    const { userId, roleCode } = req.body;
    const result = await permissionsService.removeRoleFromUser(userId, roleCode);
    res.json({
      success: true,
      data: result
    });
  });
}

export const permissionsController = new PermissionsController();
