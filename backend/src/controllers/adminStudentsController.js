import prisma from "../lib/prisma.js";

/**
 * GET /api/admin/students
 * Returns a table listing all registered students with full name, index number, email,
 * department, program, level, and voting status for each active election.
 * Supports filtering by department and program.
 * Admin-only, verified by authMiddleware.
 *
 * Query parameters:
 * - department: string (optional) - filter by department
 * - program: string (optional) - filter by program
 * - level: string (optional) - filter by level
 * - search: string (optional) - search by name or index number
 */
export async function getStudents(req, res) {
  const { department, program, level, search } = req.query;

  if (req.user?.role !== "ADMIN") {
    return res.status(403).json({ error: "Admin access required." });
  }

  try {
    // Build where clause for filtering
    const where = {
      role: "VOTER", // Only students, not admins
    };

    if (department) where.department = department;
    if (program) where.program = program;
    if (level) where.level = level;
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: "insensitive" } },
        { studentId: { contains: search, mode: "insensitive" } },
      ];
    }

    // Fetch all students matching the filter (excluding vote receipts to ensure secret ballot / voter privacy)
    const students = await prisma.user.findMany({
      where,
      select: {
        id: true,
        studentId: true,
        fullName: true,
        email: true,
        department: true,
        program: true,
        level: true,
      },
      orderBy: { fullName: "asc" },
    });

    const studentData = students.map((student) => ({
      id: student.id,
      studentId: student.studentId,
      fullName: student.fullName,
      email: student.email,
      department: student.department || "N/A",
      program: student.program || "N/A",
      level: student.level || "N/A",
    }));

    return res.json({
      students: studentData,
      total: studentData.length,
    });
  } catch (err) {
    console.error("getStudents failed:", err);
    return res.status(500).json({ error: "Failed to fetch students." });
  }
}

/**
 * GET /api/admin/departments
 * Returns a list of all unique departments in the system for filter dropdowns.
 * Admin-only.
 */
export async function getDepartments(req, res) {
  if (req.user?.role !== "ADMIN") {
    return res.status(403).json({ error: "Admin access required." });
  }

  try {
    const departments = await prisma.user.findMany({
      where: { role: "VOTER", department: { not: null } },
      distinct: ["department"],
      select: { department: true },
      orderBy: { department: "asc" },
    });

    return res.json({
      departments: departments.map((d) => d.department).filter(Boolean),
    });
  } catch (err) {
    console.error("getDepartments failed:", err);
    return res.status(500).json({ error: "Failed to fetch departments." });
  }
}

/**
 * GET /api/admin/programs
 * Returns a list of all unique programs in the system for filter dropdowns.
 * Admin-only.
 */
export async function getPrograms(req, res) {
  if (req.user?.role !== "ADMIN") {
    return res.status(403).json({ error: "Admin access required." });
  }

  try {
    const programs = await prisma.user.findMany({
      where: { role: "VOTER", program: { not: null } },
      distinct: ["program"],
      select: { program: true },
      orderBy: { program: "asc" },
    });

    return res.json({
      programs: programs.map((p) => p.program).filter(Boolean),
    });
  } catch (err) {
    console.error("getPrograms failed:", err);
    return res.status(500).json({ error: "Failed to fetch programs." });
  }
}
