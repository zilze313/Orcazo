import { ok } from '@/lib/api';
import { ensureAdminBootstrap } from '@/lib/admin-bootstrap';
import { cacheStats } from '@/lib/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  // Bootstrap admin on first hit. Idempotent.
  await ensureAdminBootstrap().catch(() => {});
  return ok({ ok: true, cache: cacheStats(), uptime: process.uptime() });
}
