// GET /api/admin/submissions?search=&status=&sort=&order=&page=&pageSize=
//
// Paginated submission audit. Filterable by employee email/campaign name,
// success/failure status, and time range.

import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { withAdmin, ok } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SORT_FIELDS = ['createdAt', 'campaignName', 'upstreamSuccess'] as const;
type SortField = typeof SORT_FIELDS[number];

const querySchema = z.object({
  search:   z.string().trim().max(100).optional(),
  status:   z.enum(['all', 'success', 'failed']).default('all'),
  sort:     z.enum(SORT_FIELDS).default('createdAt'),
  order:    z.enum(['asc', 'desc']).default('desc'),
  page:     z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const GET = withAdmin(async ({ req }) => {
  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return ok({ submissions: [], pagination: { page: 1, pageSize: 25, total: 0, totalPages: 1 } });
  }
  const { search, status, sort, order, page, pageSize } = parsed.data;

  const where: Prisma.SubmissionAuditWhereInput = {
    ...(status === 'success' ? { upstreamSuccess: true } : {}),
    ...(status === 'failed'  ? { upstreamSuccess: false } : {}),
    ...(search ? {
      OR: [
        { campaignName:  { contains: search, mode: 'insensitive' } },
        { linkSubmitted: { contains: search, mode: 'insensitive' } },
        { employee: { email: { contains: search, mode: 'insensitive' } } },
      ],
    } : {}),
  };

  const [total, submissions] = await Promise.all([
    db.submissionAudit.count({ where }),
    db.submissionAudit.findMany({
      where,
      orderBy: { [sort]: order } as Prisma.SubmissionAuditOrderByWithRelationInput,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        employee: { select: { email: true, firstName: true } },
      },
    }),
  ]);

  return ok({
    submissions,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
});
