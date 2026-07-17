// GET /api/admin/brand-requests?status= → list brand campaign requests

import { db } from '@/lib/db';
import { withAdmin, ok } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUSES = ['NEW', 'CONTACTED', 'CLOSED'] as const;
type Status = (typeof STATUSES)[number];

export const GET = withAdmin(async ({ req }) => {
  const url = new URL(req.url);
  const statusParam = url.searchParams.get('status');
  const status = STATUSES.includes(statusParam as Status) ? (statusParam as Status) : null;

  const requests = await db.brandCampaignRequest.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  const counts = await db.brandCampaignRequest.groupBy({
    by: ['status'],
    _count: { _all: true },
  });

  return ok({
    requests,
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
  });
}, { permission: 'campaigns' });
