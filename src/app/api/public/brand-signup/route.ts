// POST /api/public/brand-signup — public, rate-limited, captcha-gated.
// Creates a BrandSignupRequest and (best-effort) sends a confirmation email.

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { applyLimit, fail, getClientIp, ok, parseBody } from '@/lib/api';
import { brandSignupBody } from '@/lib/validators';
import { limits } from '@/lib/ratelimit';
import { verifyTurnstile } from '@/lib/turnstile';
import { sendEmail, brandInquiryConfirmationEmail } from '@/lib/email';
import { log } from '@/lib/logger';
import { notifyAdmins } from '@/lib/push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  const ipLimit = applyLimit(`ip:${ip}:brand-signup`, limits.publicSignup);
  if (ipLimit) return ipLimit;

  const parsed = await parseBody(req, brandSignupBody);
  if ('errorResponse' in parsed) return parsed.errorResponse;

  // Honeypot already validated by zod (must be empty). Then captcha:
  const tsResult = await verifyTurnstile(parsed.data.turnstileToken, ip);
  if (!tsResult.ok) return fail(400, tsResult.error || 'Captcha failed', 'CAPTCHA_FAILED');

  const { email, brandName, monthlyBudget } = parsed.data;

  await db.brandSignupRequest.create({
    data: { email, brandName, monthlyBudget, ipAddress: ip.slice(0, 64) },
  });

  // Confirmation email — fire and forget; never block the response on email.
  const tpl = brandInquiryConfirmationEmail({ brandName });
  sendEmail({ to: email, subject: tpl.subject, html: tpl.html })
    .catch((err) => log.warn('brand_signup.email_failed', { err: String(err) }));

  // Push notification to admins
  notifyAdmins({
    title: '🏢 New brand inquiry',
    body: `${brandName} (${email}) submitted a brand inquiry.`,
    url: '/admin/brand-signups',
    tag: 'brand-signup',
  }).catch(() => null);

  return ok({ ok: true });
}
