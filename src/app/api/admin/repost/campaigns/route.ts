// GET  /api/admin/repost/campaigns → list (with account + subscriber counts)
// POST /api/admin/repost/campaigns → create

import { z } from 'zod';
import { withAdmin, ok, parseBody } from '@/lib/api';
import { db } from '@/lib/db';
import { newRepostCampaignPublicId } from '@/lib/repost';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createSchema = z.object({
  name: z.string().trim().min(2).max(200),
  iconUrl: z.string().url().max(2048).nullish(),
  description: z.string().max(4000).nullish(),
  rulesHtml: z.string().max(20_000).nullish(),
  active: z.boolean().default(true),
  ordering: z.number().int().default(0),
});

export const GET = withAdmin(async () => {
  const list = await db.repostCampaign.findMany({
    orderBy: [{ active: 'desc' }, { ordering: 'asc' }, { createdAt: 'desc' }],
    include: {
      sourceAccounts: {
        select: { id: true, _count: { select: { subscriptions: true } } },
      },
    },
  });

  return ok({
    items: list.map((c) => ({
      id: c.id,
      publicId: c.publicId,
      name: c.name,
      iconUrl: c.iconUrl,
      active: c.active,
      ordering: c.ordering,
      accountCount: c.sourceAccounts.length,
      subscriberCount: c.sourceAccounts.reduce((sum, a) => sum + a._count.subscriptions, 0),
      createdAt: c.createdAt,
    })),
  });
}, { permission: 'reposting' });

export const POST = withAdmin(async ({ req }) => {
  const parsed = await parseBody(req, createSchema);
  if ('errorResponse' in parsed) return parsed.errorResponse;
  const v = parsed.data;

  const created = await db.repostCampaign.create({
    data: {
      publicId: newRepostCampaignPublicId(),
      name: v.name,
      iconUrl: v.iconUrl ?? null,
      description: v.description ?? null,
      rulesHtml: v.rulesHtml ?? null,
      active: v.active,
      ordering: v.ordering,
    },
  });

  return ok({ id: created.id, publicId: created.publicId });
}, { permission: 'reposting' });
