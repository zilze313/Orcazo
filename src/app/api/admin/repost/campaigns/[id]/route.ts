// GET    /api/admin/repost/campaigns/[id]
// PATCH  /api/admin/repost/campaigns/[id]
// DELETE /api/admin/repost/campaigns/[id]

import { z } from 'zod';
import { withAdmin, ok, fail, parseBody } from '@/lib/api';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const updateSchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  iconUrl: z.string().url().max(2048).nullish(),
  description: z.string().max(4000).nullish(),
  rulesHtml: z.string().max(20_000).nullish(),
  active: z.boolean().optional(),
  ordering: z.number().int().optional(),
});

function parseRouteId(req: Request): { id: string | null } {
  const segments = new URL(req.url).pathname.split('/').filter(Boolean);
  const last = segments[segments.length - 1];
  return { id: last && last !== 'campaigns' ? last : null };
}

export const GET = withAdmin(async ({ req }) => {
  const { id } = parseRouteId(req);
  if (!id) return fail(400, 'Missing id');
  const cc = await db.repostCampaign.findUnique({
    where: { id },
    include: { sourceAccounts: { include: { _count: { select: { subscriptions: true, posts: true } } } } },
  });
  if (!cc) return fail(404, 'Not found');
  return ok({
    id: cc.id,
    publicId: cc.publicId,
    name: cc.name,
    iconUrl: cc.iconUrl,
    description: cc.description,
    rulesHtml: cc.rulesHtml,
    active: cc.active,
    ordering: cc.ordering,
    createdAt: cc.createdAt,
    accounts: cc.sourceAccounts.map((a) => ({
      id: a.id,
      platform: a.platform,
      handle: a.handle,
      displayName: a.displayName,
      profileUrl: a.profileUrl,
      avatarUrl: a.avatarUrl,
      active: a.active,
      subscriberCount: a._count.subscriptions,
      postCount: a._count.posts,
      createdAt: a.createdAt,
    })),
  });
}, { permission: 'reposting' });

export const PATCH = withAdmin(async ({ req }) => {
  const { id } = parseRouteId(req);
  if (!id) return fail(400, 'Missing id');

  const parsed = await parseBody(req, updateSchema);
  if ('errorResponse' in parsed) return parsed.errorResponse;
  const v = parsed.data;

  await db.repostCampaign.update({
    where: { id },
    data: {
      ...(v.name        !== undefined && { name: v.name }),
      ...(v.iconUrl     !== undefined && { iconUrl: v.iconUrl }),
      ...(v.description !== undefined && { description: v.description }),
      ...(v.rulesHtml   !== undefined && { rulesHtml: v.rulesHtml }),
      ...(v.active      !== undefined && { active: v.active }),
      ...(v.ordering    !== undefined && { ordering: v.ordering }),
    },
  }).catch(() => null);

  return ok({ ok: true });
}, { permission: 'reposting' });

export const DELETE = withAdmin(async ({ req }) => {
  const { id } = parseRouteId(req);
  if (!id) return fail(400, 'Missing id');
  await db.repostCampaign.delete({ where: { id } }).catch(() => null);
  return ok({ ok: true });
}, { permission: 'reposting' });
