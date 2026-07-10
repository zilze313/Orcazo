// GET /api/repost/campaigns
// Lists active repost programs + their active source accounts, joined with
// this creator's subscriptions so the UI knows which Subscribe buttons to
// show as active.

import { withEmployee, ok } from '@/lib/api';
import { db } from '@/lib/db';
import { limits } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withEmployee(async ({ session }) => {
  const [campaigns, mySubs] = await Promise.all([
    db.repostCampaign.findMany({
      where: { active: true },
      orderBy: [{ ordering: 'asc' }, { createdAt: 'desc' }],
      include: {
        sourceAccounts: {
          where: { active: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    }),
    db.repostSubscription.findMany({
      where: { employeeId: session.employeeId },
      select: { sourceAccountId: true },
    }),
  ]);

  const subscribedSet = new Set(mySubs.map((s) => s.sourceAccountId));

  return ok({
    items: campaigns.map((c) => ({
      publicId: c.publicId,
      name: c.name,
      iconUrl: c.iconUrl,
      description: c.description,
      rulesHtml: c.rulesHtml,
      accounts: c.sourceAccounts.map((a) => ({
        id: a.id,
        platform: a.platform,
        handle: a.handle,
        displayName: a.displayName,
        profileUrl: a.profileUrl,
        avatarUrl: a.avatarUrl,
        subscribed: subscribedSet.has(a.id),
      })),
    })),
  });
}, { rateLimit: limits.employee });
