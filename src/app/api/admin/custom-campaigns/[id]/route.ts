// GET    /api/admin/custom-campaigns/[id]
// PATCH  /api/admin/custom-campaigns/[id]
// DELETE /api/admin/custom-campaigns/[id]

import { z } from 'zod';
import { withAdmin, ok, fail, parseBody } from '@/lib/api';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PLATFORMS = ['instagram', 'tiktok', 'youtube', 'snapchat', 'x', 'facebook'] as const;

const exampleSchema = z.object({
  url: z.string().url().max(2048),
  ordering: z.number().int().optional(),
  platform: z.array(z.string()).optional(),
});

const updateSchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  iconUrl: z.string().url().max(2048).nullish(),
  description: z.string().max(4000).nullish(),
  rulesHtml: z.string().max(20_000).nullish(),
  rpm:  z.number().nonnegative().max(1_000_000).optional(),
  base: z.number().nonnegative().max(1_000_000).optional(),
  cap:  z.number().nonnegative().max(1_000_000).optional(),
  threshold: z.number().int().nonnegative().max(10_000_000).optional(),
  thresholdType: z.string().min(1).max(40).optional(),
  platforms: z.array(z.enum(PLATFORMS)).max(6).optional(),
  languages: z.array(z.string().min(1).max(40)).max(20).optional(),
  examples: z.array(exampleSchema).max(20).optional(),
  totalBudget:     z.number().nonnegative().max(1_000_000_000).nullish(),
  budgetRemaining: z.number().nonnegative().max(1_000_000_000).nullish(),
  approvalRate: z.number().min(0).max(100).nullish(),
  dateEnd: z.string().datetime().nullish(),
  inviteOnly: z.boolean().optional(),
  active: z.boolean().optional(),
  ordering: z.number().int().optional(),
  autoRejectDelayHours: z.number().int().min(1).max(720).optional(),
});

async function loadCampaign(id: string) {
  return db.customCampaign.findUnique({
    where: { id },
    include: { _count: { select: { applications: true } } },
  });
}

export const GET = withAdmin(async ({ req }) => {
  const { id } = parseRouteId(req);
  if (!id) return fail(400, 'Missing id');
  const cc = await loadCampaign(id);
  if (!cc) return fail(404, 'Not found');
  return ok({
    ...cc,
    rpm: Number(cc.rpm),
    base: Number(cc.base),
    cap: Number(cc.cap),
    totalBudget:     cc.totalBudget     != null ? Number(cc.totalBudget)     : null,
    budgetRemaining: cc.budgetRemaining != null ? Number(cc.budgetRemaining) : null,
  });
}, { permission: 'campaigns' });

export const PATCH = withAdmin(async ({ req }) => {
  const { id } = parseRouteId(req);
  if (!id) return fail(400, 'Missing id');

  const parsed = await parseBody(req, updateSchema);
  if ('errorResponse' in parsed) return parsed.errorResponse;
  const v = parsed.data;

  // Validate cap ≥ base if either is changing
  if (v.cap != null || v.base != null) {
    const existing = await db.customCampaign.findUnique({ where: { id }, select: { base: true, cap: true } });
    if (!existing) return fail(404, 'Not found');
    const newBase = v.base ?? Number(existing.base);
    const newCap  = v.cap  ?? Number(existing.cap);
    if (newCap < newBase) return fail(400, 'Cap must be ≥ base');
  }

  await db.customCampaign.update({
    where: { id },
    data: {
      ...(v.name        !== undefined && { name: v.name }),
      ...(v.iconUrl     !== undefined && { iconUrl: v.iconUrl }),
      ...(v.description !== undefined && { description: v.description }),
      ...(v.rulesHtml   !== undefined && { rulesHtml: v.rulesHtml }),
      ...(v.rpm         !== undefined && { rpm: v.rpm }),
      ...(v.base        !== undefined && { base: v.base }),
      ...(v.cap         !== undefined && { cap: v.cap }),
      ...(v.threshold   !== undefined && { threshold: v.threshold }),
      ...(v.thresholdType !== undefined && { thresholdType: v.thresholdType }),
      ...(v.platforms   !== undefined && { platforms: v.platforms }),
      ...(v.languages   !== undefined && { languages: v.languages }),
      ...(v.examples    !== undefined && { examplesJson: v.examples }),
      ...(v.totalBudget !== undefined && { totalBudget: v.totalBudget }),
      ...(v.budgetRemaining !== undefined && { budgetRemaining: v.budgetRemaining }),
      ...(v.approvalRate    !== undefined && { approvalRate: v.approvalRate }),
      ...(v.dateEnd     !== undefined && { dateEnd: v.dateEnd ? new Date(v.dateEnd) : null }),
      ...(v.inviteOnly  !== undefined && { inviteOnly: v.inviteOnly }),
      ...(v.active      !== undefined && { active: v.active }),
      ...(v.ordering    !== undefined && { ordering: v.ordering }),
      ...(v.autoRejectDelayHours !== undefined && { autoRejectDelayHours: v.autoRejectDelayHours }),
    },
  });

  return ok({ ok: true });
}, { permission: 'campaigns' });

export const DELETE = withAdmin(async ({ req }) => {
  const { id } = parseRouteId(req);
  if (!id) return fail(400, 'Missing id');
  await db.customCampaign.delete({ where: { id } }).catch(() => null);
  return ok({ ok: true });
}, { permission: 'campaigns' });

/** Pull the [id] segment out of the URL — works regardless of route signature. */
function parseRouteId(req: Request): { id: string | null } {
  const segments = new URL(req.url).pathname.split('/').filter(Boolean);
  // .../api/admin/custom-campaigns/<id>
  const last = segments[segments.length - 1];
  return { id: last && last !== 'custom-campaigns' ? last : null };
}
