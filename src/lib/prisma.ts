import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

function buildPrismaClient(): PrismaClient {
  const raw = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
  if (!raw) throw new Error("No database URL configured");

  const url = raw.trim().replace(/^["']/, "").replace(/["']$/, "");

  if (url.startsWith("file:")) {
    return new PrismaClient();
  }

  if (!/^(libsql|https?|wss?):\/\//.test(url)) {
    throw new Error(
      `Invalid database URL scheme (length=${url.length}, prefix=${JSON.stringify(url.slice(0, 8))}). Expected libsql://, https://, http://, ws://, or wss://.`,
    );
  }

  const libsql = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN?.trim(),
  });
  const adapter = new PrismaLibSQL(libsql);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma || buildPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
