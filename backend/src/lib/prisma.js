import { PrismaClient } from "@prisma/client";

// A single shared Prisma Client instance for the whole process. Instantiating more
// than one PrismaClient (e.g. per-request) exhausts the Postgres connection pool.
const prisma = new PrismaClient();

export default prisma;
