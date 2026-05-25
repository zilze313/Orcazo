// POST /api/admin/broadcast-email
// Sends a custom email to all active employees (creators who have logged in).
// Uses Resend with the platform's from-address. Logs the broadcast in BroadcastEmail.

import { withAdmin, ok, fail } from '@/lib/api';
import { db } from '@/lib/db';
import { Resend } from 'resend';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM   = process.env.RESEND_FROM || 'Orcazo <noreply@orcazo.com>';

export const POST = withAdmin(async ({ req }) => {
  let body: { subject?: string; bodyHtml?: string } | null = null;
  try { body = await req.json(); } catch { return fail(400, 'Invalid JSON'); }

  const subject  = body?.subject?.trim();
  const bodyHtml = body?.bodyHtml?.trim();
  if (!subject)  return fail(400, 'subject is required');
  if (!bodyHtml) return fail(400, 'bodyHtml is required');

  // Fetch all employees with a valid email
  const employees = await db.employee.findMany({
    select: { email: true, firstName: true, lastName: true },
    orderBy: { createdAt: 'asc' },
  });

  if (employees.length === 0) return ok({ sent: 0, failed: 0 });

  // Send in batches of 50 to respect Resend rate limits
  const BATCH = 50;
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < employees.length; i += BATCH) {
    const batch = employees.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map((emp) =>
        resend.emails.send({
          from:    FROM,
          to:      emp.email,
          subject,
          html:    bodyHtml,
        })
      )
    );
    sent   += results.filter((r) => r.status === 'fulfilled').length;
    failed += results.filter((r) => r.status === 'rejected').length;
  }

  // Log the broadcast
  await db.broadcastEmail.create({
    data: { subject, bodyHtml, recipientCount: sent },
  }).catch((err) => log.warn('broadcast.log_failed', { err: String(err) }));

  log.info('broadcast.sent', { subject, total: employees.length, sent, failed });
  return ok({ sent, failed, total: employees.length });
}, { permission: 'content' });

export const GET = withAdmin(async () => {
  const history = await db.broadcastEmail.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { id: true, subject: true, recipientCount: true, createdAt: true },
  });
  return ok({ history });
}, { permission: 'content' });
