// GET   /api/repost/collab-requests → this creator's collab request history
// POST  /api/repost/collab-requests → ask to join a post as collaborator
// PATCH /api/repost/collab-requests → { id, action: 'accepted' } — creator
//        confirms they accepted the invite in the platform app.

import { withEmployee, ok, fail, parseBody } from '@/lib/api';
import { db } from '@/lib/db';
import { repostCollabRequestBody, repostCollabAcceptBody } from '@/lib/validators';
import { limits } from '@/lib/ratelimit';
import { repostAccountLabel } from '@/lib/repost';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withEmployee(async ({ session }) => {
  const rows = await db.repostCollabRequest.findMany({
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
    items: rows.map((r) => ({
      id: r.id,
      handle: r.handle,
      platform: r.platform,
      followers: r.followers,
      status: r.status,
      bountyPaid: r.bountyPaid != null ? parseFloat(String(r.bountyPaid)) : null,
      adminNote: r.adminNote,
      createdAt: r.createdAt,
      post: {
        postUrl: r.repostPost.postUrl,
        account: {
          platform: r.repostPost.sourceAccount.platform,
          label: repostAccountLabel(r.repostPost.sourceAccount),
        },
      },
    })),
  });
}, { rateLimit: limits.employee });

export const POST = withEmployee(async ({ req, session }) => {
  const parsed = await parseBody(req, repostCollabRequestBody);
  if ('errorResponse' in parsed) return parsed.errorResponse;
  const { repostPostId, handle, platform, followers } = parsed.data;

  const post = await db.repostPost.findUnique({
    where: { id: repostPostId },
    select: { id: true, sourceAccountId: true, allowCollab: true, collabSlots: true },
  });
  if (!post) return fail(404, 'Post not found', 'NOT_FOUND');
  if (!post.allowCollab) return fail(400, 'This post does not accept collaborators', 'COLLAB_DISABLED');

  const subscribed = await db.repostSubscription.findUnique({
    where: { employeeId_sourceAccountId: { employeeId: session.employeeId, sourceAccountId: post.sourceAccountId } },
  });
  if (!subscribed) return fail(403, 'You must be subscribed to this account to request a collab', 'NOT_SUBSCRIBED');

  const existing = await db.repostCollabRequest.findUnique({
    where: { repostPostId_employeeId: { repostPostId, employeeId: session.employeeId } },
  });
  if (existing) return fail(400, 'You already requested a collab on this post', 'ALREADY_REQUESTED');

  // Slot cap: platforms limit collaborators per post, so only count requests
  // still in the running (everything except REJECTED).
  const taken = await db.repostCollabRequest.count({
    where: { repostPostId, status: { not: 'REJECTED' } },
  });
  if (taken >= post.collabSlots) return fail(400, 'All collab slots for this post are taken', 'SLOTS_FULL');

  const created = await db.repostCollabRequest.create({
    data: {
      repostPostId,
      employeeId: session.employeeId,
      handle: handle.replace(/^@/, ''),
      platform: platform || null,
      followers: followers ?? null,
    },
  });

  return ok({ ok: true, id: created.id });
}, { rateLimit: limits.submitPost });

export const PATCH = withEmployee(async ({ req, session }) => {
  const parsed = await parseBody(req, repostCollabAcceptBody);
  if ('errorResponse' in parsed) return parsed.errorResponse;

  // Creator can only confirm their own INVITED request.
  const res = await db.repostCollabRequest.updateMany({
    where: { id: parsed.data.id, employeeId: session.employeeId, status: 'INVITED' },
    data: { status: 'ACCEPTED', acceptedAt: new Date() },
  });
  if (res.count === 0) return fail(404, 'No invited collab request found', 'NOT_FOUND');

  return ok({ ok: true });
}, { rateLimit: limits.employee });
