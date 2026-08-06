// @ts-nocheck
import { Request, Response } from 'express';
import prisma from '../../../lib/prisma';
import bcrypt from 'bcryptjs';

exports.getAll = async (req: Request, res: Response) => {
  try {
    const users = await prisma.webUser.findMany({ 
      select: { id: true, email: true, role: true, createdAt: true }
    });
    res.json(users);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req: Request, res: Response) => {
  try {
    const { email, password, role } = req.body;
    const password_hash = await bcrypt.hash(password, 10);
    const user = await prisma.webUser.create({
      data: { email, password_hash, role: role || 'VIEWER' },
      select: { id: true, email: true, role: true }
    });
    res.status(201).json(user);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

exports.delete = async (req: Request, res: Response) => {
  try {
    await prisma.webUser.delete({ where: { id: parseInt(req.params.id as string) } });
    res.json({ message: 'Deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};