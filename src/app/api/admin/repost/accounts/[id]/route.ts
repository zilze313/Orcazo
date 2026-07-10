// PATCH  /api/admin/repost/accounts/[id] → update / toggle active
// DELETE /api/admin/repost/accounts/[id]

import { z } from 'zod';
import { withAdmin, ok, fail, parseBody } from '@/lib/api';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PLATFORMS = ['instagram', 'tiktok', 'youtube', 'snapchat', 'x', 'facebook'] as const;

const updateSchema = z.object({
  platform: z.enum(PLATFORMS).optional(),
  handle: z.string().trim().min(1).max(120).transform((v) => v.startsWith('@') ? v.slice(1) : v).optional(),
  displayName: z.string().trim().max(160).nullish(),
  profileUrl: z.string().url().max(2048).nullish(),
  avatarUrl: z.string().url().max(2048).nullish(),
  active: z.boolean().optional(),
});

function parseRouteId(req: Request): string | null {
  const segments = new URL(req.url).pathname.split('/').filter(Boolean);
  const last = segments[segments.length - 1];
  return last && last !== 'accounts' ? last : null;
}

export const PATCH = withAdmin(async ({ req }) => {
  const id = parseRouteId(req);
  if (!id) return fail(400, 'Missing id');

  const parsed = await parseBody(req, updateSchema);
  if ('errorResponse' in parsed) return parsed.errorResponse;
  const v = parsed.data;

  await db.repostSourceAccount.update({
    where: { id },
    data: {
      ...(v.platform    !== undefined && { platform: v.platform }),
      ...(v.handle      !== undefined && { handle: v.handle }),
      ...(v.displayName !== undefined && { displayName: v.displayName }),
      ...(v.profileUrl  !== undefined && { profileUrl: v.profileUrl }),
      ...(v.avatarUrl   !== undefined && { avatarUrl: v.avatarUrl }),
      ...(v.active      !== undefined && { active: v.active }),
    },
  }).catch(() => null);

  return ok({ ok: true });
}, { permission: 'reposting' });

export const DELETE = withAdmin(async ({ req }) => {
  const id = parseRouteId(req);
  if (!id) return fail(400, 'Missing id');
  await db.repostSourceAccount.delete({ where: { id } }).catch(() => null);
  return ok({ ok: true });
}, { permission: 'reposting' });
