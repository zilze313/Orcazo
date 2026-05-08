// GET /api/admin/brand-signups?status=&search=&page=&pageSize=
//   status: all | new | contacted

import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { withAdmin, ok } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const querySchema = z.object({
  search:   z.string().trim().max(100).optional(),
  status:   z.enum(['all', 'new', 'contacted']).default('all'),
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

  const where: Prisma.BrandSignupRequestWhereInput = {
    ...(status === 'new'       ? { contactedAt: null } : {}),
    ...(status === 'contacted' ? { contactedAt: { not: null } } : {}),
    ...(search ? {
      OR: [
        { email:     { contains: search, mode: 'insensitive' } },
        { brandName: { contains: search, mode: 'insensitive' } },
      ],
    } : {}),
  };

  const [total, entries] = await Promise.all([
    db.brandSignupRequest.count({ where }),
    db.brandSignupRequest.findMany({
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
