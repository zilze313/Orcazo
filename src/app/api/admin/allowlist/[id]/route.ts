// PATCH  /api/admin/allowlist/[id]   { proxyEmail | null }   — connect/disconnect proxy
// DELETE /api/admin/allowlist/[id]                            — remove from allowlist

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { ok, fail } from '@/lib/api';
import { getAdminSession } from '@/lib/session';
import { emailSchema } from '@/lib/validators';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const patchBody = z.object({
  proxyEmail: z.union([emailSchema, z.null()]),
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

  const proxyEmail = parsed.data.proxyEmail;

  if (proxyEmail) {
    // Validate it's in ManagedEmail and not already used elsewhere
    const managed = await db.managedEmail.findUnique({ where: { email: proxyEmail } });
    if (!managed) return fail(400, 'That email is not in your managed pool', 'NOT_MANAGED');
    const inUse = await db.allowlist.findFirst({ where: { proxyEmail, NOT: { id } } });
    if (inUse) return fail(400, `Already connected to ${inUse.email}`, 'PROXY_IN_USE');
  }

  // Auto-derive inboundAddress from the local part of the proxy email.
  // e.g. forcantina02@gmail.com → forcantina02@orcazo.com
  const inboundAddress = proxyEmail
    ? `${proxyEmail.split('@')[0]}@orcazo.com`
    : null;

  const updated = await db.allowlist.update({
    where: { id },
    data: {
      proxyEmail: proxyEmail ?? null,
      proxyConnectedAt: proxyEmail ? new Date() : null,
      inboundAddress,
    },
  }).catch(() => null);

  if (!updated) return fail(404, 'Not found');

  db.adminAuditLog.create({
    data: {
      adminId: session.adminId,
      action: proxyEmail ? 'allowlist.connect_proxy' : 'allowlist.disconnect_proxy',
      details: { id, email: updated.email, proxyEmail },
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
  if (!id) return fail(400, 'Missing id');

  const entry = await db.allowlist.findUnique({ where: { id } });
  if (!entry) return fail(404, 'Not found');

  await db.allowlist.delete({ where: { id } });

  // Also remove the employee record so they can't log in and no longer appear
  // in the employees table. Fire-and-forget — non-fatal if they never logged in.
  db.employee.deleteMany({ where: { email: entry.email } })
    .catch((err) => log.warn('admin.employee_delete_failed', { err: String(err) }));

  db.adminAuditLog.create({
    data: {
      adminId: session.adminId,
      action: 'allowlist.remove',
      details: { email: entry.email, entryId: id },
    },
  }).catch((err) => log.warn('admin.audit_failed', { err: String(err) }));

  return ok({ ok: true });
}
