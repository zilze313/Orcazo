// GET  /api/admin/repost/tiers → all bounty tiers
// POST /api/admin/repost/tiers → create a tier
//
// Tiers map follower counts to bounties: the applicable tier is the highest
// minFollowers <= the creator's followers, e.g. 50k → $20, 100k → $30.

import { Prisma } from '@prisma/client';
import { withAdmin, ok, parseBody } from '@/lib/api';
import { db } from '@/lib/db';
import { repostBountyTierBody } from '@/lib/validators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withAdmin(async () => {
  const tiers = await db.repostBountyTier.findMany({
    orderBy: { minFollowers: 'asc' },
  });
  return ok({ tiers });
}, { permission: 'reposting' });

export const POST = withAdmin(async ({ req }) => {
  const parsed = await parseBody(req, repostBountyTierBody);
  if ('errorResponse' in parsed) return parsed.errorResponse;
  const v = parsed.data;

  const tier = await db.repostBountyTier.create({
    data: {
      minFollowers: v.minFollowers,
      repostBounty: new Prisma.Decimal(v.repostBounty.toFixed(2)),
      collabBounty: new Prisma.Decimal(v.collabBounty.toFixed(2)),
      active: v.active,
    },
  });
  return ok({ tier });
}, { permission: 'reposting' });
