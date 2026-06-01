// POST   /api/admin/contact-messages/[id]  { action: 'resolve' | 'dismiss' | 'reopen', adminNote? }
// DELETE /api/admin/contact-messages/[id]                   — hard delete

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { fail, ok } from '@/lib/api';
import { getAdminSession } from '@/lib/session';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('resolve'),  adminNote: z.string().trim().max(500).optional() }),
  z.object({ action: z.literal('dismiss'),  adminNote: z.string().trim().max(500).optional() }),
  z.object({ action: z.literal('reopen') }),
]);

function hasPermission(
  session: NonNullable<Awaited<ReturnType<typeof getAdminSession>>>,
  perm: string,
): boolean {
  return session.role === 'SUPER_ADMIN' || session.permissions.includes(perm);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getAdminSession();
  if (!session) return fail(401, 'Not authenticated', 'UNAUTHENTICATED');
  if (!hasPermission(session, 'messages')) return fail(403, 'Forbidden', 'FORBIDDEN');

  const { id } = await params;
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return fail(400, 'Invalid body: ' + parsed.error.issues[0]?.message);

  const now = new Date();
  let data: Parameters<typeof db.contactMessage.update>[0]['data'];

  if (parsed.data.action === 'resolve') {
    data = { status: 'RESOLVED', resolvedAt: now, dismissedAt: null, adminNote: parsed.data.adminNote ?? null };
  } else if (parsed.data.action === 'dismiss') {
    data = { status: 'DISMISSED', dismissedAt: now, resolvedAt: null, adminNote: parsed.data.adminNote ?? null };
  } else {
    data = { status: 'NEW', resolvedAt: null, dismissedAt: null };
  }

  const updated = await db.contactMessage.update({ where: { id }, data }).catch(() => null);
  if (!updated) return fail(404, 'Not found');

  db.adminAuditLog.create({
    data: { adminId: session.adminId, action: `contact.${parsed.data.action}`, details: { id } },
  }).catch((err) => log.warn('admin.audit_failed', { err: String(err) }));

  return ok({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getAdminSession();
  if (!session) return fail(401, 'Not authenticated', 'UNAUTHENTICATED');
  if (!hasPermission(session, 'messages')) return fail(403, 'Forbidden', 'FORBIDDEN');

  const { id } = await params;
  await db.contactMessage.delete({ where: { id } }).catch(() => null);

  db.adminAuditLog.create({
    data: { adminId: session.adminId, action: 'contact.delete', details: { id } },
  }).catch((err) => log.warn('admin.audit_failed', { err: String(err) }));

  return ok({ ok: true });
}
