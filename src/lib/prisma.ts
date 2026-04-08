import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

function buildPrismaClient(): PrismaClient {
  const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("No database URL configured");

  if (url.startsWith("file:")) {
    return new PrismaClient();
  }

  const libsql = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  const adapter = new PrismaLibSQL(libsql);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma || buildPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
