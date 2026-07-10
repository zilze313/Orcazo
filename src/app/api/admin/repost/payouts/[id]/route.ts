// PATCH  /api/admin/repost/payouts/[id]
//   action: "approve"  → { amountPaid: number }  sets status=PAID, computes penalty
//   action: "reject"   → { adminNote: string }   sets status=REJECTED
//   action: "cancel"   → {}                       sets status=CANCELLED
// DELETE /api/admin/repost/payouts/[id]  — hard delete (use sparingly)

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { db } from '@/lib/db';
import { fail, ok } from '@/lib/api';
import { getAdminSession } from '@/lib/session';
import { notifyEmployee } from '@/lib/notifications';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const approveBody = z.object({
  action:     z.literal('approve'),
  amountPaid: z.number().nonnegative(),
  adminNote:  z.string().trim().max(500).optional(),
});
const rejectBody = z.object({
  action:    z.literal('reject'),
  adminNote: z.string().trim().min(1).max(500),
});
const cancelBody = z.object({
  action: z.literal('cancel'),
});
const patchBody = z.discriminatedUnion('action', [approveBody, rejectBody, cancelBody]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getAdminSession();
  if (!session) return fail(401, 'Not authenticated', 'UNAUTHENTICATED');
  if (session.role !== 'SUPER_ADMIN' && !session.permissions.includes('reposting')) {
    return fail(403, 'You do not have permission to perform this action', 'FORBIDDEN');
  }

  const { id } = await params;
  const json = await req.json().catch(() => null);
  const parsed = patchBody.safeParse(json);
  if (!parsed.success) return fail(400, 'Invalid body: ' + parsed.error.issues[0]?.message);

  const now = new Date();
  const existing = await db.repostPayoutRequest.findUnique({
    where: { id },
    select: { amountAtRequest: true, status: true, employeeId: true },
  });
  if (!existing) return fail(404, 'Not found');

  let updateData: Parameters<typeof db.repostPayoutRequest.update>[0]['data'];

  if (parsed.data.action === 'approve') {
    const amountPaid = parsed.data.amountPaid;
    const atRequest  = parseFloat(String(existing.amountAtRequest)) || 0;
    const penalty    = Math.max(0, atRequest - amountPaid);
    updateData = {
      status:    'PAID',
      amountPaid: new Prisma.Decimal(amountPaid.toFixed(2)),
      penalty:    new Prisma.Decimal(penalty.toFixed(2)),
      adminNote:  parsed.data.adminNote ?? null,
      paidAt:     now,
    };
  } else if (parsed.data.action === 'reject') {
    updateData = {
      status:     'REJECTED',
      adminNote:  parsed.data.adminNote,
      rejectedAt: now,
    };
  } else {
    updateData = { status: 'CANCELLED', cancelledAt: now };
  }

  const updated = await db.repostPayoutRequest.update({
    where: { id },
    data: updateData,
  }).catch(() => null);
  if (!updated) return fail(404, 'Not found');

  if (parsed.data.action === 'approve') {
    notifyEmployee({
      employeeId: existing.employeeId,
      type: 'payout_approved',
      title: 'Your repost payout was approved',
      body: `$${parsed.data.amountPaid.toFixed(2)} is on its way to you.`,
      url: '/reposting',
    }).catch((err) => log.warn('repost.payout.notify_failed', { id, err: String(err) }));
  } else if (parsed.data.action === 'reject') {
    notifyEmployee({
      employeeId: existing.employeeId,
      type: 'payout_rejected',
      title: 'Your repost payout was rejected',
      body: parsed.data.adminNote,
      url: '/reposting',
    }).catch((err) => log.warn('repost.payout.notify_failed', { id, err: String(err) }));
  }

  db.adminAuditLog.create({
    data: {
      adminId: session.adminId,
      action: `repost_payout.${parsed.data.action}`,
      details: { id, action: parsed.data.action },
    },
  }).catch((err) => log.warn('admin.audit_failed', { err: String(err) }));

  return ok({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getAdminSession();
  if (!session) return fail(401, 'Not authenticated', 'UNAUTHENTICATED');
  if (session.role !== 'SUPER_ADMIN' && !session.permissions.includes('reposting')) {
    return fail(403, 'You do not have permission to perform this action', 'FORBIDDEN');
  }

  const { id } = await params;
  const deleted = await db.repostPayoutRequest.delete({ where: { id } }).catch(() => null);
  if (!deleted) return fail(404, 'Not found');

  db.adminAuditLog.create({
    data: {
      adminId: session.adminId,
      action: 'repost_payout.delete',
      details: { id, employeeId: deleted.employeeId },
    },
  }).catch((err) => log.warn('admin.audit_failed', { err: String(err) }));

  return ok({ ok: true });
}
