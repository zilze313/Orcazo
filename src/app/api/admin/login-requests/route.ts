// GET /api/admin/login-requests?status=PENDING&page=1

import { z } from 'zod';
import { db } from '@/lib/db';
import { withAdmin, ok } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const querySchema = z.object({
  status:   z.enum(['PENDING', 'RELAYED', 'EXPIRED', 'all']).default('PENDING'),
  page:     z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});

export const GET = withAdmin(async ({ req }) => {
  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  const { status, page, pageSize } = parsed.success ? parsed.data : { status: 'PENDING' as const, page: 1, pageSize: 30 };

  const where = status === 'all' ? {} : { status };

  const [total, requests] = await Promise.all([
    db.loginRequest.count({ where }),
    db.loginRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return ok({
    requests,
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  });
});
