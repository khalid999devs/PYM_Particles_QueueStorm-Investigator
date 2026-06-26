import type { Request, Response } from "express";
import { errorResponse } from "../shared/utils/response";

export const notFoundMiddleware = (_req: Request, res: Response): void => {
  res.status(404).json(errorResponse("Route not found", "NOT_FOUND"));
};
