// GET  /api/admin/repost/credits?search=&page=&pageSize= → ledger of every credit issued
// POST /api/admin/repost/credits → issue a new credit to a creator's repost wallet.
// This is the ONLY way money enters the repost side — a discretionary judgment
// call, not a formula. Never touches the main upstream-derived balance.

import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { withAdmin, ok, fail, parseBody } from '@/lib/api';
import { db } from '@/lib/db';
import { notifyEmployee } from '@/lib/notifications';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const querySchema = z.object({
  search:   z.string().trim().max(100).optional(),
  page:     z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

const createSchema = z.object({
  employeeId: z.string().min(1).max(64),
  amount: z.number().positive().max(1_000_000),
  note: z.string().trim().min(1, 'A note is required — why is this creator being paid?').max(1000),
});

export const GET = withAdmin(async ({ req }) => {
  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return ok({ items: [], pagination: { page: 1, pageSize: 25, total: 0, totalPages: 1 } });
  }
  const { search, page, pageSize } = parsed.data;

  const where: Prisma.RepostCreditWhereInput = search ? {
    employee: {
      OR: [
        { email:     { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName:  { contains: search, mode: 'insensitive' } },
      ],
    },
  } : {};

  const [total, items] = await Promise.all([
    db.repostCredit.count({ where }),
    db.repostCredit.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { employee: { select: { email: true, firstName: true, lastName: true } } },
    }),
  ]);

  return ok({
    items: items.map((c) => ({
      id: c.id,
      amount: parseFloat(String(c.amount)),
      note: c.note,
      createdAt: c.createdAt,
      employee: c.employee,
    })),
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  });
}, { permission: 'reposting' });

export const POST = withAdmin(async ({ req }) => {
  const parsed = await parseBody(req, createSchema);
  if ('errorResponse' in parsed) return parsed.errorResponse;
  const v = parsed.data;

  const employee = await db.employee.findUnique({ where: { id: v.employeeId }, select: { id: true } });
  if (!employee) return fail(404, 'Creator not found');

  const created = await db.repostCredit.create({
    data: { employeeId: v.employeeId, amount: new Prisma.Decimal(v.amount.toFixed(2)), note: v.note },
  });

  notifyEmployee({
    employeeId: v.employeeId,
    type: 'repost_credit',
    title: `You were credited $${v.amount.toFixed(2)} in your repost wallet`,
    body: v.note,
    url: '/reposting',
  }).catch((err) => log.warn('repost.credits.notify_failed', { id: created.id, err: String(err) }));

  return ok({ id: created.id });
}, { permission: 'reposting' });
