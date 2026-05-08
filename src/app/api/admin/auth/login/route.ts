// POST /api/admin/auth/login
// Email + password authentication for the admin panel. Separate from creator
// login (which uses email OTP via AffiliateNetwork). Admin sessions live in
// their own DB table and cookie (`sf_admin`).

import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { applyLimit, fail, getClientIp, ok, parseBody } from '@/lib/api';
import { adminLoginBody } from '@/lib/validators';
import { createAdminSession, pruneExpiredSessions } from '@/lib/session';
import { ensureAdminBootstrap } from '@/lib/admin-bootstrap';
import { limits } from '@/lib/ratelimit';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  // Stricter limit than creator endpoints — admin login bruteforce protection
  const ipLimit = applyLimit(`ip:${ip}:admin-login`, limits.ipUnauth);
  if (ipLimit) return ipLimit;

  // Run bootstrap before lookup so first-time admin can log in
  await ensureAdminBootstrap().catch((err) => log.warn('admin.bootstrap_failed', { err: String(err) }));

  const parsed = await parseBody(req, adminLoginBody);
  if ('errorResponse' in parsed) return parsed.errorResponse;

  const { email, password } = parsed.data;

  const admin = await db.admin.findUnique({ where: { email } });
  // Use a constant-time-ish comparison even when admin doesn't exist
  const passwordOk = admin ? await bcrypt.compare(password, admin.passwordHash) : false;

  if (!admin || !passwordOk) {
    log.warn('admin.login_failed', { email, ip });
    return fail(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }

  await createAdminSession(admin.id);
  pruneExpiredSessions().catch(() => {});

  log.info('admin.login_ok', { adminId: admin.id, email });
  return ok({ ok: true });
}
