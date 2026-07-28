import { Router } from "express";
import { usersController } from "./users.controller";
import { validate } from "../../common/middleware/validate.middleware";
import { createUserRouteSchema } from "./users.schema";
import { authenticate, authorize } from "../../common/middleware/auth.middleware";
import multer from "multer";
import path from "path";

const router = Router();

// Configure multer for file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Make sure this directory exists
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// All user management routes require authentication
router.use(authenticate);

router.post("/", authorize(["SUPER_ADMIN", "ADMIN"]), validate(createUserRouteSchema), usersController.createUser);
router.get("/staff", authorize(["SUPER_ADMIN", "ADMIN", "STAFF"]), usersController.getStaffUsers);
router.get("/", authorize(["SUPER_ADMIN", "ADMIN"]), usersController.getAllUsers);
router.get("/:id", usersController.getUserById); // Authenticated user can see specific user details (e.g. their own)
router.put("/:id", authorize(["SUPER_ADMIN", "ADMIN"]), validate(createUserRouteSchema), usersController.updateUser);
router.patch("/:id/deactivate", authorize(["SUPER_ADMIN", "ADMIN"]), usersController.deactivateUser);

// Document upload route
router.post(
  "/:userId/documents",
  upload.fields([
    { name: "photo", maxCount: 1 },
    { name: "signature", maxCount: 1 },
    { name: "esign", maxCount: 1 },
    { name: "supporting", maxCount: 10 },
  ]),
  usersController.uploadDocuments
);

export default router;
