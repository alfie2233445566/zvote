import path from "path";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import XLSX from "xlsx";
import prisma from "../lib/prisma.js";
import { generateVoterAddress } from "../utils/wallet.js";
import * as emailService from "../services/emailService.js";

/**
 * POST /api/admin/bulk-register
 * Body: FormData with 'file' field containing .xlsx or .csv file
 * Returns: {
 *   created: number,
 *   rejected: [{rowNumber, reason}],
 *   emailsSent: number,
 *   emailStatus: string,
 *   createdUsers: [{ studentId, fullName, email, department, program, level, temporaryPassword }]
 * }
 */
export async function bulkRegisterStudents(req, res) {
  // Check user is admin
  if (req.user?.role !== "ADMIN") {
    return res.status(403).json({ error: "Admin access required." });
  }

  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded. Please select a CSV or Excel file." });
  }

  const fileExt = path.extname(req.file.originalname).toLowerCase();
  if (![".xlsx", ".csv", ".xls"].includes(fileExt)) {
    return res.status(400).json({ error: "File must be .xlsx, .xls or .csv format." });
  }

  try {
    // Parse the file using XLSX which handles both CSV (with quotes/newlines) and Excel
    const workbook = XLSX.read(req.file.buffer, { type: "buffer", raw: false });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return res.status(400).json({ error: "Uploaded workbook contains no sheets." });
    }

    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    if (rawRows.length === 0) {
      return res.status(400).json({ error: "Uploaded spreadsheet is empty." });
    }

    // Normalize headers of rows to standard keys
    const rows = rawRows.map((rawRow) => {
      const normalized = {};
      for (const key of Object.keys(rawRow)) {
        const val = String(rawRow[key] || "").trim();
        const k = key.toLowerCase().trim().replace(/[_\-\s]+/g, " ");

        if (k === "full name" || k === "name" || k === "fullname" || k === "student name") {
          normalized.fullName = val;
        } else if (
          k === "index number" ||
          k === "student id" ||
          k === "index" ||
          k === "studentid" ||
          k === "indexnumber" ||
          k === "id"
        ) {
          normalized.indexNumber = val;
        } else if (k === "email" || k === "email address" || k === "student email") {
          normalized.email = val;
        } else if (
          k === "program of study" ||
          k === "program" ||
          k === "programme" ||
          k === "programme of study" ||
          k === "course"
        ) {
          normalized.program = val;
        } else if (k === "department" || k === "dept" || k === "faculty") {
          normalized.department = val;
        } else if (k === "level" || k === "year" || k === "academic level") {
          normalized.level = val;
        } else {
          normalized[key] = val;
        }
      }
      return normalized;
    });

    // Validate headers on first row
    const headers = Object.keys(rows[0] || {});
    const requiredFields = ["fullName", "indexNumber", "email", "program", "department", "level"];
    const missingFields = requiredFields.filter((f) => !headers.includes(f));
    if (missingFields.length > 0) {
      return res.status(400).json({
        error: `Missing required columns: ${missingFields.join(", ")}. Please check your spreadsheet header names.`,
      });
    }

    // Fetch existing users from DB to validate uniqueness
    const existingUsers = await prisma.user.findMany({
      select: { email: true, studentId: true },
    });
    const existingEmails = new Set(existingUsers.map((u) => u.email.toLowerCase()));
    const existingIndexNumbers = new Set(existingUsers.map((u) => u.studentId.toLowerCase()));

    const seenEmails = new Set();
    const seenIndexNumbers = new Set();

    const results = {
      created: 0,
      rejected: [],
      emailsSent: 0,
      emailStatus: "not_configured",
      createdUsers: [],
    };

    let attemptedEmails = 0;
    let successfulEmails = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // +2 for header row and 1-based indexing

      // Validation
      const validation = validateRow(row, rowNumber, {
        existingEmails,
        existingIndexNumbers,
        seenEmails,
        seenIndexNumbers,
      });

      if (!validation.valid) {
        results.rejected.push({ rowNumber, reason: validation.reason, studentId: row.indexNumber || "N/A" });
        continue;
      }

      try {
        // Generate temporary password (10 alphanumeric chars + special symbol)
        const tempPassword = crypto.randomBytes(4).toString("hex") + "A1!";
        const passwordHash = await bcrypt.hash(tempPassword, 10);

        const studentId = row.indexNumber.toString().trim();
        const email = row.email.toString().trim().toLowerCase();
        const fullName = row.fullName.toString().trim();
        const program = row.program.toString().trim();
        const department = row.department.toString().trim();
        const level = row.level.toString().trim();

        // Create user in Postgres
        const walletAddress = generateVoterAddress();
        await prisma.user.create({
          data: {
            studentId,
            email,
            fullName,
            program,
            department,
            level,
            passwordHash,
            walletAddress,
            role: "VOTER",
            mustChangePassword: true,
          },
        });

        results.created++;
        results.createdUsers.push({
          studentId,
          fullName,
          email,
          department,
          program,
          level,
          temporaryPassword: tempPassword,
        });

        seenEmails.add(email);
        seenIndexNumbers.add(studentId.toLowerCase());
        existingEmails.add(email);
        existingIndexNumbers.add(studentId.toLowerCase());
      } catch (err) {
        console.error(`Failed to create account for row ${rowNumber}:`, err);
        results.rejected.push({
          rowNumber,
          studentId: row.indexNumber || "N/A",
          reason: "Database error while creating account.",
        });
      }
    }

    // Intermittently dispatch temporary passwords in rate-limited batches to prevent SMTP blocking
    if (results.createdUsers.length > 0) {
      emailService.queueBulkRegistrationEmails(results.createdUsers);
      results.emailsSent = results.createdUsers.length;
      results.emailStatus = (process.env.RESEND_API_KEY || process.env.SMTP_HOST || process.env.SMTP_SERVICE) ? "queued_for_delivery" : "smtp_not_configured";
    }

    return res.status(201).json(results);
  } catch (err) {
    console.error("bulkRegisterStudents failed:", err);
    return res.status(500).json({ error: "Failed to parse spreadsheet file: " + err.message });
  }
}

function validateRow(row, rowNumber, { existingEmails, existingIndexNumbers, seenEmails, seenIndexNumbers }) {
  const fields = ["fullName", "indexNumber", "email", "program", "department", "level"];

  for (const field of fields) {
    if (!row[field] || String(row[field]).trim() === "") {
      return { valid: false, reason: `Missing required field: ${field}` };
    }
  }

  const email = String(row.email).trim().toLowerCase();
  const indexNumber = String(row.indexNumber).trim();
  const indexNumberLower = indexNumber.toLowerCase();

  // Check for invalid email format
  if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    return { valid: false, reason: `Invalid email format: ${email}` };
  }

  // Check for duplicates in DB
  if (existingEmails.has(email)) {
    return { valid: false, reason: `Email already registered: ${email}` };
  }

  if (existingIndexNumbers.has(indexNumberLower)) {
    return { valid: false, reason: `Index number already registered: ${indexNumber}` };
  }

  // Check for duplicates within the file
  if (seenEmails.has(email)) {
    return { valid: false, reason: `Duplicate email in file: ${email}` };
  }

  if (seenIndexNumbers.has(indexNumberLower)) {
    return { valid: false, reason: `Duplicate index number in file: ${indexNumber}` };
  }

  return { valid: true };
}

