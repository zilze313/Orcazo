// GET /api/admin/payouts?status=&search=&page=&pageSize=

import { z } from 'zod';
import { Prisma, PayoutStatus } from '@prisma/client';
import { db } from '@/lib/db';
import { withAdmin, ok } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const querySchema = z.object({
  search:   z.string().trim().max(100).optional(),
  status:   z.enum(['all', 'REQUESTED', 'IN_PROGRESS', 'PAID', 'CANCELLED']).default('all'),
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

  const where: Prisma.PayoutRequestWhereInput = {
    ...(status !== 'all' ? { status: status as PayoutStatus } : {}),
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
    db.payoutRequest.count({ where }),
    db.payoutRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        employee: { select: { email: true, firstName: true, lastName: true, bioVerificationCode: true } },
      },
    }),
  ]);

  return ok({
    entries: entries.map((e) => ({
      ...e,
      amountAtRequest: e.amountAtRequest.toString(),
    })),
    pagination: {
      page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
});
