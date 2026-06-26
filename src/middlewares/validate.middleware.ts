import type { NextFunction, Request, Response } from "express";
import type { z } from "zod";
import { AppError } from "../shared/errors/AppError";

export const validateBody =
  (schema: z.ZodType<unknown>) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      next(AppError.validation("Invalid request body"));
      return;
    }

    req.body = result.data;
    next();
  };
