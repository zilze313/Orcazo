// GET /api/admin/repost/payouts?status=&search=&page=&pageSize=
// Separate table from the main /api/admin/payouts — draws only from repost
// wallet balances, never the upstream-derived one.

import { z } from 'zod';
import { Prisma, RepostPayoutStatus } from '@prisma/client';
import { db } from '@/lib/db';
import { withAdmin, ok } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const querySchema = z.object({
  search:   z.string().trim().max(100).optional(),
  status:   z.enum(['all', 'REQUESTED', 'IN_PROGRESS', 'PAID', 'REJECTED', 'CANCELLED']).default('all'),
  page:     z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const GET = withAdmin(async ({ req }) => {
  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return ok({ entries: [], pagination: { page: 1, pageSize: 25, total: 0, totalPages: 1 } });
  }
  const { search, status, page, pageSize } = parsed.data;

  const where: Prisma.RepostPayoutRequestWhereInput = {
    ...(status !== 'all' ? { status: status as RepostPayoutStatus } : {}),
    ...(search ? {
      employee: {
        OR: [
          { email:     { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName:  { contains: search, mode: 'insensitive' } },
        ],
      },
    } : {}),
  };

  const [total, entries] = await Promise.all([
    db.repostPayoutRequest.count({ where }),
    db.repostPayoutRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        employee: { select: { email: true, firstName: true, lastName: true } },
      },
    }),
  ]);

  return ok({
    entries: entries.map((e) => ({
      ...e,
      amountAtRequest: e.amountAtRequest.toString(),
      amountPaid:  e.amountPaid  != null ? e.amountPaid.toString()  : null,
      penalty:     e.penalty     != null ? e.penalty.toString()     : null,
    })),
    pagination: {
      page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
}, { permission: 'reposting' });
