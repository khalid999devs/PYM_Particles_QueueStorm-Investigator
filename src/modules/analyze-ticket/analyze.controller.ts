import type { Request, Response } from "express";
import { analyzeTicketRequestSchema } from "./analyze.schema";
import { analyzeTicket } from "./analyze.service";

export const analyzeTicketController = async (req: Request, res: Response): Promise<void> => {
  const input = analyzeTicketRequestSchema.parse(req.body);
  const result = await analyzeTicket(input);
  res.status(200).json(result);
};
