// POST /api/auth/send-code
//
// Two-email model: the user types their public email (creator@gmail.com).
// We look it up in the Allowlist, find the connected proxy email
// (proxy123@adminmail.com), and call AffiliateNetwork's send-code with the
// proxy email — so the OTP lands in the admin's inbox to relay to the user.

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  applyLimit, fail, getClientIp, ok, parseBody,
} from '@/lib/api';
import { limits } from '@/lib/ratelimit';
import { sendCodeBody } from '@/lib/validators';
import { sendLoginCode } from '@/lib/affiliatenetwork/client';
import { UpstreamError } from '@/lib/affiliatenetwork/types';
import { log } from '@/lib/logger';
import { notifyAdmins } from '@/lib/push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  const ipLimit = applyLimit(`ip:${ip}:send-code`, limits.ipSendCode);
  if (ipLimit) return ipLimit;

  const parsed = await parseBody(req, sendCodeBody);
  if ('errorResponse' in parsed) return parsed.errorResponse;

  const publicEmail = parsed.data.email;

  // 🔒 ALLOWLIST: never call upstream send-code for an email that isn't on it.
  // Lookup is by publicEmail; we forward the connected proxyEmail upstream.
  const allowed = await db.allowlist.findUnique({ where: { email: publicEmail } });
  if (!allowed) {
    log.info('auth.send_code_rejected_not_allowlisted', { publicEmail, ip });
    // Generic message to avoid email enumeration; UI surfaces a "request access" link.
    return fail(403, 'This email is not authorized to access Orcazo', 'NOT_ALLOWLISTED');
  }
  if (!allowed.proxyEmail) {
    log.warn('auth.send_code_no_proxy_connected', { publicEmail });
    return fail(403, 'Your account is not fully set up yet. Please contact your admin.', 'NO_PROXY');
  }

  try {
    const resp = await sendLoginCode(allowed.proxyEmail);
    if (!resp.success) {
      log.warn('auth.upstream_send_code_failed', { publicEmail, errorMsg: resp.errorMsg });
      return fail(400, resp.errorMsg || 'Could not send verification code', 'UPSTREAM_REJECTED');
    }

    // Create a LoginRequest row so admin can relay the code via Orcazo email
    db.loginRequest.create({
      data: { publicEmail, proxyEmail: allowed.proxyEmail, status: 'PENDING' },
    }).then(() => {
      // Push notification to admin devices — fire and forget
      notifyAdmins({
        title: '🔑 Login code requested',
        body: `${publicEmail} is waiting for their OTP.`,
        url: '/admin/login-requests',
        tag: 'login-request',
      }).catch(() => null);
    }).catch((err) => log.warn('auth.login_request_create_failed', { err: String(err) }));

    return ok({ ok: true });
  } catch (err) {
    if (err instanceof UpstreamError) {
      if (err.code === 'TIMEOUT')      return fail(504, 'Upstream timed out');
      if (err.code === 'NETWORK')      return fail(502, 'Cannot reach upstream');
      if (err.code === 'RATE_LIMITED') return fail(503, 'Upstream rate-limited');
    }
    log.error('auth.send_code_error', { err: String(err) });
    return fail(500, 'Could not send code right now');
  }
}
