// GET /api/repost/feed?page=&pageSize=
// New posts from accounts this creator is subscribed to, joined with their
// own submission (if any) so the UI can show "Submit repost" vs. status.

import { withEmployee, ok } from '@/lib/api';
import { db } from '@/lib/db';
import { limits } from '@/lib/ratelimit';
import { repostAccountLabel, getActiveBountyTiers } from '@/lib/repost';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withEmployee(async ({ req, session }) => {
  const url = new URL(req.url);
  const page     = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20', 10)));

  const subs = await db.repostSubscription.findMany({
    where: { employeeId: session.employeeId },
    select: { sourceAccountId: true },
  });
  const sourceAccountIds = subs.map((s) => s.sourceAccountId);

  const tiers = await getActiveBountyTiers();

  if (sourceAccountIds.length === 0) {
    return ok({ items: [], tiers, pagination: { page: 1, pageSize, total: 0, totalPages: 1 } });
  }

  const where = { sourceAccountId: { in: sourceAccountIds } };
  const [total, posts, mySubmissions, myCollabs] = await Promise.all([
    db.repostPost.count({ where }),
    db.repostPost.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        sourceAccount: { select: { platform: true, handle: true, displayName: true } },
        _count: { select: { collabRequests: { where: { status: { not: 'REJECTED' } } } } },
      },
    }),
    db.repostSubmission.findMany({
      where: { employeeId: session.employeeId },
      select: { repostPostId: true, repostUrl: true, reportedViews: true, status: true, createdAt: true },
    }),
    db.repostCollabRequest.findMany({
      where: { employeeId: session.employeeId },
      select: { id: true, repostPostId: true, handle: true, status: true, createdAt: true },
    }),
  ]);

  const submissionByPost = new Map(mySubmissions.map((s) => [s.repostPostId, s]));
  const collabByPost = new Map(myCollabs.map((c) => [c.repostPostId, c]));

  return ok({
    items: posts.map((p) => ({
      id: p.id,
      postUrl: p.postUrl,
      note: p.note,
      createdAt: p.createdAt,
      allowRepost: p.allowRepost,
      allowCollab: p.allowCollab,
      collabSlotsLeft: p.allowCollab ? Math.max(0, p.collabSlots - p._count.collabRequests) : 0,
      account: {
        platform: p.sourceAccount.platform,
        handle: p.sourceAccount.handle,
        label: repostAccountLabel(p.sourceAccount),
      },
      mySubmission: submissionByPost.get(p.id) ?? null,
      myCollabRequest: collabByPost.get(p.id) ?? null,
    })),
    tiers,
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  });
}, { rateLimit: limits.employee });
