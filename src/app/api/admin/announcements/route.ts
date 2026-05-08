// GET  /api/admin/announcements  → list all (admin)
// POST /api/admin/announcements  → create new

import { z } from 'zod';
import { db } from '@/lib/db';
import { withAdmin, ok, parseBody } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  title:       z.string().trim().min(1, 'Title is required').max(200),
  contentHtml: z.string().min(1, 'Content is required').max(100_000),
  published:   z.boolean().default(false),
});

export const GET = withAdmin(async () => {
  const items = await db.announcement.findMany({
    orderBy: { createdAt: 'desc' },
  });
  return ok({ announcements: items });
});

export const POST = withAdmin(async ({ req }) => {
  const parsed = await parseBody(req, bodySchema);
  if ('errorResponse' in parsed) return parsed.errorResponse;

  const item = await db.announcement.create({ data: parsed.data });
  return ok({ announcement: item });
});
