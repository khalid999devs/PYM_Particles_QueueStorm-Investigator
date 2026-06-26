import type { ErrorRequestHandler } from "express";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { AppError } from "../shared/errors/AppError";
import { errorResponse } from "../shared/utils/response";

export const errorMiddleware: ErrorRequestHandler = (err, req, res, _next): void => {
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json(errorResponse("Invalid request body", "VALIDATION_ERROR"));
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json(errorResponse(err.message, err.code));
    return;
  }

  logger.error(
    {
      err: env.NODE_ENV === "production" ? undefined : err,
      requestId: req.id,
      path: req.path
    },
    "Unhandled request error"
  );

  res.status(500).json(errorResponse("Internal server error", "INTERNAL_ERROR"));
};
