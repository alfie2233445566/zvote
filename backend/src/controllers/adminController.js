import bcrypt from "bcryptjs";
import crypto from "crypto";
import xlsx from "xlsx";
import fs from "fs";
import path from "path";
import prisma from "../lib/prisma.js";
import { generateVoterAddress } from "../utils/wallet.js";
import * as blockchain from "../services/blockchain.js";
import * as emailService from "../services/emailService.js";

const SALT_ROUNDS = 10;

/**
 * POST /api/admin/register-voters (admin only)
 * Body: { voters: [{ studentId, fullName, password }] }
 *
 * Bulk-registers voters. Each voter is assigned a fresh on-chain identity
 * (walletAddress) and a bcrypt-hashed password. Existing studentIds are skipped
 * rather than overwritten, and reported back to the admin.
 */
export async function registerVoters(req, res) {
  const { voters } = req.body;

  if (!Array.isArray(voters) || voters.length === 0) {
    return res.status(400).json({ error: "voters must be a non-empty array." });
  }

  const created = [];
  const skipped = [];

  for (const voter of voters) {
    const { studentId, fullName, password, email, department, program, level } = voter;

    if (!studentId || !fullName || !password || !email || !department || !program || !level) {
      skipped.push({
        studentId: studentId || "(missing)",
        reason: "Missing one or more required fields (studentId, fullName, password, email, department, program, level).",
      });
      continue;
    }

    const existingId = await prisma.user.findUnique({ where: { studentId } });
    if (existingId) {
      skipped.push({ studentId, reason: "Index number already registered." });
      continue;
    }

    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      skipped.push({ studentId, reason: "Email already registered." });
      continue;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const walletAddress = generateVoterAddress();

    const user = await prisma.user.create({
      data: {
        studentId: studentId.trim(),
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        passwordHash,
        walletAddress,
        department: department.trim(),
        program: program.trim(),
        level: level.trim(),
        role: "VOTER",
      },
    });

    created.push({ studentId: user.studentId, fullName: user.fullName });
  }

  if (created.length > 0) {
    const emailRecipients = voters
      .filter(v => created.some(c => c.studentId === v.studentId))
      .map(v => ({
        email: v.email.trim().toLowerCase(),
        fullName: v.fullName.trim(),
        studentId: v.studentId.trim(),
        temporaryPassword: v.password,
      }));
    emailService.queueBulkRegistrationEmails(emailRecipients);
  }

  return res.status(201).json({ createdCount: created.length, created, skippedCount: skipped.length, skipped });
}

/**
 * POST /api/admin/register-voters-bulk (admin only)
 * Accepts a spreadsheet file via multer (single("file")) and registers voters.
 */
export async function registerVotersBulk(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: "Spreadsheet file is required." });
  }

  try {
    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet);

    if (rows.length === 0) {
      return res.status(400).json({ error: "Spreadsheet file is empty." });
    }

    // Fetch existing users to check duplicates
    const existingUsers = await prisma.user.findMany({
      select: { studentId: true, email: true },
    });
    const existingStudentIds = new Set(existingUsers.map((u) => u.studentId.toLowerCase()));
    const existingEmails = new Set(existingUsers.map((u) => u.email.toLowerCase()));

    const created = [];
    const rejected = [];

    const fileStudentIds = new Set();
    const fileEmails = new Set();

    for (let i = 0; i < rows.length; i++) {
      const rawRow = rows[i];
      const normalized = {};
      
      // Normalize keys to support case-insensitive/flexible headers
      for (const key of Object.keys(rawRow)) {
        const val = String(rawRow[key] || "").trim();
        const k = key.toLowerCase().trim().replace(/_/g, " ");
        if (k === "full name" || k === "name") {
          normalized.fullName = val;
        } else if (k === "index number" || k === "student id" || k === "index" || k === "studentid") {
          normalized.studentId = val;
        } else if (k === "email") {
          normalized.email = val;
        } else if (k === "program of study" || k === "program" || k === "programme") {
          normalized.program = val;
        } else if (k === "department") {
          normalized.department = val;
        } else if (k === "level") {
          normalized.level = val;
        }
      }

      const { fullName, studentId, email, program, department, level } = normalized;
      const rowNum = i + 2; // spreadsheet rows are 1-based, plus header row

      // Validate required fields
      if (!fullName || !studentId || !email || !program || !department || !level) {
        rejected.push({
          row: rowNum,
          studentId: studentId || "(missing)",
          reason: "Missing one or more required fields (full name, index number, email, program of study, department, level).",
        });
        continue;
      }

      const studentIdLower = studentId.toLowerCase();
      const emailLower = email.toLowerCase();

      // Check duplicates within the file
      if (fileStudentIds.has(studentIdLower)) {
        rejected.push({
          row: rowNum,
          studentId,
          reason: `Duplicate index number '${studentId}' within the uploaded file.`,
        });
        continue;
      }
      if (fileEmails.has(emailLower)) {
        rejected.push({
          row: rowNum,
          studentId,
          reason: `Duplicate email '${email}' within the uploaded file.`,
        });
        continue;
      }

      // Check duplicates against database
      if (existingStudentIds.has(studentIdLower)) {
        rejected.push({
          row: rowNum,
          studentId,
          reason: `Index number '${studentId}' is already registered in the system.`,
        });
        continue;
      }
      if (existingEmails.has(emailLower)) {
        rejected.push({
          row: rowNum,
          studentId,
          reason: `Email '${email}' is already registered in the system.`,
        });
        continue;
      }

      // Add to file check sets
      fileStudentIds.add(studentIdLower);
      fileEmails.add(emailLower);

      // Generate random temporary password
      const tempPassword = crypto.randomBytes(6).toString("hex") + "A1!";
      const passwordHash = await bcrypt.hash(tempPassword, SALT_ROUNDS);
      const walletAddress = generateVoterAddress();

      const user = await prisma.user.create({
        data: {
          studentId,
          email,
          fullName,
          passwordHash,
          walletAddress,
          department,
          program,
          level,
          mustChangePassword: true,
          role: "VOTER",
        },
      });

      // Send email (logs to console in dev)
      await emailService.sendBulkRegistrationEmail(email, fullName, studentId, tempPassword);

      created.push({
        studentId: user.studentId,
        fullName: user.fullName,
        email: user.email,
      });
    }

    return res.status(201).json({
      createdCount: created.length,
      created,
      rejectedCount: rejected.length,
      rejected,
    });
  } catch (err) {
    console.error("registerVotersBulk failed:", err);
    return res.status(500).json({ error: "Failed to parse or register voters from spreadsheet." });
  }
}

/**
 * GET /api/admin/election-stats (admin only)
 * Returns the participation count and percentage for a given election (or the active election).
 */
export async function electionStats(req, res) {
  const { electionId } = req.query;

  const election = electionId
    ? await prisma.election.findUnique({
        where: { id: electionId },
        include: { positions: true },
      })
    : await prisma.election.findFirst({
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        include: { positions: true },
      });

  if (!election) {
    return res.status(404).json({ error: "No election found." });
  }

  // If department-level election, calculate total voters in that department
  const totalVoters = election.scope === "DEPARTMENT" && election.targetDepartment
    ? await prisma.user.count({
        where: {
          role: "VOTER",
          department: { equals: election.targetDepartment, mode: "insensitive" },
        },
      })
    : await prisma.user.count({ where: { role: "VOTER" } });

  const onChainActive = await blockchain.isElectionActive(election.contractAddress);

  const positionStats = await Promise.all(
    election.positions.map(async (position) => {
      const votesCast = await prisma.voteReceipt.count({ where: { positionId: position.id } });
      return {
        positionId: position.id,
        title: position.title,
        votesCast,
        totalVoters,
        participationPercent: totalVoters === 0 ? 0 : Number(((votesCast / totalVoters) * 100).toFixed(2)),
        onChainActive,
      };
    }),
  );

  const allElections = await prisma.election.findMany({
    select: { id: true, title: true, status: true, scope: true, targetDepartment: true },
    orderBy: { createdAt: "desc" },
  });

  return res.json({
    election: {
      id: election.id,
      title: election.title,
      status: election.status,
      scope: election.scope,
      targetDepartment: election.targetDepartment,
    },
    totalVoters,
    positions: positionStats,
    allElections,
  });
}

/**
 * POST /api/admin/election-close (admin only)
 * Closes the active election, both in Postgres and on-chain.
 */
export async function closeElection(req, res) {
  const { electionId } = req.body;

  if (!electionId) {
    return res.status(400).json({ error: "electionId is required." });
  }

  const election = await prisma.election.findUnique({
    where: { id: electionId },
  });

  if (!election) {
    return res.status(404).json({ error: "Election not found." });
  }

  if (election.status !== "ACTIVE") {
    return res.status(400).json({ error: "Election is not active." });
  }

  try {
    await blockchain.endElection(election.contractAddress);

    const closed = await prisma.election.update({
      where: { id: election.id },
      data: { status: "CLOSED" },
    });

    return res.json({ election: closed });
  } catch (err) {
    console.error("closeElection failed:", err);
    return res.status(500).json({ error: "Failed to close the election on-chain." });
  }
}

/**
 * PUT /api/admin/profile (admin only)
 * Updates the admin's own profile info in Postgres.
 */
export async function updateAdminProfile(req, res) {
  const { fullName, email } = req.body;
  const { id: userId } = req.user;

  if (!fullName || !email) {
    return res.status(400).json({ error: "fullName and email are required." });
  }

  try {
    const existing = await prisma.user.findFirst({
      where: {
        email: email.trim().toLowerCase(),
        NOT: { id: userId },
      },
    });

    if (existing) {
      return res.status(409).json({ error: "Email is already in use by another user." });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
      },
    });

    return res.json({
      message: "Profile updated successfully.",
      user: {
        id: updatedUser.id,
        studentId: updatedUser.studentId,
        fullName: updatedUser.fullName,
        email: updatedUser.email,
        role: updatedUser.role,
      },
    });
  } catch (err) {
    console.error("updateAdminProfile failed:", err);
    return res.status(500).json({ error: "Failed to update profile." });
  }
}

/**
 * DELETE /api/admin/voters (admin only)
 * Deletes all registered voters (users with role === "VOTER") from the database.
 */
export async function deleteAllVoters(req, res) {
  try {
    const deleted = await prisma.user.deleteMany({
      where: { role: "VOTER" },
    });

    return res.json({
      message: "Successfully deleted all registered voters.",
      count: deleted.count,
    });
  } catch (err) {
    console.error("deleteAllVoters failed:", err);
    return res.status(500).json({ error: "Failed to delete registered voters." });
  }
}

/**
 * POST /api/admin/upload-image (admin only)
 * Uploads a candidate picture and returns the public URL path.
 */
export async function uploadImage(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded." });
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (!allowedTypes.includes(req.file.mimetype)) {
    return res.status(400).json({ error: "Only image files (JPEG, PNG, GIF, WEBP) are allowed." });
  }

  const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB restriction
  if (req.file.size > MAX_FILE_SIZE) {
    return res.status(400).json({ error: "Image file size exceeds the 2MB limit. Please compress or choose a smaller image." });
  }

  try {
    const uploadDir = path.resolve("uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const fileExt = path.extname(req.file.originalname) || ".png";
    const fileName = `${Date.now()}_${crypto.randomBytes(4).toString("hex")}${fileExt}`;
    const filePath = path.join(uploadDir, fileName);

    await fs.promises.writeFile(filePath, req.file.buffer);

    return res.status(200).json({
      message: "Image uploaded successfully.",
      pictureUrl: `/uploads/${fileName}`,
    });
  } catch (err) {
    console.error("uploadImage failed:", err);
    return res.status(500).json({ error: "Failed to save uploaded image." });
  }
}
