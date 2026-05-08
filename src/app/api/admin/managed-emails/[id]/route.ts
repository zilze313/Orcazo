// DELETE /api/admin/managed-emails/[id]
//
// Refuses to delete if the email is currently connected to a creator —
// admin must disconnect the creator first.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fail, ok } from '@/lib/api';
import { getAdminSession } from '@/lib/session';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getAdminSession();
  if (!session) return fail(401, 'Not authenticated', 'UNAUTHENTICATED');

  const { id } = await params;
  const entry = await db.managedEmail.findUnique({ where: { id } });
  if (!entry) return fail(404, 'Not found');

  const connection = await db.allowlist.findFirst({ where: { proxyEmail: entry.email } });
  if (connection) {
    return fail(400, `This email is connected to ${connection.email}. Disconnect them first via Allowlist.`, 'IN_USE');
  }

  await db.managedEmail.delete({ where: { id } });

  db.adminAuditLog.create({
    data: {
      adminId: session.adminId,
      action: 'managed_email.delete',
      details: { id, email: entry.email },
    },
  }).catch((err) => log.warn('admin.audit_failed', { err: String(err) }));

  return ok({ ok: true });
}
