// POST /api/admin/creator-signups/[id]/approve   { proxyEmail }
// POST /api/admin/creator-signups/[id]/reject    { reason? }
// DELETE /api/admin/creator-signups/[id]
//
// We expose all three actions via a single route file using a `?action=` query
// param so we don't need 3 nested folders.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { fail, ok } from '@/lib/api';
import { getAdminSession } from '@/lib/session';
import { sendEmail, creatorRejectionEmail, creatorApprovalEmail } from '@/lib/email';
import { log } from '@/lib/logger';
import { emailSchema } from '@/lib/validators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const approveBody = z.object({ proxyEmail: emailSchema });
const rejectBody  = z.object({ reason: z.string().trim().max(500).optional() });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getAdminSession();
  if (!session) return fail(401, 'Not authenticated', 'UNAUTHENTICATED');

  const { id } = await params;
  const url = new URL(req.url);
  const action = url.searchParams.get('action');

  const signup = await db.creatorSignupRequest.findUnique({ where: { id } });
  if (!signup) return fail(404, 'Not found');
  if (signup.status !== 'PENDING') return fail(400, `Already ${signup.status.toLowerCase()}`);

  const json = await req.json().catch(() => null);

  if (action === 'approve') {
    const parsed = approveBody.safeParse(json);
    if (!parsed.success) return fail(400, 'Invalid body — proxyEmail required');
    const proxyEmail = parsed.data.proxyEmail;

    // Validate the proxy email exists in ManagedEmail and isn't already connected to someone else
    const managed = await db.managedEmail.findUnique({ where: { email: proxyEmail } });
    if (!managed) {
      return fail(400, 'That proxy email is not in your managed pool. Add it on Managed Emails first.', 'NOT_MANAGED');
    }
    const inUse = await db.allowlist.findFirst({ where: { proxyEmail } });
    if (inUse) {
      return fail(400, `That proxy email is already connected to ${inUse.email}.`, 'PROXY_IN_USE');
    }

    // Check that the publicEmail isn't already in the allowlist (idempotency)
    const existingAllow = await db.allowlist.findUnique({ where: { email: signup.publicEmail } });

    // Approve atomically
    await db.$transaction(async (tx) => {
      if (existingAllow) {
        await tx.allowlist.update({
          where: { id: existingAllow.id },
          data: {
            proxyEmail,
            proxyConnectedAt: new Date(),
            createdBy: session.adminId,
          },
        });
      } else {
        await tx.allowlist.create({
          data: {
            email: signup.publicEmail,
            proxyEmail,
            proxyConnectedAt: new Date(),
            note: `Approved from signup ${signup.id}`,
            createdBy: session.adminId,
          },
        });
      }
      await tx.creatorSignupRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          connectedProxyEmail: proxyEmail,
          reviewedAt: new Date(),
          reviewedBy: session.adminId,
        },
      });
    });

    db.adminAuditLog.create({
      data: {
        adminId: session.adminId,
        action: 'creator_signup.approve',
        details: { signupId: id, publicEmail: signup.publicEmail, proxyEmail },
      },
    }).catch((err) => log.warn('admin.audit_failed', { err: String(err) }));

    // Send welcome email — non-blocking
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://orcazo.com';
    const tpl = creatorApprovalEmail({ fullName: signup.fullName, loginUrl: `${appUrl}/login` });
    sendEmail({ to: signup.publicEmail, subject: tpl.subject, html: tpl.html })
      .catch((err) => log.warn('creator_signup.approve_email_failed', { err: String(err) }));

    return ok({ ok: true });
  }

  if (action === 'reject') {
    const parsed = rejectBody.safeParse(json);
    if (!parsed.success) return fail(400, 'Invalid body');
    const reason = parsed.data.reason ?? undefined;

    await db.creatorSignupRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectionReason: reason ?? null,
        reviewedAt: new Date(),
        reviewedBy: session.adminId,
      },
    });

    // Send rejection email — non-blocking, errors logged but not surfaced
    const tpl = creatorRejectionEmail({ fullName: signup.fullName, reason });
    sendEmail({ to: signup.publicEmail, subject: tpl.subject, html: tpl.html })
      .catch((err) => log.warn('creator_signup.reject_email_failed', { err: String(err) }));

    db.adminAuditLog.create({
      data: {
        adminId: session.adminId,
        action: 'creator_signup.reject',
        details: { signupId: id, publicEmail: signup.publicEmail, reason },
      },
    }).catch((err) => log.warn('admin.audit_failed', { err: String(err) }));

    return ok({ ok: true });
  }

  return fail(400, 'Unknown action');
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getAdminSession();
  if (!session) return fail(401, 'Not authenticated', 'UNAUTHENTICATED');

  const { id } = await params;
  const deleted = await db.creatorSignupRequest.delete({ where: { id } }).catch(() => null);
  if (!deleted) return fail(404, 'Not found');

  db.adminAuditLog.create({
    data: {
      adminId: session.adminId,
      action: 'creator_signup.delete',
      details: { id, publicEmail: deleted.publicEmail },
    },
  }).catch((err) => log.warn('admin.audit_failed', { err: String(err) }));

  return ok({ ok: true });
}
