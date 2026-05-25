// GET /api/auth/pending-otp?email=...
// Only works when autoLoginEnabled = true in admin settings.
// Returns the OTP that the Cloudflare email worker stored in Allowlist.pendingOtp
// (delivered from the proxy Gmail inbox). Client polls this after requesting a code.
// ⚠️  Intentionally exposes the OTP — only enable in trusted environments.

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { fail, ok, applyLimit, getClientIp } from '@/lib/api';
import { limits } from '@/lib/ratelimit';
import { getAutoLoginEnabled } from '@/lib/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OTP_TTL_MS = 5 * 60 * 1000; // OTPs older than 5 min are ignored

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const limit = applyLimit(`ip:${ip}:pending-otp`, limits.ipSendCode);
  if (limit) return limit;

  const autoLogin = await getAutoLoginEnabled();
  if (!autoLogin) return fail(403, 'Auto-login is not enabled', 'DISABLED');

  const email = new URL(req.url).searchParams.get('email')?.trim().toLowerCase();
  if (!email) return fail(400, 'email is required');

  const row = await db.allowlist.findUnique({
    where: { email },
    select: { pendingOtp: true, pendingOtpAt: true },
  });

  if (!row?.pendingOtp || !row.pendingOtpAt) {
    return ok({ otp: null });
  }

  // Reject stale OTPs
  const age = Date.now() - row.pendingOtpAt.getTime();
  if (age > OTP_TTL_MS) {
    return ok({ otp: null });
  }

  return ok({ otp: row.pendingOtp });
}
