// GET  /api/admin/repost/campaigns/[id]/accounts → list source accounts for a campaign
// POST /api/admin/repost/campaigns/[id]/accounts → add a new admin-owned source account

import { z } from 'zod';
import { withAdmin, ok, fail, parseBody } from '@/lib/api';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PLATFORMS = ['instagram', 'tiktok', 'youtube', 'snapchat', 'x', 'facebook'] as const;

const createSchema = z.object({
  platform: z.enum(PLATFORMS),
  handle: z.string().trim().min(1).max(120).transform((v) => v.startsWith('@') ? v.slice(1) : v),
  displayName: z.string().trim().max(160).nullish(),
  profileUrl: z.string().url().max(2048).nullish(),
  avatarUrl: z.string().url().max(2048).nullish(),
  active: z.boolean().default(true),
});

/** Pull the campaign id out of .../campaigns/<id>/accounts */
function parseCampaignId(req: Request): string | null {
  const segments = new URL(req.url).pathname.split('/').filter(Boolean);
  const idx = segments.indexOf('campaigns');
  return idx >= 0 && segments[idx + 1] ? segments[idx + 1] : null;
}

export const GET = withAdmin(async ({ req }) => {
  const campaignId = parseCampaignId(req);
  if (!campaignId) return fail(400, 'Missing campaign id');

  const accounts = await db.repostSourceAccount.findMany({
    where: { repostCampaignId: campaignId },
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { subscriptions: true, posts: true } } },
  });

  return ok({
    items: accounts.map((a) => ({
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

export const POST = withAdmin(async ({ req }) => {
  const campaignId = parseCampaignId(req);
  if (!campaignId) return fail(400, 'Missing campaign id');

  const campaign = await db.repostCampaign.findUnique({ where: { id: campaignId }, select: { id: true } });
  if (!campaign) return fail(404, 'Campaign not found');

  const parsed = await parseBody(req, createSchema);
  if ('errorResponse' in parsed) return parsed.errorResponse;
  const v = parsed.data;

  const created = await db.repostSourceAccount.create({
    data: {
      repostCampaignId: campaignId,
      platform: v.platform,
      handle: v.handle,
      displayName: v.displayName ?? null,
      profileUrl: v.profileUrl ?? null,
      avatarUrl: v.avatarUrl ?? null,
      active: v.active,
    },
  });

  return ok({ id: created.id });
}, { permission: 'reposting' });
