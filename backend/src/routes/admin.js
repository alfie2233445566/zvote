import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/authMiddleware.js";
import multer from "multer";
import { registerVoters, registerVotersBulk, electionStats, closeElection, updateAdminProfile, deleteAllVoters, uploadImage } from "../controllers/adminController.js";
import { bulkRegisterStudents } from "../controllers/bulkRegistrationController.js";
import { getStudents, getDepartments, getPrograms } from "../controllers/adminStudentsController.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Profile settings
router.put("/profile", requireAuth, requireAdmin, updateAdminProfile);

// Voters management
router.delete("/voters", requireAuth, requireAdmin, deleteAllVoters);

// Legacy endpoints
router.post("/register-voters", requireAuth, requireAdmin, registerVoters);
router.post("/register-voters-bulk", requireAuth, requireAdmin, upload.single("file"), registerVotersBulk);
router.get("/election-stats", requireAuth, requireAdmin, electionStats);
router.post("/election-close", requireAuth, requireAdmin, closeElection);

// Image Upload
router.post("/upload-image", requireAuth, requireAdmin, upload.single("image"), uploadImage);

// Bulk registration
router.post("/bulk-register", requireAuth, requireAdmin, upload.single("file"), bulkRegisterStudents);

// Admin students view
router.get("/students", requireAuth, requireAdmin, getStudents);
router.get("/departments", requireAuth, requireAdmin, getDepartments);
router.get("/programs", requireAuth, requireAdmin, getPrograms);

export default router;
