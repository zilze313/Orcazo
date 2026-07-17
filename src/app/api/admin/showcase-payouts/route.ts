// GET  /api/admin/showcase-payouts  → list all cards (admin)
// POST /api/admin/showcase-payouts  → create a card
//
// These cards feed the public homepage "payout wall" marquee. They are fully
// admin-curated — no link to real employees, so nothing sensitive can leak.

import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { withAdmin, ok, parseBody } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  handle:      z.string().trim().max(80).optional().nullable(),
  platform:    z.string().trim().max(40).optional().nullable(),
  amount:      z.coerce.number().min(0).max(9_999_999),
  note:        z.string().trim().max(160).optional().nullable(),
  paidLabel:   z.string().trim().max(40).optional().nullable(),
  active:      z.boolean().default(true),
  ordering:    z.coerce.number().int().min(0).max(9999).default(0),
});

export const GET = withAdmin(async () => {
  const cards = await db.showcasePayout.findMany({
    orderBy: [{ ordering: 'asc' }, { createdAt: 'desc' }],
  });
  return ok({ cards });
}, { permission: 'content' });

export const POST = withAdmin(async ({ req }) => {
  const parsed = await parseBody(req, createSchema);
  if ('errorResponse' in parsed) return parsed.errorResponse;

  const { amount, ...rest } = parsed.data;
  const card = await db.showcasePayout.create({
    data: { ...rest, amount: new Prisma.Decimal(amount.toFixed(2)) },
  });
  return ok({ card });
}, { permission: 'content' });
