import { Prisma } from '@prisma/client';

/**
 * Maps complex Prisma error codes into user-friendly, readable messages.
 * This prevents leaking technical details and source code to the frontend.
 */
export const getFriendlyPrismaMessage = (error: any): string => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002': {
        // Unique constraint failed
        const fields = (error.meta?.target as string[]) || [];
        const fieldName = fields.length > 0 ? fields[fields.length - 1] : 'record';
        return `A ${fieldName} with this value already exists. Please use a unique value.`;
      }
      case 'P2003':
        // Foreign key constraint failed
        return 'This action cannot be completed because it depends on another missing record.';
      case 'P2025':
        // Record to update not found
        return 'The record you are trying to update was not found.';
      case 'P2000':
        return 'The value provided is too long for one of the fields.';
      case 'P2001':
        return 'The record searched for does not exist.';
      default:
        // For other known errors, provide a generic but clean message
        return `Database operation failed (Error: ${error.code}). Please try again later.`;
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    if (process.env.NODE_ENV === 'development') {
      return `Validation Error: ${error.message.split('\n')[0]}`;
    }
    return 'The information provided format is incorrect. Please check all fields.';
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return 'We are having trouble connecting to our database. Please try again in a few minutes.';
  }

  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    return 'An unknown error occurred while processing your request. Please try again.';
  }

  // Fallback for non-Prisma errors or when message contains too much technical info
  const rawMessage = error.message || '';
  if (rawMessage.includes('prisma') || rawMessage.includes('transaction') || rawMessage.includes('sql')) {
    return 'A database error occurred. Our team has been notified.';
  }

  return rawMessage || 'An unexpected error occurred.';
};
