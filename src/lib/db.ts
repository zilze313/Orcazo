// Single Prisma instance, hot-reload safe in dev.
import { PrismaClient } from '@prisma/client';

// Neon's free-tier compute sleeps when idle and can take several seconds to wake.
// Prisma's default 5s connect timeout sometimes fires before the database is
// awake, which surfaces as "Can't reach database server" → empty lists / HTTP 500.
// We give it more patience by bumping connect_timeout / pool_timeout on whatever
// DATABASE_URL the environment provides (works without editing the env var).
function resilientDbUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;
  const [bare, query] = url.split('?');
  const params = new URLSearchParams(query ?? '');
  if (!params.has('connect_timeout')) params.set('connect_timeout', '20');
  if (!params.has('pool_timeout'))    params.set('pool_timeout', '20');
  return `${bare}?${params.toString()}`;
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

const dbUrl = resilientDbUrl();

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    ...(dbUrl ? { datasources: { db: { url: dbUrl } } } : {}),
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
