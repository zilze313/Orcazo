// PATCH  /api/admin/admins/[id]  → update admin role/permissions (SUPER_ADMIN only)
// DELETE /api/admin/admins/[id]  → delete admin (SUPER_ADMIN only)

import { NextRequest } from 'next/server';
import { fail, ok } from '@/lib/api';
import { db } from '@/lib/db';
import { getAdminSession } from '@/lib/session';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALL_PERMISSIONS = [
  'campaigns',
  'creators',
  'messages',
  'payouts',
  'content',
  'login-requests',
  'managed-emails',
  'referral-codes',
  'health',
] as const;

const patchBody = z.object({
  role: z.enum(['SUPER_ADMIN', 'ADMIN']).optional(),
  permissions: z.array(z.enum(ALL_PERMISSIONS)).optional(),
  password: z.string().min(8).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession();
  if (!session) return fail(401, 'Not authenticated', 'UNAUTHENTICATED');
  if (session.role !== 'SUPER_ADMIN') return fail(403, 'Only SUPER_ADMIN can update admins', 'FORBIDDEN');

  const { id } = await params;
  const target = await db.admin.findUnique({ where: { id } });
  if (!target) return fail(404, 'Admin not found', 'NOT_FOUND');
  if (target.id === session.adminId) return fail(400, 'You cannot modify your own account here', 'SELF_MODIFY');

  let body: unknown;
  try { body = await req.json(); } catch { return fail(400, 'Invalid JSON'); }

  const parsed = patchBody.safeParse(body);
  if (!parsed.success) return fail(400, 'Invalid body');

  const { role, permissions, password } = parsed.data;
  const data: Record<string, unknown> = {};
  if (role !== undefined) data.role = role;
  if (permissions !== undefined) data.permissions = permissions;
  if (password) data.passwordHash = await bcrypt.hash(password, 12);

  const updated = await db.admin.update({
    where: { id },
    data,
    select: { id: true, email: true, role: true, permissions: true, createdAt: true },
  });

  return ok({ admin: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession();
  if (!session) return fail(401, 'Not authenticated', 'UNAUTHENTICATED');
  if (session.role !== 'SUPER_ADMIN') return fail(403, 'Only SUPER_ADMIN can delete admins', 'FORBIDDEN');

  const { id } = await params;
  if (id === session.adminId) return fail(400, 'You cannot delete your own account', 'SELF_DELETE');

  const existing = await db.admin.findUnique({ where: { id } });
  if (!existing) return fail(404, 'Admin not found', 'NOT_FOUND');

  await db.admin.delete({ where: { id } });
  return ok({ ok: true });
}
