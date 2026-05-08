// POST /api/admin/login-requests/[id]/relay  { code }
//   Admin pastes the OTP from the proxy email inbox.
//   We send it to the creator's public email via Resend under Orcazo branding.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { fail, ok } from '@/lib/api';
import { getAdminSession } from '@/lib/session';
import { sendEmail, loginCodeEmail } from '@/lib/email';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const relayBody = z.object({
  code: z.string().trim().regex(/^\d{4,8}$/, 'Code must be 4–8 digits'),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getAdminSession();
  if (!session) return fail(401, 'Not authenticated', 'UNAUTHENTICATED');

  const { id } = await params;
  const json = await req.json().catch(() => null);
  const parsed = relayBody.safeParse(json);
  if (!parsed.success) return fail(400, 'Invalid code — must be 4–8 digits');

  const loginReq = await db.loginRequest.findUnique({ where: { id } });
  if (!loginReq) return fail(404, 'Login request not found');
  if (loginReq.status !== 'PENDING') return fail(400, 'This request has already been relayed or expired');

  const tpl = loginCodeEmail({ code: parsed.data.code });
  const result = await sendEmail({ to: loginReq.publicEmail, subject: tpl.subject, html: tpl.html });

  if (!result.ok) {
    log.error('login_request.relay_email_failed', { id, error: result.error });
    return fail(500, result.error || 'Failed to send email');
  }

  await db.loginRequest.update({
    where: { id },
    data: { status: 'RELAYED', relayedAt: new Date() },
  });

  log.info('login_request.relayed', { id, publicEmail: loginReq.publicEmail, adminId: session.adminId });

  return ok({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getAdminSession();
  if (!session) return fail(401, 'Not authenticated', 'UNAUTHENTICATED');

  const { id } = await params;
  await db.loginRequest.delete({ where: { id } }).catch(() => null);
  return ok({ ok: true });
}
