// GET  /api/admin/custom-campaigns  → list (with application counts)
// POST /api/admin/custom-campaigns  → create

import { z } from 'zod';
import { withAdmin, ok, fail, parseBody } from '@/lib/api';
import { db } from '@/lib/db';
import { newCustomCampaignPublicId } from '@/lib/custom-campaigns';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PLATFORMS = ['instagram', 'tiktok', 'youtube', 'snapchat', 'x', 'facebook'] as const;

const exampleSchema = z.object({
  url: z.string().url().max(2048),
  ordering: z.number().int().optional(),
  platform: z.array(z.string()).optional(),
});

const createSchema = z.object({
  name: z.string().trim().min(2).max(200),
  iconUrl: z.string().url().max(2048).nullish(),
  description: z.string().max(4000).nullish(),
  rulesHtml: z.string().max(20_000).nullish(),
  rpm:  z.number().nonnegative().max(1_000_000),
  base: z.number().nonnegative().max(1_000_000).default(0),
  cap:  z.number().nonnegative().max(1_000_000),
  threshold: z.number().int().nonnegative().max(10_000_000).default(1000),
  thresholdType: z.string().min(1).max(40).default('views'),
  platforms: z.array(z.enum(PLATFORMS)).max(6).default([]),
  languages: z.array(z.string().min(1).max(40)).max(20).default([]),
  examples: z.array(exampleSchema).max(20).default([]),
  totalBudget:     z.number().nonnegative().max(1_000_000_000).nullish(),
  budgetRemaining: z.number().nonnegative().max(1_000_000_000).nullish(),
  approvalRate: z.number().min(0).max(100).nullish(),
  dateEnd: z.string().datetime().nullish(),
  inviteOnly: z.boolean().default(false),
  active: z.boolean().default(true),
  ordering: z.number().int().default(0),
  autoRejectDelayHours: z.number().int().min(1).max(720).default(48),
});

export const GET = withAdmin(async ({ req }) => {
  const url = new URL(req.url);
  const q = (url.searchParams.get('search') || '').trim().toLowerCase();

  const list = await db.customCampaign.findMany({
    orderBy: [{ active: 'desc' }, { ordering: 'asc' }, { createdAt: 'desc' }],
    include: { _count: { select: { applications: true } } },
  });

  const filtered = q ? list.filter((c) => c.name.toLowerCase().includes(q)) : list;

  return ok({
    items: filtered.map((c) => ({
      id: c.id,
      publicId: c.publicId,
      name: c.name,
      iconUrl: c.iconUrl,
      rpm: Number(c.rpm),
      cap: Number(c.cap),
      platforms: c.platforms,
      languages: c.languages,
      active: c.active,
      ordering: c.ordering,
      applicationCount: c._count.applications,
      createdAt: c.createdAt,
    })),
  });
}, { permission: 'campaigns' });

export const POST = withAdmin(async ({ req }) => {
  const parsed = await parseBody(req, createSchema);
  if ('errorResponse' in parsed) return parsed.errorResponse;
  const v = parsed.data;

  if (v.cap < (v.base ?? 0)) return fail(400, 'Cap must be ≥ base');

  const created = await db.customCampaign.create({
    data: {
      publicId: newCustomCampaignPublicId(),
      name: v.name,
      iconUrl: v.iconUrl ?? null,
      description: v.description ?? null,
      rulesHtml: v.rulesHtml ?? null,
      rpm: v.rpm,
      base: v.base,
      cap: v.cap,
      threshold: v.threshold,
      thresholdType: v.thresholdType,
      platforms: v.platforms,
      languages: v.languages,
      examplesJson: v.examples,
      totalBudget: v.totalBudget ?? null,
      budgetRemaining: v.budgetRemaining ?? v.totalBudget ?? null,
      approvalRate: v.approvalRate ?? null,
      dateEnd: v.dateEnd ? new Date(v.dateEnd) : null,
      inviteOnly: v.inviteOnly,
      active: v.active,
      ordering: v.ordering,
      autoRejectDelayHours: v.autoRejectDelayHours,
    },
  });

  return ok({ id: created.id, publicId: created.publicId });
}, { permission: 'campaigns' });
