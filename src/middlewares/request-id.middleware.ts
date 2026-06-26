import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const incoming = req.header("x-request-id");
  req.id = incoming && incoming.length <= 80 ? incoming : randomUUID();
  res.setHeader("x-request-id", req.id);
  next();
};
