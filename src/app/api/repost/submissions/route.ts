// GET  /api/repost/submissions → this creator's repost submission history
// POST /api/repost/submissions → submit proof of a repost for a logged post

import { withEmployee, ok, fail, parseBody } from '@/lib/api';
import { db } from '@/lib/db';
import { repostSubmissionBody } from '@/lib/validators';
import { limits } from '@/lib/ratelimit';
import { repostAccountLabel } from '@/lib/repost';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withEmployee(async ({ session }) => {
  const submissions = await db.repostSubmission.findMany({
    where: { employeeId: session.employeeId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      repostPost: {
        include: { sourceAccount: { select: { platform: true, handle: true, displayName: true } } },
      },
    },
  });

  return ok({
    items: submissions.map((s) => ({
      id: s.id,
      repostUrl: s.repostUrl,
      reportedViews: s.reportedViews,
      followers: s.followers,
      status: s.status,
      bountyPaid: s.bountyPaid != null ? parseFloat(String(s.bountyPaid)) : null,
      adminNote: s.adminNote,
      createdAt: s.createdAt,
      post: {
        postUrl: s.repostPost.postUrl,
        account: {
          platform: s.repostPost.sourceAccount.platform,
          label: repostAccountLabel(s.repostPost.sourceAccount),
        },
      },
    })),
  });
}, { rateLimit: limits.employee });

export const POST = withEmployee(async ({ req, session }) => {
  const parsed = await parseBody(req, repostSubmissionBody);
  if ('errorResponse' in parsed) return parsed.errorResponse;
  const { repostPostId, repostUrl, reportedViews, followers } = parsed.data;

  const post = await db.repostPost.findUnique({
    where: { id: repostPostId },
    select: { id: true, sourceAccountId: true, allowRepost: true },
  });
  if (!post) return fail(404, 'Post not found', 'NOT_FOUND');
  if (!post.allowRepost) return fail(400, 'This post is collab-only', 'REPOST_DISABLED');

  const subscribed = await db.repostSubscription.findUnique({
    where: { employeeId_sourceAccountId: { employeeId: session.employeeId, sourceAccountId: post.sourceAccountId } },
  });
  if (!subscribed) return fail(403, 'You must be subscribed to this account to submit a repost', 'NOT_SUBSCRIBED');

  const existing = await db.repostSubmission.findUnique({
    where: { repostPostId_employeeId: { repostPostId, employeeId: session.employeeId } },
  });
  if (existing) return fail(400, 'You already submitted a repost for this post', 'ALREADY_SUBMITTED');

  const created = await db.repostSubmission.create({
    data: {
      repostPostId,
      employeeId: session.employeeId,
      repostUrl,
      reportedViews: reportedViews ?? null,
      followers: followers ?? null,
    },
  });

  return ok({ ok: true, id: created.id });
}, { rateLimit: limits.submitPost });
