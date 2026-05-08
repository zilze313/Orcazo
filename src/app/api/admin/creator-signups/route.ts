// GET /api/admin/creator-signups?status=&search=&page=&pageSize=
//   status: all | PENDING | APPROVED | REJECTED

import { z } from 'zod';
import { Prisma, SignupStatus } from '@prisma/client';
import { db } from '@/lib/db';
import { withAdmin, ok } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const querySchema = z.object({
  search:   z.string().trim().max(100).optional(),
  status:   z.enum(['all', 'PENDING', 'APPROVED', 'REJECTED']).default('all'),
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

  const where: Prisma.CreatorSignupRequestWhereInput = {
    ...(status !== 'all' ? { status: status as SignupStatus } : {}),
    ...(search ? {
      OR: [
        { publicEmail: { contains: search, mode: 'insensitive' } },
        { fullName:    { contains: search, mode: 'insensitive' } },
        { whatsapp:    { contains: search, mode: 'insensitive' } },
      ],
    } : {}),
  };

  const [total, entries] = await Promise.all([
    db.creatorSignupRequest.count({ where }),
    db.creatorSignupRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return ok({
    entries,
    pagination: {
      page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
});
