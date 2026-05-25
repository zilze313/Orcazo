// GET /api/admin/health
// Returns health and usage info for all services.

import { withAdmin, ok } from '@/lib/api';
import { db } from '@/lib/db';
import { checkHealth as checkSupabase } from '@/lib/supabase';
import { cacheStats } from '@/lib/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function checkDatabase(): Promise<{ ok: boolean; latencyMs: number }> {
  const start = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return { ok: true, latencyMs: Date.now() - start };
  } catch {
    return { ok: false, latencyMs: Date.now() - start };
  }
}

async function checkResend(): Promise<{ ok: boolean; configured: boolean; latencyMs: number; recentCount?: number }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, configured: false, latencyMs: 0 };

  const start = Date.now();
  try {
    const res = await fetch('https://api.resend.com/emails?limit=1', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    });
    const latencyMs = Date.now() - start;
    if (!res.ok) return { ok: false, configured: true, latencyMs };
    return { ok: true, configured: true, latencyMs };
  } catch {
    return { ok: false, configured: true, latencyMs: Date.now() - start };
  }
}

async function getDbStats() {
  const [employees, admins, messages, signups, payouts] = await Promise.all([
    db.employee.count(),
    db.admin.count(),
    db.chatMessage.count({ where: { fromAdmin: false, readAt: null } }),
    db.creatorSignupRequest.count({ where: { status: 'PENDING' } }),
    db.payoutRequest.count({ where: { status: { in: ['REQUESTED', 'IN_PROGRESS'] } } }),
  ]);
  return { employees, admins, unreadMessages: messages, pendingSignups: signups, pendingPayouts: payouts };
}

export const GET = withAdmin(async () => {
  const [database, supabase, resend, dbStats] = await Promise.all([
    checkDatabase(),
    checkSupabase(),
    checkResend(),
    getDbStats(),
  ]);

  return ok({
    uptime: process.uptime(),
    cache: cacheStats(),
    services: {
      database,
      supabase: { ...supabase, bucket: process.env.SUPABASE_BUCKET || 'media' },
      resend,
    },
    stats: dbStats,
    env: {
      nodeEnv: process.env.NODE_ENV,
      appUrl: process.env.NEXT_PUBLIC_APP_URL,
    },
  });
}, { permission: 'health' });
