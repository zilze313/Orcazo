// PATCH  /api/admin/showcase-payouts/[id] — partial update
// DELETE /api/admin/showcase-payouts/[id]

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { fail, ok, parseBody } from '@/lib/api';
import { getAdminSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  handle:      z.string().trim().max(80).optional().nullable(),
  platform:    z.string().trim().max(40).optional().nullable(),
  amount:      z.coerce.number().min(0).max(9_999_999).optional(),
  note:        z.string().trim().max(160).optional().nullable(),
  paidLabel:   z.string().trim().max(40).optional().nullable(),
  active:      z.boolean().optional(),
  ordering:    z.coerce.number().int().min(0).max(9999).optional(),
});

function authorized(session: Awaited<ReturnType<typeof getAdminSession>>): boolean {
  if (!session) return false;
  return session.role === 'SUPER_ADMIN' || session.permissions.includes('content');
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getAdminSession();
  if (!session) return fail(401, 'Not authenticated', 'UNAUTHENTICATED');
  if (!authorized(session)) return fail(403, 'You do not have permission to perform this action', 'FORBIDDEN');

  const { id } = await params;
  const parsed = await parseBody(req, patchSchema);
  if ('errorResponse' in parsed) return parsed.errorResponse;

  const { amount, ...rest } = parsed.data;
  const card = await db.showcasePayout.update({
    where: { id },
    data: {
      ...rest,
      ...(amount != null ? { amount: new Prisma.Decimal(amount.toFixed(2)) } : {}),
    },
  }).catch(() => null);
  if (!card) return fail(404, 'Not found');

  return ok({ card });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getAdminSession();
  if (!session) return fail(401, 'Not authenticated', 'UNAUTHENTICATED');
  if (!authorized(session)) return fail(403, 'You do not have permission to perform this action', 'FORBIDDEN');

  const { id } = await params;
  const deleted = await db.showcasePayout.delete({ where: { id } }).catch(() => null);
  if (!deleted) return fail(404, 'Not found');

  return ok({ ok: true });
}
