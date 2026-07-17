// GET /api/admin/repost/collab-requests?status=&page=&pageSize=
// Queue of creators asking to be added as collaborators on admin posts.

import { withAdmin, ok } from '@/lib/api';
import { db } from '@/lib/db';
import { repostAccountLabel } from '@/lib/repost';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUSES = ['REQUESTED', 'INVITED', 'ACCEPTED', 'APPROVED', 'REJECTED'] as const;
type Status = (typeof STATUSES)[number];

export const GET = withAdmin(async ({ req }) => {
  const url = new URL(req.url);
  const statusParam = url.searchParams.get('status');
  const status = STATUSES.includes(statusParam as Status) ? (statusParam as Status) : null;
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(url.searchParams.get('pageSize') || '25', 10)));

  const where = status ? { status } : undefined;
  const [total, rows] = await Promise.all([
    db.repostCollabRequest.count({ where }),
    db.repostCollabRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        employee: { select: { id: true, email: true, firstName: true, lastName: true } },
        repostPost: {
          include: { sourceAccount: { select: { platform: true, handle: true, displayName: true } } },
        },
      },
    }),
  ]);

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
      invitedAt: r.invitedAt,
      acceptedAt: r.acceptedAt,
      employee: r.employee,
      post: {
        id: r.repostPost.id,
        postUrl: r.repostPost.postUrl,
        collabSlots: r.repostPost.collabSlots,
        account: {
          platform: r.repostPost.sourceAccount.platform,
          label: repostAccountLabel(r.repostPost.sourceAccount),
        },
      },
    })),
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  });
}, { permission: 'reposting' });
