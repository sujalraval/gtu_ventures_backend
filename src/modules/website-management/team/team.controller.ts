// @ts-nocheck
import { Request, Response } from 'express';
import prisma from '../../../lib/prisma';

exports.getAll = async (req: Request, res: Response) => {
  try {
    const data = await prisma.webTeamMember.findMany({ orderBy: { id: 'desc' } });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

exports.getById = async (req: Request, res: Response) => {
  try {
    const data = await prisma.webTeamMember.findUnique({ where: { id: parseInt(req.params.id as string) } });
    if (!data) return res.status(404).json({ error: 'Not found' });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

exports.create = async (req: Request, res: Response) => {
  try {
    const data = await prisma.webTeamMember.create({ data: req.body });
    res.status(201).json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

exports.update = async (req: Request, res: Response) => {
  try {
    const data = await prisma.webTeamMember.update({
      where: { id: parseInt(req.params.id as string) },
      data: req.body
    });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

exports.delete = async (req: Request, res: Response) => {
  try {
    await prisma.webTeamMember.delete({ where: { id: parseInt(req.params.id as string) } });
    res.json({ message: 'Deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};