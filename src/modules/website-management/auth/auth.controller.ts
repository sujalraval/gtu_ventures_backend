// @ts-nocheck
import { Request, Response } from 'express';
import authService from './auth.service';

class AuthController {
  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async getMe(req: Request, res: Response) {
    try {
      const result = await authService.getMe(req.user.id);
      res.json(result);
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  }
}

export default new AuthController();
