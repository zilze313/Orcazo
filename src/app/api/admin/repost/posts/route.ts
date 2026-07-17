// GET  /api/admin/repost/posts?sourceAccountId= → recent logged posts
// POST /api/admin/repost/posts → log a new post against a source account.
// Creating a post is the trigger that notifies every subscriber (in-app +
// email) — this is the "one click sends to everyone" flow.

import { z } from 'zod';
import { withAdmin, ok, fail, parseBody } from '@/lib/api';
import { db } from '@/lib/db';
import { notifyRepostSubscribers } from '@/lib/repost';
import { SITE } from '@/config/site';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createSchema = z.object({
  sourceAccountId: z.string().min(1).max(64),
  postUrl: z.string().url().max(2048),
  note: z.string().max(2000).nullish(),
  allowRepost: z.boolean().default(true),
  allowCollab: z.boolean().default(false),
  collabSlots: z.coerce.number().int().min(1).max(20).default(5),
});

export const GET = withAdmin(async ({ req }) => {
  const url = new URL(req.url);
  const sourceAccountId = url.searchParams.get('sourceAccountId') || undefined;

  const posts = await db.repostPost.findMany({
    where: sourceAccountId ? { sourceAccountId } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      sourceAccount: { select: { platform: true, handle: true, displayName: true } },
      _count: { select: { submissions: true } },
    },
  });

  return ok({
    items: posts.map((p) => ({
      id: p.id,
      postUrl: p.postUrl,
      note: p.note,
      createdAt: p.createdAt,
      submissionCount: p._count.submissions,
      account: { platform: p.sourceAccount.platform, handle: p.sourceAccount.handle, displayName: p.sourceAccount.displayName },
    })),
  });
}, { permission: 'reposting' });

export const POST = withAdmin(async ({ req }) => {
  const parsed = await parseBody(req, createSchema);
  if ('errorResponse' in parsed) return parsed.errorResponse;
  const v = parsed.data;

  const account = await db.repostSourceAccount.findUnique({ where: { id: v.sourceAccountId }, select: { id: true } });
  if (!account) return fail(404, 'Source account not found');

  if (!v.allowRepost && !v.allowCollab) {
    return fail(400, 'Enable at least one of repost or collab.');
  }

  const created = await db.repostPost.create({
    data: {
      sourceAccountId: v.sourceAccountId,
      postUrl: v.postUrl,
      note: v.note ?? null,
      allowRepost: v.allowRepost,
      allowCollab: v.allowCollab,
      collabSlots: v.collabSlots,
    },
  });

  notifyRepostSubscribers({
    sourceAccountId: v.sourceAccountId,
    repostPostId: created.id,
    postUrl: v.postUrl,
    note: v.note,
    appUrl: SITE.url,
  }).catch((err) => log.warn('repost.posts.notify_failed', { id: created.id, err: String(err) }));

  return ok({ id: created.id });
}, { permission: 'reposting' });
