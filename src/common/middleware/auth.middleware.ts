import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  // Also accept token from query param (needed for EventSource / SSE)
  const token = (authHeader && authHeader.split(' ')[1]) || (req.query.token as string);

  if (!token) {
    return res.status(401).json({ message: 'Authentication token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    (req as any).user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

export const authorize = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user || (!roles.includes(user.role) && !user.roles?.some((r: string) => roles.includes(r)))) {
      return res.status(403).json({ message: 'Unauthorized access' });
    }
    next();
  };
};

export const authorizePermission = (module: string, action: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    
    // Super Admin and Admin have all permissions
    const adminRoles = ['SUPER_ADMIN', 'ADMIN'];
    if (adminRoles.includes(user?.role) || user?.roles?.some((r: string) => adminRoles.includes(r))) {
      return next();
    }

    const userPermissions = user?.permissions || {};
    const modulePermissions = userPermissions[module] || [];

    if (!modulePermissions.includes(action)) {
      return res.status(403).json({ 
        message: `Forbidden: Missing permission ${action} for module ${module}` 
      });
    }

    next();
  };
};
