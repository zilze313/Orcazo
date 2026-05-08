// PATCH  /api/admin/payouts/[id]   { status, notes? }
//   Status workflow: REQUESTED → IN_PROGRESS → PAID  (or → CANCELLED at any point)
// DELETE /api/admin/payouts/[id]   — hard delete (use sparingly; PATCH to CANCELLED is preferred)

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { fail, ok } from '@/lib/api';
import { getAdminSession } from '@/lib/session';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const patchBody = z.object({
  status: z.enum(['REQUESTED', 'IN_PROGRESS', 'PAID', 'CANCELLED']),
  notes:  z.string().trim().max(500).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getAdminSession();
  if (!session) return fail(401, 'Not authenticated', 'UNAUTHENTICATED');

  const { id } = await params;
  const json = await req.json().catch(() => null);
  const parsed = patchBody.safeParse(json);
  if (!parsed.success) return fail(400, 'Invalid body');

  const now = new Date();
  const stamp =
    parsed.data.status === 'IN_PROGRESS' ? { inProgressAt: now } :
    parsed.data.status === 'PAID'        ? { paidAt: now } :
    parsed.data.status === 'CANCELLED'   ? { cancelledAt: now } :
    {};

  const updated = await db.payoutRequest.update({
    where: { id },
    data: {
      status: parsed.data.status,
      notes:  parsed.data.notes ?? undefined,
      ...stamp,
    },
  }).catch(() => null);

  if (!updated) return fail(404, 'Not found');

  db.adminAuditLog.create({
    data: {
      adminId: session.adminId,
      action: 'payout.status_change',
      details: { id, newStatus: parsed.data.status },
    },
  }).catch((err) => log.warn('admin.audit_failed', { err: String(err) }));

  return ok({ entry: { ...updated, amountAtRequest: updated.amountAtRequest.toString() } });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getAdminSession();
  if (!session) return fail(401, 'Not authenticated', 'UNAUTHENTICATED');

  const { id } = await params;
  const deleted = await db.payoutRequest.delete({ where: { id } }).catch(() => null);
  if (!deleted) return fail(404, 'Not found');

  db.adminAuditLog.create({
    data: {
      adminId: session.adminId,
      action: 'payout.delete',
      details: { id, employeeId: deleted.employeeId },
    },
  }).catch((err) => log.warn('admin.audit_failed', { err: String(err) }));

  return ok({ ok: true });
}
