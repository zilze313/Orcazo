// POST   /api/admin/inbound-mail/[id]  { action: 'dismiss' | 'restore' }
// DELETE /api/admin/inbound-mail/[id]                   — hard delete

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fail, ok } from '@/lib/api';
import { getAdminSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
  if (!hasPermission(session, 'login-requests')) return fail(403, 'Forbidden', 'FORBIDDEN');

  const { id } = await params;
  const body = await req.json().catch(() => null) as { action?: string } | null;
  const action = body?.action;
  if (action !== 'dismiss' && action !== 'restore') {
    return fail(400, 'action must be "dismiss" or "restore"');
  }

  const updated = await db.inboundMailEvent
    .update({
      where: { id },
      data: { dismissedAt: action === 'dismiss' ? new Date() : null },
    })
    .catch(() => null);

  if (!updated) return fail(404, 'Event not found');
  return ok({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getAdminSession();
  if (!session) return fail(401, 'Not authenticated', 'UNAUTHENTICATED');
  if (!hasPermission(session, 'login-requests')) return fail(403, 'Forbidden', 'FORBIDDEN');

  const { id } = await params;
  await db.inboundMailEvent.delete({ where: { id } }).catch(() => null);
  return ok({ ok: true });
}
