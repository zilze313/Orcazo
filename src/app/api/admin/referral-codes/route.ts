// GET  /api/admin/referral-codes  — list all codes with usage counts
// POST /api/admin/referral-codes  — create a new code

import { db } from '@/lib/db';
import { withAdmin, ok, parseBody, fail } from '@/lib/api';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createBody = z.object({
  code: z.string().trim().min(2, 'Code must be at least 2 characters').max(50).regex(
    /^[a-zA-Z0-9_-]+$/,
    'Code can only contain letters, numbers, hyphens, and underscores',
  ),
  note: z.string().trim().max(200).optional(),
});

export const GET = withAdmin(async () => {
  const codes = await db.referralCode.findMany({
    orderBy: { createdAt: 'desc' },
  });

  // Count signups per code in one query
  const usageCounts = await db.creatorSignupRequest.groupBy({
    by: ['referralCode'],
    _count: { referralCode: true },
    where: { referralCode: { not: null } },
  });

  const countMap = new Map(
    usageCounts.map((r) => [r.referralCode!, r._count.referralCode]),
  );

  return ok({
    codes: codes.map((c) => ({
      id: c.id,
      code: c.code,
      note: c.note,
      createdAt: c.createdAt,
      usageCount: countMap.get(c.code) ?? 0,
    })),
  });
});

export const POST = withAdmin(async ({ req }) => {
  const parsed = await parseBody(req, createBody);
  if ('errorResponse' in parsed) return parsed.errorResponse;

  const { code, note } = parsed.data;

  // Normalise to lowercase so codes are case-insensitive
  const normCode = code.toLowerCase();

  const existing = await db.referralCode.findUnique({ where: { code: normCode } });
  if (existing) return fail(409, 'A referral code with that name already exists.', 'DUPLICATE_CODE');

  const created = await db.referralCode.create({
    data: { code: normCode, note: note || null },
  });

  return ok({ id: created.id, code: created.code, note: created.note, createdAt: created.createdAt, usageCount: 0 });
});
