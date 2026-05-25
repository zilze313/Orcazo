// PATCH  /api/admin/homepage-videos/[id]  → update title, order, active status
// DELETE /api/admin/homepage-videos/[id]  → delete video

import { NextRequest } from 'next/server';
import { fail, ok } from '@/lib/api';
import { db } from '@/lib/db';
import { getAdminSession } from '@/lib/session';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const patchBody = z.object({
  title: z.string().max(200).optional().nullable(),
  order: z.number().int().optional(),
  active: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession();
  if (!session) return fail(401, 'Not authenticated', 'UNAUTHENTICATED');
  if (session.role !== 'SUPER_ADMIN' && !session.permissions.includes('content')) {
    return fail(403, 'Permission denied', 'FORBIDDEN');
  }

  const { id } = await params;
  let body: unknown;
  try { body = await req.json(); } catch { return fail(400, 'Invalid JSON'); }

  const parsed = patchBody.safeParse(body);
  if (!parsed.success) return fail(400, 'Invalid body');

  const video = await db.homepageVideo.update({
    where: { id },
    data: parsed.data,
  }).catch(() => null);

  if (!video) return fail(404, 'Video not found');
  return ok({ video });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession();
  if (!session) return fail(401, 'Not authenticated', 'UNAUTHENTICATED');
  if (session.role !== 'SUPER_ADMIN' && !session.permissions.includes('content')) {
    return fail(403, 'Permission denied', 'FORBIDDEN');
  }

  const { id } = await params;
  await db.homepageVideo.delete({ where: { id } }).catch(() => null);
  return ok({ ok: true });
}
