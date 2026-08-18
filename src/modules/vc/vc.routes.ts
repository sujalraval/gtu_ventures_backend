import { Router } from "express";
import * as vc from "./vc.controller";
import { authenticate, authorize } from "../../common/middleware/auth.middleware";

const router = Router();
const VC_OR_ADMIN = ["VC", "ADMIN", "SUPER_ADMIN"];

// ── Public ────────────────────────────────────────────────────────────────────
router.post("/apply", vc.applyAsVc);

// ── VC-authenticated ──────────────────────────────────────────────────────────
router.get("/firm/me", authenticate, authorize(VC_OR_ADMIN), vc.getMyFirm);
router.put("/firm/me", authenticate, authorize(VC_OR_ADMIN), vc.updateMyFirm);
router.get("/showcase", authenticate, authorize(VC_OR_ADMIN), vc.getShowcase);
router.get("/dashboard/stats", authenticate, authorize(VC_OR_ADMIN), vc.getDashboardStats);
router.get("/interests", authenticate, authorize(VC_OR_ADMIN), vc.getMyInterests);
router.post("/interests", authenticate, authorize(VC_OR_ADMIN), vc.expressInterest);
router.put("/interests/:id/stage", authenticate, authorize(VC_OR_ADMIN), vc.updateInterestStage);
router.post("/interests/:id/nda", authenticate, authorize(VC_OR_ADMIN), vc.acceptNda);
router.post("/interests/:id/outcome", authenticate, authorize(VC_OR_ADMIN), vc.recordOutcome);
router.get("/meetings", authenticate, authorize(VC_OR_ADMIN), vc.getMyMeetings);
router.post("/meetings", authenticate, authorize(VC_OR_ADMIN), vc.scheduleMeeting);
router.put("/meetings/:id", authenticate, authorize(VC_OR_ADMIN), vc.updateMeeting);

// ── Startup side ──────────────────────────────────────────────────────────────
router.get("/startup/requests", authenticate, authorize(["STARTUP", "ADMIN", "SUPER_ADMIN"]), vc.getStartupIncomingRequests);

// ── Admin ─────────────────────────────────────────────────────────────────────
router.get("/admin/firms", authenticate, authorize(["ADMIN", "SUPER_ADMIN"]), vc.getAllFirms);
router.put("/admin/firms/:id", authenticate, authorize(["ADMIN", "SUPER_ADMIN"]), vc.approveFirm);

export default router;
