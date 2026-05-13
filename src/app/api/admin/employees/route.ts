// GET /api/admin/employees?search=&sort=&order=&page=&pageSize=
//
// Paginated, sortable, searchable employee list. Designed to scale: every
// sortable column is indexed; we never load > pageSize rows.

import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { withAdmin, ok } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SORT_FIELDS = ['createdAt', 'firstName', 'email', 'cachedBalance', 'cachedWaitingPayment'] as const;
type SortField = typeof SORT_FIELDS[number];

const querySchema = z.object({
  search: z.string().trim().max(100).optional(),
  sort:   z.enum(SORT_FIELDS).default('createdAt'),
  order:  z.enum(['asc', 'desc']).default('desc'),
  page:   z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const GET = withAdmin(async ({ req }) => {
  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return ok({ employees: [], pagination: { page: 1, pageSize: 25, total: 0, totalPages: 1 } });
  }
  const { search, sort, order, page, pageSize } = parsed.data;

  const where: Prisma.EmployeeWhereInput = search
    ? {
        OR: [
          { email:     { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName:  { contains: search, mode: 'insensitive' } },
        ],
      }
    : {};

  const [total, employees] = await Promise.all([
    db.employee.count({ where }),
    db.employee.findMany({
      where,
      orderBy: { [sort]: order } as Prisma.EmployeeOrderByWithRelationInput,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        affiliateNetworkPublicId: true,
        bioVerificationCode: true,
        cachedBalance: true,
        cachedWaitingPayment: true,
        cachedWaitingReview: true,
        showFullHistory: true,
        lastSyncedAt: true,
        createdAt: true,
      },
    }),
  ]);

  // Fetch social accounts from signup forms (keyed by publicEmail)
  const emails = employees.map((e) => e.email);
  const signupRows = emails.length
    ? await db.creatorSignupRequest.findMany({
        where: { publicEmail: { in: emails } },
        select: { publicEmail: true, socialAccounts: true },
      })
    : [];
  const signupMap = new Map(signupRows.map((r) => [r.publicEmail, r.socialAccounts]));

  return ok({
    employees: employees.map((e) => {
      const accs = signupMap.get(e.email);
      const firstSocial = Array.isArray(accs) && accs.length > 0
        ? (accs[0] as { platform: string; handle: string })
        : null;
      return {
        ...e,
        cachedBalance:        e.cachedBalance?.toString()        ?? null,
        cachedWaitingPayment: e.cachedWaitingPayment?.toString() ?? null,
        cachedWaitingReview:  e.cachedWaitingReview?.toString()  ?? null,
        firstSocial,
      };
    }),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
});
