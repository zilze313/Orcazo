// GET /api/admin/repost/submissions?status=&page=&pageSize= → review queue

import { z } from 'zod';
import { Prisma, RepostSubmissionStatus } from '@prisma/client';
import { withAdmin, ok } from '@/lib/api';
import { db } from '@/lib/db';
import { repostAccountLabel } from '@/lib/repost';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const querySchema = z.object({
  status:   z.enum(['all', 'PENDING', 'REVIEWED']).default('PENDING'),
  page:     z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const GET = withAdmin(async ({ req }) => {
  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return ok({ items: [], pagination: { page: 1, pageSize: 25, total: 0, totalPages: 1 } });
  }
  const { status, page, pageSize } = parsed.data;

  const where: Prisma.RepostSubmissionWhereInput = status !== 'all' ? { status: status as RepostSubmissionStatus } : {};

  const [total, items] = await Promise.all([
    db.repostSubmission.count({ where }),
    db.repostSubmission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        employee: { select: { id: true, email: true, firstName: true, lastName: true } },
        repostPost: { include: { sourceAccount: { select: { platform: true, handle: true, displayName: true } } } },
      },
    }),
  ]);

  return ok({
    items: items.map((s) => ({
      id: s.id,
      repostUrl: s.repostUrl,
      reportedViews: s.reportedViews,
      status: s.status,
      adminNote: s.adminNote,
      createdAt: s.createdAt,
      employee: s.employee,
      post: {
        postUrl: s.repostPost.postUrl,
        account: { platform: s.repostPost.sourceAccount.platform, label: repostAccountLabel(s.repostPost.sourceAccount) },
      },
    })),
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  });
}, { permission: 'reposting' });
