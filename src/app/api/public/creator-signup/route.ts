// POST /api/public/creator-signup — public, rate-limited, captcha-gated.
// Idempotent on publicEmail: re-submissions update the existing pending row
// rather than creating duplicates.

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { applyLimit, fail, getClientIp, ok, parseBody } from '@/lib/api';
import { creatorSignupBody } from '@/lib/validators';
import { limits } from '@/lib/ratelimit';
import { verifyTurnstile } from '@/lib/turnstile';
import { notifyAdmins } from '@/lib/push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  const ipLimit = applyLimit(`ip:${ip}:creator-signup`, limits.publicSignup);
  if (ipLimit) return ipLimit;

  const parsed = await parseBody(req, creatorSignupBody);
  if ('errorResponse' in parsed) return parsed.errorResponse;

  const tsResult = await verifyTurnstile(parsed.data.turnstileToken, ip);
  if (!tsResult.ok) return fail(400, tsResult.error || 'Captcha failed', 'CAPTCHA_FAILED');

  const { publicEmail, fullName, whatsapp, socialAccounts, referralCode } = parsed.data;

  // Validate referral code if provided
  if (referralCode) {
    const codeRow = await db.referralCode.findUnique({ where: { code: referralCode } });
    if (!codeRow) return fail(400, 'Invalid referral code.', 'INVALID_REFERRAL_CODE');
  }

  // If a previous submission exists, behavior depends on its status:
  //   - PENDING: silently update (user is editing their submission)
  //   - APPROVED: silently succeed; their account is already active
  //   - REJECTED: 403 — they need to email support
  const existing = await db.creatorSignupRequest.findUnique({ where: { publicEmail } });
  if (existing) {
    if (existing.status === 'REJECTED') {
      return fail(403, 'A previous application from this email was rejected. Please contact support.', 'REJECTED_PREVIOUS');
    }
    if (existing.status === 'APPROVED') {
      return ok({ ok: true });
    }
    // PENDING — update in place (no new notification for re-submissions)
    await db.creatorSignupRequest.update({
      where: { id: existing.id },
      data: {
        fullName,
        whatsapp,
        socialAccounts: socialAccounts as object,
        referralCode: referralCode || null,
        ipAddress: ip.slice(0, 64),
      },
    });
    return ok({ ok: true });
  }

  await db.creatorSignupRequest.create({
    data: {
      publicEmail,
      fullName,
      whatsapp,
      socialAccounts: socialAccounts as object,
      referralCode: referralCode || null,
      ipAddress: ip.slice(0, 64),
    },
  });

  // Push notification — fire and forget, never block the response
  notifyAdmins({
    title: '👤 New creator signup',
    body: `${fullName} (${publicEmail}) wants to join.`,
    url: '/admin/creator-signups',
    tag: 'creator-signup',
  }).catch(() => null);

  return ok({ ok: true });
}
