import { Request, Response, NextFunction } from 'express';
import { ZodObject, ZodError } from 'zod';
import { BadRequestError } from '../utils/apiError';

export const validate = (schema: ZodObject<any>) => 
  (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessage = error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join(', ');
        return next(new BadRequestError(errorMessage));
      }
      next(error);
    }
  };
