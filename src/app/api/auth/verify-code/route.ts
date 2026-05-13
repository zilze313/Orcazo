// POST /api/auth/verify-code
//
// User types public email + OTP. We look up the proxy email from Allowlist
// and verify upstream against the proxy email. The Employee row stores the
// public email (so the user always sees their own email in the UI), with the
// AN token + cookies attached.

import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { applyLimit, fail, getClientIp, ok, parseBody } from '@/lib/api';
import { limits } from '@/lib/ratelimit';
import { verifyCodeBody } from '@/lib/validators';
import { verifyLoginCode, fetchUser } from '@/lib/affiliatenetwork/client';
import { UpstreamError } from '@/lib/affiliatenetwork/types';
import { createEmployeeSession, pruneExpiredSessions } from '@/lib/session';
import { ensureAdminBootstrap } from '@/lib/admin-bootstrap';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const userAgent = req.headers.get('user-agent') ?? undefined;

  const ipLimit = applyLimit(`ip:${ip}:verify-code`, limits.ipUnauth);
  if (ipLimit) return ipLimit;

  const parsed = await parseBody(req, verifyCodeBody);
  if ('errorResponse' in parsed) return parsed.errorResponse;

  const { email: publicEmail, code } = parsed.data;

  // Re-check allowlist — same path as send-code so OTP can't be replayed for
  // a non-allowlisted email.
  const allowed = await db.allowlist.findUnique({ where: { email: publicEmail } });
  if (!allowed) {
    log.warn('auth.verify_code_rejected_not_allowlisted', { publicEmail, ip });
    return fail(403, 'This email is not authorized', 'NOT_ALLOWLISTED');
  }
  if (!allowed.proxyEmail) {
    return fail(403, 'Your account is not fully set up yet. Please contact support.', 'NO_PROXY');
  }
  const proxyEmail = allowed.proxyEmail;

  let upstreamData;
  let upstreamCookies = '';
  try {
    const result = await verifyLoginCode(proxyEmail, code);
    upstreamData = result.data;
    upstreamCookies = result.cookies;
  } catch (err) {
    if (err instanceof UpstreamError) {
      if (err.code === 'TIMEOUT') return fail(504, 'Upstream timed out');
      if (err.code === 'NETWORK') return fail(502, 'Cannot reach upstream');
    }
    log.error('auth.verify_code_error', { err: String(err) });
    return fail(500, 'Could not verify code right now');
  }

  if (!upstreamData.success || !upstreamData.user?.token) {
    return fail(400, upstreamData.errorMsg || 'Invalid code', 'UPSTREAM_REJECTED');
  }

  const upstreamToken = upstreamData.user.token;

  // Look up creator signup request for preferred name (fullName takes priority
  // over the upstream affiliate-network profile's personal fields).
  const signupReq = await db.creatorSignupRequest.findUnique({
    where: { publicEmail },
    select: { fullName: true },
  }).catch(() => null);

  // Phase 1: persist the Employee row keyed by publicEmail.
  let employee;
  try {
    employee = await db.employee.upsert({
      where: { email: publicEmail },
      create: {
        email: publicEmail,
        affiliateNetworkToken: upstreamToken,
        affiliateNetworkCookies: upstreamCookies || null,
        lastLoginAt: new Date(),
      },
      update: {
        affiliateNetworkToken: upstreamToken,
        affiliateNetworkCookies: upstreamCookies || null,
        lastLoginAt: new Date(),
      },
    });
  } catch (err) {
    log.error('auth.employee_upsert_failed', { publicEmail, err: String(err) });
    return fail(500, 'Could not finalize login. Please request a new code.');
  }

  if (!upstreamCookies) {
    log.warn('auth.no_cookies_captured', { publicEmail });
  }

  // Phase 2: best-effort profile hydration with retry.
  try {
    let p: NonNullable<Awaited<ReturnType<typeof fetchUser>>['user']> | undefined;
    const delays = [0, 500, 1500];

    for (let i = 0; i < delays.length; i++) {
      if (delays[i] > 0) await new Promise((r) => setTimeout(r, delays[i]));
      const u = await fetchUser(upstreamToken, upstreamCookies, { bypass: true }).catch(() => null);
      p = u?.user;
      if (p?.bioVerificationCode) break;
    }

    if (p?.bioVerificationCode) {
      const balance = p.balance;

      // Prefer the name the creator entered in their signup form.
      let firstName: string | undefined;
      let lastName: string | undefined;
      if (signupReq?.fullName) {
        const trimmed = signupReq.fullName.trim();
        const spaceIdx = trimmed.indexOf(' ');
        if (spaceIdx > 0) {
          firstName = trimmed.slice(0, spaceIdx);
          lastName  = trimmed.slice(spaceIdx + 1).trim() || undefined;
        } else {
          firstName = trimmed;
        }
      } else {
        firstName = p.personal?.firstName ?? undefined;
        lastName  = p.personal?.lastName  ?? undefined;
      }

      await db.employee.update({
        where: { id: employee.id },
        data: {
          affiliateNetworkPublicId: p.publicId ?? undefined,
          firstName,
          lastName,
          bioVerificationCode:      p.bioVerificationCode,
          cachedBalance:            balance ? new Prisma.Decimal(balance) : undefined,
          lastSyncedAt:             new Date(),
        },
      });
    } else {
      log.warn('auth.profile_empty_after_login', { publicEmail, attempts: delays.length, hasCookies: !!upstreamCookies });
    }
  } catch (err) {
    log.warn('auth.profile_hydrate_failed_nonfatal', { publicEmail, err: String(err) });
  }

  await createEmployeeSession({ employeeId: employee.id, ipAddress: ip, userAgent });

  pruneExpiredSessions().catch(() => {});
  ensureAdminBootstrap().catch(() => {});

  // Clear any pending OTP from the inbound email relay (fire-and-forget)
  db.allowlist
    .updateMany({ where: { email: publicEmail }, data: { pendingOtp: null, pendingOtpAt: null } })
    .catch(() => {});

  log.info('auth.login_ok', { employeeId: employee.id, publicEmail });
  return ok({ ok: true, signupStatus: upstreamData.user.signupStatus });
}
