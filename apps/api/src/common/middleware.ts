import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from './errors';
import { logger } from './logger';

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function errorMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details ?? null,
      },
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: err.flatten().fieldErrors,
      },
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
    });
    return;
  }

  logger.error({ err, path: req.originalUrl, method: req.method }, 'Unhandled API error');

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: err instanceof Error ? err.message : 'An unexpected error occurred',
    },
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
  });
}
