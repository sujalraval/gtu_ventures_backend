import { Router } from "express";
import { UCController } from "./uc.controller";
import { authenticate, authorize } from "../../common/middleware/auth.middleware";

const router = Router();
const ucController = new UCController();

// All UC routes require authentication
router.use(authenticate);

// Budget Heads
router.get("/budget-heads/:grantId", ucController.getBudgetHeads);
router.post("/budget-heads", authorize(["SUPER_ADMIN", "ADMIN"]), ucController.createBudgetHead);

// Entries
router.get("/entries/:trancheId", ucController.getEntries);
router.post("/entries", ucController.createEntry);
router.put("/entries/:id", ucController.updateEntry);
router.delete("/entries/:id", ucController.deleteEntry);

// UC
router.get("/certificate/:trancheId", ucController.getUC);
router.post("/certificate", ucController.submitUC);
router.get("/all", authorize(["SUPER_ADMIN", "ADMIN", "STAFF"]), ucController.getAllUCs);
router.post("/review/:id", authorize(["SUPER_ADMIN", "ADMIN"]), ucController.reviewUC);

export default router;
