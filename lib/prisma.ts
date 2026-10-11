import { PrismaClient } from "@prisma/client";

/**
 * The database (Neon) suspends when idle: the first connection afterwards can take several seconds, longer than
 * Prisma's default 10 s pool timeout when a page fires several queries at once. Wait longer instead of failing.
 */
function databaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url || /[?&]pool_timeout=/.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}pool_timeout=30`;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const url = databaseUrl();

export const prisma = globalForPrisma.prisma ?? new PrismaClient(url ? { datasources: { db: { url } } } : undefined);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
