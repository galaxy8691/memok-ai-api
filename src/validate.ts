import type { Response, NextFunction } from "express";
import type { ZodType } from "zod";
import type { ValidatedRequest } from "./types.js";
import { logger } from "./logger.js";

export function validateBody<T>(schema: ZodType<T>) {
  return (req: ValidatedRequest<T, unknown>, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const issues = result.error.issues.map((i) => ({
        path: i.path,
        message: i.message,
      }));
      logger.warn({ issues, path: req.path }, "Request validation failed");
      res.status(400).json({ error: "validation_failed", issues });
      return;
    }
    req.validatedBody = result.data;
    next();
  };
}

export function validateQuery<T>(schema: ZodType<T>) {
  return (req: ValidatedRequest<unknown, T>, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const issues = result.error.issues.map((i) => ({
        path: i.path,
        message: i.message,
      }));
      logger.warn({ issues, path: req.path }, "Query validation failed");
      res.status(400).json({ error: "validation_failed", issues });
      return;
    }
    req.validatedQuery = result.data;
    next();
  };
}
