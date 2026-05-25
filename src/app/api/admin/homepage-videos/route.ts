// GET  /api/admin/homepage-videos        → list all homepage carousel videos
// POST /api/admin/homepage-videos        → register a video after direct-to-Supabase upload
//
// Upload flow:
//   1. POST /api/admin/homepage-videos/sign  { contentType } → { uploadUrl, publicUrl, filePath }
//   2. PUT  uploadUrl  (browser → Supabase directly, no Next.js body limit)
//   3. POST /api/admin/homepage-videos       { url, title }  → creates DB record

import { withAdmin, ok, fail } from '@/lib/api';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withAdmin(async () => {
  const videos = await db.homepageVideo.findMany({
    orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
  });
  return ok({ videos });
}, { permission: 'content' });

export const POST = withAdmin(async ({ req }) => {
  let body: { url?: string; title?: string } | null = null;
  try {
    body = await req.json();
  } catch {
    return fail(400, 'Invalid JSON');
  }

  const url = body?.url?.trim();
  if (!url) return fail(400, 'url is required');

  const maxOrder = await db.homepageVideo.aggregate({ _max: { order: true } });
  const nextOrder = (maxOrder._max.order ?? 0) + 1;

  const video = await db.homepageVideo.create({
    data: {
      url,
      title: typeof body?.title === 'string' && body.title.trim() ? body.title.trim() : null,
      order: nextOrder,
    },
  });

  return ok({ video });
}, { permission: 'content' });
