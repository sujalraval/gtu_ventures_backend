import { Request, Response } from "express";
import { usersService } from "./users.service";
import asyncHandler from "../../common/utils/asyncHandler";

export class UsersController {
  createUser = asyncHandler(async (req: Request, res: Response) => {
    // Call service to create user (validation happens in middleware)
    const user = await usersService.createUser(req.body);

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      data: user,
    });
  });

  getAllUsers = asyncHandler(async (req: Request, res: Response) => {
    const users = await usersService.getAllUsers();
    return res.status(200).json({
      success: true,
      data: users
    });
  });

  getStaffUsers = asyncHandler(async (req: Request, res: Response) => {
    const users = await usersService.getStaffUsers();
    return res.status(200).json({
      success: true,
      data: users
    });
  });

  getUserById = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const user = await usersService.getUserById(id);
    
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.status(200).json({
      success: true,
      data: user
    });
  });

  updateUser = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    const user = await usersService.updateUser(id, req.body);

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: user,
    });
  });

  deactivateUser = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    await usersService.deactivateUser(id);
    return res.status(200).json({ success: true, message: "User deactivated successfully" });
  });

  uploadDocuments = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.params.userId as string;
    const files = req.files as any;

    if (!files) {
      return res.status(400).json({ success: false, message: "No files uploaded" });
    }

    const result = await usersService.addDocuments(userId, files);
    return res.status(200).json({
      success: true,
      ...result
    });
  });
}

export const usersController = new UsersController();
