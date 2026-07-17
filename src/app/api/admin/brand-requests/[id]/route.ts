// PATCH  /api/admin/brand-requests/[id] — update status / admin note
// DELETE /api/admin/brand-requests/[id]

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { fail, ok, parseBody } from '@/lib/api';
import { getAdminSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  status:    z.enum(['NEW', 'CONTACTED', 'CLOSED']).optional(),
  adminNote: z.string().trim().max(2000).optional().nullable(),
});

function authorized(session: Awaited<ReturnType<typeof getAdminSession>>): boolean {
  if (!session) return false;
  return session.role === 'SUPER_ADMIN' || session.permissions.includes('campaigns');
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

  const now = new Date();
  const { status, adminNote } = parsed.data;

  const request = await db.brandCampaignRequest.update({
    where: { id },
    data: {
      ...(status ? { status } : {}),
      ...(adminNote !== undefined ? { adminNote } : {}),
      ...(status === 'CONTACTED' ? { contactedAt: now } : {}),
      ...(status === 'CLOSED' ? { closedAt: now } : {}),
    },
  }).catch(() => null);
  if (!request) return fail(404, 'Not found');

  return ok({ request });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getAdminSession();
  if (!session) return fail(401, 'Not authenticated', 'UNAUTHENTICATED');
  if (!authorized(session)) return fail(403, 'You do not have permission to perform this action', 'FORBIDDEN');

  const { id } = await params;
  const deleted = await db.brandCampaignRequest.delete({ where: { id } }).catch(() => null);
  if (!deleted) return fail(404, 'Not found');

  return ok({ ok: true });
}
