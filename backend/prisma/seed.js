// Seeds an initial administrator account so the admin dashboard can be accessed on
// a freshly migrated database. Run with `npm run seed` (see backend/package.json).
//
// IMPORTANT: change the default admin password immediately in a real deployment.

import "dotenv/config";
import bcrypt from "bcryptjs";
import prisma from "../src/lib/prisma.js";
import { generateVoterAddress } from "../src/utils/wallet.js";

const DEFAULT_ADMIN = {
  studentId: "ADMIN001",
  fullName: "Election Administrator",
  email: process.env.ADMIN_EMAIL || "alfie2233445566@gmail.com",
  password: "Admin@123!",
};

async function main() {
  const existing = await prisma.user.findUnique({ where: { studentId: DEFAULT_ADMIN.studentId } });
  const passwordHash = await bcrypt.hash(DEFAULT_ADMIN.password, 10);

  if (existing) {
    console.log(`Admin user "${DEFAULT_ADMIN.studentId}" already exists. Updating password and email.`);
    await prisma.user.update({
      where: { studentId: DEFAULT_ADMIN.studentId },
      data: {
        passwordHash,
        email: existing.email || DEFAULT_ADMIN.email,
        mustChangePassword: false,
      },
    });
    console.log("Updated admin user successfully.");
    return;
  }

  const walletAddress = generateVoterAddress();

  await prisma.user.create({
    data: {
      studentId: DEFAULT_ADMIN.studentId,
      fullName: DEFAULT_ADMIN.fullName,
      email: DEFAULT_ADMIN.email,
      passwordHash,
      walletAddress,
      role: "ADMIN",
      mustChangePassword: false,
    },
  });

  console.log("Seeded admin user:");
  console.log(`  studentId: ${DEFAULT_ADMIN.studentId}`);
  console.log(`  email:     ${DEFAULT_ADMIN.email}`);
  console.log(`  password:  ${DEFAULT_ADMIN.password}`);
  console.log("  Please log in and note this is for local/testnet development only.");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
