import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/apiError';
import { getFriendlyPrismaMessage } from '../utils/prismaErrorHandler';
import { Prisma } from '@prisma/client';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let { statusCode, message } = err;

  // Handle Prisma errors specifically to provide user-friendly messages
  if (err instanceof Prisma.PrismaClientInitializationError) {
    statusCode = 500;
    message = 'Database connection failed. Please contact support.';
  } else if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400;
    message = 'Invalid request parameters.';
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    statusCode = 400; // Default for known prisma errors
    message = getFriendlyPrismaMessage(err);
  } else if (err instanceof Prisma.PrismaClientUnknownRequestError) {
    statusCode = 500;
    message = 'An unknown database error occurred.';
  } else if (err.name === 'ZodError') {
    statusCode = 400;
    message = 'Validation Error';
    const validationErrors = err.errors.map((e: any) => ({
      path: e.path.join('.'),
      message: e.message,
    }));
    return res.status(statusCode).json({
      success: false,
      statusCode,
      message,
      errors: validationErrors,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
  } else if (!(err instanceof ApiError)) {
    statusCode = 500;
    message = 'Internal Server Error';
  }

  res.locals.errorMessage = err.message;

  const response = {
    success: false,
    statusCode: statusCode || 500,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  };

  if (process.env.NODE_ENV === 'development') {
    console.error('Error occurred:', {
      message: err.message,
      stack: err.stack,
      statusCode
    });
  }

  res.status(statusCode || 500).send(response);
};

