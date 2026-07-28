import { Router } from "express";
import * as milestoneController from "./milestones.controller";
import { authenticate, authorize } from "../../common/middleware/auth.middleware";

const router = Router();

// ── Admin routes ──────────────────────────────────────────────────────────────
router.post("/", authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), milestoneController.createMilestone);
router.get("/", authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), milestoneController.getAllMilestones);
router.get("/alerts", authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), milestoneController.getAlerts);
router.patch("/:id/approve", authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), milestoneController.approveMilestone);

// ── Category routes ───────────────────────────────────────────────────────────
router.post("/categories", authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), milestoneController.createCategory);
router.get("/categories", authenticate, milestoneController.getCategories);
router.patch("/categories/:name", authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), milestoneController.updateCategory);
router.delete("/categories/:name", authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), milestoneController.deleteCategory);

// ── Milestone Template routes (grant-scoped) ──────────────────────────────────
router.post("/templates/:grantId", authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), milestoneController.createTemplate);
router.get("/templates/:grantId", authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), milestoneController.getTemplatesByGrant);
router.patch("/templates/item/:id", authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), milestoneController.updateTemplate);
router.delete("/templates/item/:id", authenticate, authorize(['ADMIN', 'SUPER_ADMIN']), milestoneController.deleteTemplate);

// ── Milestone Detail (startup + admin) ───────────────────────────────────────
router.get("/:id/detail", authenticate, milestoneController.getMilestoneDetail);

// ── Startup / Common routes ───────────────────────────────────────────────────
router.get("/startup/:startupId", authenticate, milestoneController.getStartupMilestones);
router.patch("/:id/progress", authenticate, milestoneController.updateMilestoneProgress);

export default router;
