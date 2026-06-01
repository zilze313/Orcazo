// POST /api/public/contact — public, rate-limited, captcha-gated.
// Accessible to anyone (no auth required). If the visitor happens to be a
// logged-in creator, we link the message to their employeeId for context.

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { applyLimit, fail, getClientIp, ok, parseBody } from '@/lib/api';
import { contactMessageBody } from '@/lib/validators';
import { limits } from '@/lib/ratelimit';
import { verifyTurnstile } from '@/lib/turnstile';
import { getEmployeeSession } from '@/lib/session';
import { notifyAdmins } from '@/lib/push';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  const ipLimit = applyLimit(`ip:${ip}:contact`, limits.publicSignup);
  if (ipLimit) return ipLimit;

  const parsed = await parseBody(req, contactMessageBody);
  if ('errorResponse' in parsed) return parsed.errorResponse;

  const tsResult = await verifyTurnstile(parsed.data.turnstileToken, ip);
  if (!tsResult.ok) return fail(400, tsResult.error || 'Captcha failed', 'CAPTCHA_FAILED');

  // Link to an employee account if the sender happens to be signed in.
  const session = await getEmployeeSession().catch(() => null);

  const { name, email, subject, message } = parsed.data;

  const created = await db.contactMessage.create({
    data: {
      name,
      email,
      subject,
      message,
      employeeId: session?.employeeId ?? null,
      ipAddress:  ip.slice(0, 64),
      userAgent:  req.headers.get('user-agent')?.slice(0, 500) ?? null,
    },
    select: { id: true },
  });

  log.info('contact.received', { id: created.id, email, employeeId: session?.employeeId ?? null });

  // Notify admins (fire-and-forget — never block the response)
  notifyAdmins({
    title: '✉️ New contact message',
    body:  `${name}: ${subject}`,
    url:   '/admin/contact-messages',
    tag:   'contact-message',
  }).catch(() => null);

  return ok({ ok: true, id: created.id });
}
