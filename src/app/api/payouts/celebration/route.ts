// GET  /api/payouts/celebration → most recent PAID payout the creator hasn't
//                                 been congratulated for yet (or null).
// POST /api/payouts/celebration → { id } marks it celebrated so the card is
//                                 shown exactly once.
//
// Only payouts paid within the last 14 days qualify — this keeps historical
// rows (which predate the feature and have celebratedAt = null) from
// producing a stale celebration on the creator's next visit.

import { z } from 'zod';
import { withEmployee, ok, fail, parseBody } from '@/lib/api';
import { limits } from '@/lib/ratelimit';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CELEBRATION_WINDOW_DAYS = 14;

export const GET = withEmployee(async ({ session }) => {
  const since = new Date(Date.now() - CELEBRATION_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const payout = await db.payoutRequest.findFirst({
    where: {
      employeeId: session.employeeId,
      status: 'PAID',
      celebratedAt: null,
      paidAt: { gte: since },
    },
    orderBy: { paidAt: 'desc' },
    select: { id: true, amountPaid: true, paidAt: true },
  });

  if (!payout || payout.amountPaid == null) return ok({ celebration: null });

  return ok({
    celebration: {
      id: payout.id,
      amount: parseFloat(String(payout.amountPaid)) || 0,
      paidAt: payout.paidAt,
    },
  });
}, { rateLimit: limits.employee });

const dismissBody = z.object({ id: z.string().min(1).max(64) });

export const POST = withEmployee(async ({ req, session }) => {
  const parsed = await parseBody(req, dismissBody);
  if ('errorResponse' in parsed) return parsed.errorResponse;

  // Scoped update: a creator can only mark their own payout as celebrated.
  const res = await db.payoutRequest.updateMany({
    where: { id: parsed.data.id, employeeId: session.employeeId, celebratedAt: null },
    data: { celebratedAt: new Date() },
  });
  if (res.count === 0) return fail(404, 'Not found');

  return ok({ ok: true });
}, { rateLimit: limits.employee });
