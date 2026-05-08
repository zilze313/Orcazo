// PATCH /api/admin/brand-signups/[id]   { contacted: boolean }
// DELETE /api/admin/brand-signups/[id]

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { fail, ok } from '@/lib/api';
import { getAdminSession } from '@/lib/session';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const patchBody = z.object({ contacted: z.boolean() });

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

  const updated = await db.brandSignupRequest.update({
    where: { id },
    data: parsed.data.contacted
      ? { contactedAt: new Date(), contactedBy: session.adminId }
      : { contactedAt: null, contactedBy: null },
  }).catch(() => null);

  if (!updated) return fail(404, 'Not found');

  db.adminAuditLog.create({
    data: {
      adminId: session.adminId,
      action: parsed.data.contacted ? 'brand_signup.mark_contacted' : 'brand_signup.unmark_contacted',
      details: { id, email: updated.email },
    },
  }).catch((err) => log.warn('admin.audit_failed', { err: String(err) }));

  return ok({ entry: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getAdminSession();
  if (!session) return fail(401, 'Not authenticated', 'UNAUTHENTICATED');

  const { id } = await params;
  const deleted = await db.brandSignupRequest.delete({ where: { id } }).catch(() => null);
  if (!deleted) return fail(404, 'Not found');

  db.adminAuditLog.create({
    data: {
      adminId: session.adminId,
      action: 'brand_signup.delete',
      details: { id, email: deleted.email },
    },
  }).catch((err) => log.warn('admin.audit_failed', { err: String(err) }));

  return ok({ ok: true });
}
