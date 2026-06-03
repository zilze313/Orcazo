// GET /api/admin/creator-signups?status=&search=&referralCode=&page=&pageSize=
//   status: all | PENDING | APPROVED | REJECTED

import { z } from 'zod';
import { Prisma, SignupStatus } from '@prisma/client';
import { db } from '@/lib/db';
import { withAdmin, ok } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const querySchema = z.object({
  search:       z.string().trim().max(100).optional(),
  status:       z.enum(['all', 'PENDING', 'APPROVED', 'REJECTED']).default('all'),
  referralCode: z.string().trim().max(50).optional(),
  page:         z.coerce.number().int().min(1).default(1),
  pageSize:     z.coerce.number().int().min(1).max(100).default(25),
});

export const GET = withAdmin(async ({ req }) => {
  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return ok({ entries: [], pagination: { page: 1, pageSize: 25, total: 0, totalPages: 1 } });
  }
  const { search, status, referralCode, page, pageSize } = parsed.data;

  const where: Prisma.CreatorSignupRequestWhereInput = {
    ...(status !== 'all' ? { status: status as SignupStatus } : {}),
    ...(referralCode ? { referralCode: { equals: referralCode, mode: 'insensitive' } } : {}),
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

  // Cross-reference the allowlist so we can flag APPROVED creators whose proxy
  // has since been reclaimed (proxyEmail null) or whose allowlist row was deleted.
  // Those creators can no longer log in, so the UI should show "Removed" rather
  // than a stale "Approved".
  const approvedEmails = entries.filter((e) => e.status === 'APPROVED').map((e) => e.publicEmail);
  const allowRows = approvedEmails.length
    ? await db.allowlist.findMany({
        where: { email: { in: approvedEmails } },
        select: { email: true, proxyEmail: true },
      })
    : [];
  const proxyByEmail = new Map(allowRows.map((r) => [r.email, r.proxyEmail]));

  return ok({
    entries: entries.map((e) => {
      // removed = approved at some point, but no live allowlist row with a proxy now
      const removed =
        e.status === 'APPROVED' && !proxyByEmail.get(e.publicEmail);
      return { ...e, removed };
    }),
    pagination: {
      page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
});
