// PATCH /api/admin/repost/submissions/[id] → mark reviewed with an optional note.
// Reviewing does NOT move money — admin issues a separate RepostCredit once
// they've judged the creator's account/growth. This just closes the loop on
// "we saw your repost."

import { z } from 'zod';
import { withAdmin, ok, fail, parseBody } from '@/lib/api';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const updateSchema = z.object({
  adminNote: z.string().trim().max(1000).nullish(),
});

function parseRouteId(req: Request): string | null {
  const segments = new URL(req.url).pathname.split('/').filter(Boolean);
  const last = segments[segments.length - 1];
  return last && last !== 'submissions' ? last : null;
}

export const PATCH = withAdmin(async ({ req }) => {
  const id = parseRouteId(req);
  if (!id) return fail(400, 'Missing id');

  const parsed = await parseBody(req, updateSchema);
  if ('errorResponse' in parsed) return parsed.errorResponse;

  const updated = await db.repostSubmission.update({
    where: { id },
    data: { status: 'REVIEWED', adminNote: parsed.data.adminNote ?? null, reviewedAt: new Date() },
  }).catch(() => null);
  if (!updated) return fail(404, 'Not found');

  return ok({ ok: true });
}, { permission: 'reposting' });
