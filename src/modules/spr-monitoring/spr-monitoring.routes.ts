import { Router } from "express";
import * as sprController from "./spr-monitoring.controller";
import { authenticate, authorize } from "../../common/middleware/auth.middleware";

const router = Router();

// Admin routes
// STAFF included: reviewing progress reports is a staff job, and excluding
// them here is why the SPR module looked broken from the staff portal.
// Deliberately role-only, with no authorizePermission — the granular
// permission tables are unseeded, so adding one would 403 every staff user.
router.get("/all", authenticate, authorize(['ADMIN', 'SUPER_ADMIN', 'STAFF']), sprController.getAllSPRs);
router.post("/assessment/:sprId", authenticate, authorize(['ADMIN', 'SUPER_ADMIN', 'STAFF']), sprController.submitAssessment);
router.get("/config", authenticate, sprController.getMasterConfig);

// Startup routes
router.post("/submit", authenticate, sprController.submitSPR);
router.get("/my", authenticate, sprController.getMySPRs);
router.get("/startup/:startupId", authenticate, sprController.getStartupSPRs);

export default router;
