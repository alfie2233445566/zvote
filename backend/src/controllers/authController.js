import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import prisma from "../lib/prisma.js";
import * as emailService from "../services/emailService.js";
import { SERVER_BOOT_ID } from "../middleware/authMiddleware.js";

/**
 * POST /api/auth/login
 * Body: { studentId: string, password: string }
 * Returns: { token, user: { id, studentId, fullName, role, mustChangePassword } }
 *
 * Unified login for both students and admins. The backend checks which account type
 * matches the credentials and issues a JWT with the role included.
 */
export async function login(req, res) {
  const { studentId, password } = req.body;

  if (!studentId || !password) {
    return res.status(400).json({ error: "studentId and password are required." });
  }

  const user = await prisma.user.findUnique({ where: { studentId } });
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials." });
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    return res.status(401).json({ error: "Invalid credentials." });
  }

  const token = jwt.sign(
    {
      id: user.id,
      studentId: user.studentId,
      role: user.role,
      walletAddress: user.walletAddress,
      department: user.department,
      bootId: SERVER_BOOT_ID,
    },
    process.env.JWT_SECRET,
    { expiresIn: "12h" },
  );

  return res.json({
    token,
    user: {
      id: user.id,
      studentId: user.studentId,
      fullName: user.fullName,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      department: user.department,
      program: user.program,
      level: user.level,
      walletAddress: user.walletAddress,
    },
  });
}

/**
 * GET /api/auth/me
 * Validates the caller's JWT against the current server boot session.
 */
export async function getMe(req, res) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        studentId: true,
        fullName: true,
        role: true,
        mustChangePassword: true,
        department: true,
        program: true,
        level: true,
        walletAddress: true,
      },
    });

    if (!user) {
      return res.status(401).json({ error: "User no longer exists." });
    }

    return res.json({ user });
  } catch (err) {
    return res.status(500).json({ error: "Failed to verify session." });
  }
}

/**
 * POST /api/auth/request-password-reset
 * Body: { email: string }
 * Returns: { message: "Reset link sent to email" }
 *
 * Student enters their email, and receives a time-limited password reset link.
 */
export async function requestPasswordReset(req, res) {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required." });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // For security, don't reveal if email exists -- just pretend we sent it
    return res.json({ message: "If an account with that email exists, a reset link has been sent." });
  }

  try {
    // Generate a random reset token
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    // Store hashed token in DB with 1-hour expiry
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        token: tokenHash,
        expiresAt,
      },
    });

    // Build reset URL (frontend will handle the /reset-password route)
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}&email=${encodeURIComponent(user.email)}`;

    // Send email
    await emailService.sendPasswordResetEmail(user.email, rawToken, resetUrl);

    return res.json({ message: "If an account with that email exists, a reset link has been sent." });
  } catch (err) {
    console.error("requestPasswordReset failed:", err);
    return res.status(500).json({ error: "Failed to send reset email." });
  }
}

/**
 * POST /api/auth/reset-password
 * Body: { email: string, token: string, newPassword: string }
 * Returns: { message: "Password reset successfully" }
 *
 * User submits the reset token and new password. The token is verified (hash check + expiry)
 * and the password is updated.
 */
export async function resetPassword(req, res) {
  const { email, token, newPassword } = req.body;

  if (!email || !token || !newPassword) {
    return res.status(400).json({ error: "Email, token, and newPassword are required." });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or token." });
    }

    // Hash the provided token and look for a matching reset record
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const resetRecord = await prisma.passwordReset.findUnique({
      where: { token: tokenHash },
    });

    if (!resetRecord || resetRecord.userId !== user.id) {
      return res.status(401).json({ error: "Invalid email or token." });
    }

    // Check expiry
    if (resetRecord.expiresAt < new Date()) {
      return res.status(401).json({ error: "Reset token has expired." });
    }

    // Check if already used
    if (resetRecord.used) {
      return res.status(401).json({ error: "Reset token has already been used." });
    }

    // Update password and mark reset token as used
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustChangePassword: false,
      },
    });

    await prisma.passwordReset.update({
      where: { token: tokenHash },
      data: { used: true },
    });

    return res.json({ message: "Password reset successfully." });
  } catch (err) {
    console.error("resetPassword failed:", err);
    return res.status(500).json({ error: "Failed to reset password." });
  }
}

/**
 * POST /api/auth/change-password
 * Body: { currentPassword: string, newPassword: string }
 * Requires: Authentication (requireAuth middleware)
 *
 * Logged-in user changes their password (including the initial forced change).
 */
export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  const { id: userId } = req.user;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "currentPassword and newPassword are required." });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // Verify current password
    const passwordMatches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({ error: "Current password is incorrect." });
    }

    // Update password
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        mustChangePassword: false,
      },
    });

    return res.json({ message: "Password changed successfully." });
  } catch (err) {
    console.error("changePassword failed:", err);
    return res.status(500).json({ error: "Failed to change password." });
  }
}
