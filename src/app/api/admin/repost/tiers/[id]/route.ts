// PATCH  /api/admin/repost/tiers/[id] — partial update
// DELETE /api/admin/repost/tiers/[id]

import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { withAdmin, ok, fail, parseBody } from '@/lib/api';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  minFollowers: z.coerce.number().int().min(0).max(1_000_000_000).optional(),
  repostBounty: z.coerce.number().min(0).max(1_000_000).optional(),
  collabBounty: z.coerce.number().min(0).max(1_000_000).optional(),
  active: z.boolean().optional(),
});

function parseRouteId(req: Request): string | null {
  const segments = new URL(req.url).pathname.split('/').filter(Boolean);
  const last = segments[segments.length - 1];
  return last && last !== 'tiers' ? last : null;
}

export const PATCH = withAdmin(async ({ req }) => {
  const id = parseRouteId(req);
  if (!id) return fail(400, 'Missing id');

  const parsed = await parseBody(req, patchSchema);
  if ('errorResponse' in parsed) return parsed.errorResponse;
  const v = parsed.data;

  const tier = await db.repostBountyTier.update({
    where: { id },
    data: {
      ...(v.minFollowers != null ? { minFollowers: v.minFollowers } : {}),
      ...(v.repostBounty != null ? { repostBounty: new Prisma.Decimal(v.repostBounty.toFixed(2)) } : {}),
      ...(v.collabBounty != null ? { collabBounty: new Prisma.Decimal(v.collabBounty.toFixed(2)) } : {}),
      ...(v.active != null ? { active: v.active } : {}),
    },
  }).catch(() => null);
  if (!tier) return fail(404, 'Not found');

  return ok({ tier });
}, { permission: 'reposting' });

export const DELETE = withAdmin(async ({ req }) => {
  const id = parseRouteId(req);
  if (!id) return fail(400, 'Missing id');

  const deleted = await db.repostBountyTier.delete({ where: { id } }).catch(() => null);
  if (!deleted) return fail(404, 'Not found');

  return ok({ ok: true });
}, { permission: 'reposting' });
