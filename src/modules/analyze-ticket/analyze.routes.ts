import { Router } from "express";
import { asyncHandler } from "../../shared/utils/async-handler";
import { validateBody } from "../../middlewares/validate.middleware";
import { analyzeTicketController } from "./analyze.controller";
import { analyzeTicketRequestSchema } from "./analyze.schema";

export const analyzeRoutes = Router();

analyzeRoutes.post("/", validateBody(analyzeTicketRequestSchema), asyncHandler(analyzeTicketController));
