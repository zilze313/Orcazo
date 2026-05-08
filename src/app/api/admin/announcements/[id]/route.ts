// PATCH  /api/admin/announcements/[id]  → update
// DELETE /api/admin/announcements/[id]  → delete

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getAdminSession } from '@/lib/session';
import { fail, ok, parseBody } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  title:       z.string().trim().min(1).max(200).optional(),
  contentHtml: z.string().min(1).max(100_000).optional(),
  published:   z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getAdminSession();
  if (!session) return fail(401, 'Not authenticated', 'UNAUTHENTICATED');

  const { id } = await params;
  const parsed = await parseBody(req, patchSchema);
  if ('errorResponse' in parsed) return parsed.errorResponse;

  const item = await db.announcement.update({
    where: { id },
    data:  parsed.data,
  }).catch(() => null);

  if (!item) return fail(404, 'Announcement not found');
  return ok({ announcement: item });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getAdminSession();
  if (!session) return fail(401, 'Not authenticated', 'UNAUTHENTICATED');

  const { id } = await params;
  await db.announcement.delete({ where: { id } }).catch(() => null);
  return ok({ ok: true });
}
