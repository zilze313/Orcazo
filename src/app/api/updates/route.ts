// GET /api/updates — returns published announcements for creators

import { withEmployee, ok } from '@/lib/api';
import { db } from '@/lib/db';
import { limits } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withEmployee(async () => {
  const items = await db.announcement.findMany({
    where:   { published: true },
    orderBy: { createdAt: 'desc' },
    select:  { id: true, title: true, contentHtml: true, createdAt: true },
  });
  return ok({ announcements: items });
}, { rateLimit: limits.employee });
