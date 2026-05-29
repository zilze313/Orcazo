// POST /api/admin/send-email
// Send a single direct email to one creator. Admin supplies recipient email,
// heading, and message — we wrap the message in the Orcazo-branded template
// (see directMessageEmail in lib/email.ts) and deliver via Resend.

import { withAdmin, ok, fail } from '@/lib/api';
import { db } from '@/lib/db';
import { sendEmail, directMessageEmail } from '@/lib/email';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withAdmin(async ({ req }) => {
  let body: { email?: string; heading?: string; message?: string } | null = null;
  try { body = await req.json(); } catch { return fail(400, 'Invalid JSON'); }

  const email   = body?.email?.trim().toLowerCase();
  const heading = body?.heading?.trim();
  const message = body?.message?.trim();
  if (!email)   return fail(400, 'email is required');
  if (!heading) return fail(400, 'heading is required');
  if (!message) return fail(400, 'message is required');
  if (heading.length > 200) return fail(400, 'heading is too long (max 200 chars)');
  if (message.length > 10_000) return fail(400, 'message is too long (max 10,000 chars)');

  const employee = await db.employee.findUnique({
    where: { email },
    select: { firstName: true, lastName: true },
  });
  if (!employee) return fail(404, 'No creator found with that email');

  const recipientName =
    [employee.firstName, employee.lastName].filter(Boolean).join(' ').trim() || null;

  const { subject, html } = directMessageEmail({ heading, message, recipientName });
  const result = await sendEmail({ to: email, subject, html });

  if (!result.ok) {
    log.warn('admin.send_email_failed', { email, error: result.error });
    return fail(502, result.error || 'Could not send email');
  }

  log.info('admin.send_email_sent', { email, heading, delivered: result.delivered });
  return ok({ ok: true, delivered: result.delivered });
}, { permission: 'content' });
