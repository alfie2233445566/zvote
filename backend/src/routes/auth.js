import { Router } from "express";
import { login, getMe, requestPasswordReset, resetPassword, changePassword } from "../controllers/authController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = Router();

// POST /api/auth/login -- accepts { studentId, password }, returns a JWT with role
router.post("/login", login);

// GET /api/auth/me -- verifies token and returns current user details
router.get("/me", requireAuth, getMe);

// POST /api/auth/request-password-reset -- accepts { email }
router.post("/request-password-reset", requestPasswordReset);

// POST /api/auth/reset-password -- accepts { email, token, newPassword }
router.post("/reset-password", resetPassword);

// POST /api/auth/change-password -- accepts { currentPassword, newPassword }, requires auth
router.post("/change-password", requireAuth, changePassword);

export default router;
