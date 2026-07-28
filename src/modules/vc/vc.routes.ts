import { Router } from "express";
import * as vc from "./vc.controller";
import { authenticate, authorize } from "../../common/middleware/auth.middleware";

const router = Router();

// ── Public ────────────────────────────────────────────────────────────────────
router.post("/apply", vc.applyAsVc);

// ── VC-authenticated ──────────────────────────────────────────────────────────
router.get("/firm/me", authenticate, vc.getMyFirm);
router.put("/firm/me", authenticate, vc.updateMyFirm);
router.get("/showcase", authenticate, vc.getShowcase);
router.get("/dashboard/stats", authenticate, vc.getDashboardStats);
router.get("/interests", authenticate, vc.getMyInterests);
router.post("/interests", authenticate, vc.expressInterest);
router.put("/interests/:id/stage", authenticate, vc.updateInterestStage);
router.post("/interests/:id/nda", authenticate, vc.acceptNda);
router.post("/interests/:id/outcome", authenticate, vc.recordOutcome);
router.get("/meetings", authenticate, vc.getMyMeetings);
router.post("/meetings", authenticate, vc.scheduleMeeting);
router.put("/meetings/:id", authenticate, vc.updateMeeting);

// ── Startup side ──────────────────────────────────────────────────────────────
router.get("/startup/requests", authenticate, vc.getStartupIncomingRequests);

// ── Admin ─────────────────────────────────────────────────────────────────────
router.get("/admin/firms", authenticate, authorize(["ADMIN", "SUPER_ADMIN"]), vc.getAllFirms);
router.put("/admin/firms/:id", authenticate, authorize(["ADMIN", "SUPER_ADMIN"]), vc.approveFirm);

export default router;
