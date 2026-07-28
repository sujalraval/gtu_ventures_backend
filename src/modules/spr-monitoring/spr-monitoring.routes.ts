import { Router } from "express";
import * as sprController from "./spr-monitoring.controller";
import { authenticate, authorize } from "../../common/middleware/auth.middleware";

const router = Router();

// Admin routes
router.get("/all", authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), sprController.getAllSPRs);
router.post("/assessment/:sprId", authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), sprController.submitAssessment);
router.get("/config", authenticate, sprController.getMasterConfig);

// Startup routes
router.post("/submit", authenticate, sprController.submitSPR);
router.get("/my", authenticate, sprController.getMySPRs);
router.get("/startup/:startupId", authenticate, sprController.getStartupSPRs);

export default router;
