// GET /api/cron/notify-unread-chat
//
// Sends an email to the creator for every admin chat message that is still
// unread after its grace window. Idempotent — we stamp notifyEmailSentAt so the
// same message is never emailed twice. Invoked by Vercel Cron (see vercel.json).

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fail, ok } from '@/lib/api';
import { sendEmail, unreadChatMessageEmail } from '@/lib/email';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_PER_RUN = 50; // safety cap so a stuck job can't fan-out to thousands

// Authorize Vercel Cron requests (they carry a `vercel-cron` user-agent), or a
// bearer token if a CRON_SECRET env var is ever set (for manual triggering).
function isAuthorized(req: NextRequest): boolean {
  const ua = req.headers.get('user-agent') ?? '';
  if (ua.includes('vercel-cron')) return true;
  const secret = process.env.CRON_SECRET ?? '';
  return secret.length > 0 && req.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return fail(401, 'Unauthorized', 'UNAUTHENTICATED');

  const now = new Date();

  // Find unread admin messages whose notification window has elapsed.
  // For each employee we only need the *oldest* such message (to anchor the
  // email + flip all of theirs to sent in one go).
  const due = await db.chatMessage.findMany({
    where: {
      fromAdmin:         true,
      readAt:            null,
      notifyEmailAt:     { lte: now },
      notifyEmailSentAt: null,
    },
    orderBy: { createdAt: 'asc' },
    take:    MAX_PER_RUN,
    select: {
      id:         true,
      employeeId: true,
      content:    true,
      createdAt:  true,
    },
  });

  if (due.length === 0) return ok({ ok: true, sent: 0, scanned: 0 });

  // Group by employee — one email per creator regardless of how many unread
  // messages they've accumulated. Use the earliest pending message as the preview.
  const byEmployee = new Map<string, typeof due[number]>();
  const allIds: string[] = [];
  for (const m of due) {
    allIds.push(m.id);
    if (!byEmployee.has(m.employeeId)) byEmployee.set(m.employeeId, m);
  }

  const employees = await db.employee.findMany({
    where: { id: { in: [...byEmployee.keys()] } },
    select: { id: true, email: true, firstName: true, lastName: true },
  });

  // Fetch signup-form names so the email greeting uses the real name when present
  const signupRows = await db.creatorSignupRequest.findMany({
    where: { publicEmail: { in: employees.map((e) => e.email) } },
    select: { publicEmail: true, fullName: true },
  });
  const signupMap = new Map(signupRows.map((s) => [s.publicEmail, s.fullName]));

  const appUrl  = process.env.NEXT_PUBLIC_APP_URL || 'https://orcazo.com';
  const chatUrl = `${appUrl}/support`;

  let sentCount = 0;
  for (const employee of employees) {
    const msg = byEmployee.get(employee.id);
    if (!msg) continue;

    const afName = employee.firstName
      ? `${employee.firstName}${employee.lastName ? ' ' + employee.lastName : ''}`
      : null;
    const displayName = signupMap.get(employee.email) ?? afName ?? null;

    const tpl = unreadChatMessageEmail({
      displayName,
      preview: msg.content,
      chatUrl,
    });

    const result = await sendEmail({ to: employee.email, ...tpl });
    if (!result.ok) {
      log.warn('cron.notify_unread_email_failed', {
        employeeId: employee.id,
        msgId:      msg.id,
        error:      result.error,
      });
      continue;
    }
    sentCount++;
  }

  // Mark ALL fetched messages as notified — once notified we don't email again
  // even if the creator still hasn't opened the chat.
  await db.chatMessage.updateMany({
    where: { id: { in: allIds } },
    data:  { notifyEmailSentAt: now },
  });

  log.info('cron.notify_unread_chat', { scanned: due.length, sent: sentCount });
  return ok({ ok: true, scanned: due.length, sent: sentCount });
}

// Vercel cron currently hits routes via GET, but allow POST too in case an
// external scheduler prefers it.
export async function POST(req: NextRequest): Promise<NextResponse> {
  return GET(req);
}
