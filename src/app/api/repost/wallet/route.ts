// GET  /api/repost/wallet → balance, credit history, payout history from OUR DB
// POST /api/repost/wallet → create a new RepostPayoutRequest
//
// Fully separate from the main dashboard/payouts — this balance is funded
// ONLY by admin-issued RepostCredit rows, never by upstream/AffiliateNetwork
// earnings. See src/lib/repost.ts for the balance formula.

import { Prisma } from '@prisma/client';
import { withEmployee, ok, fail, parseBody } from '@/lib/api';
import { db } from '@/lib/db';
import { payoutRequestBody } from '@/lib/validators';
import { limits } from '@/lib/ratelimit';
import { getRepostWalletBalance } from '@/lib/repost';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MIN_PAYOUT_USD = 10;

function decNum(v: unknown): number {
  if (v == null) return 0;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

export const GET = withEmployee(async ({ session }) => {
  const [balance, credits, payoutHistory, lastReq] = await Promise.all([
    getRepostWalletBalance(session.employeeId),
    db.repostCredit.findMany({
      where: { employeeId: session.employeeId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    db.repostPayoutRequest.findMany({
      where: { employeeId: session.employeeId },
      orderBy: { createdAt: 'desc' },
    }),
    db.repostPayoutRequest.findFirst({
      where: { employeeId: session.employeeId },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const pending = payoutHistory.find((p) => p.status === 'REQUESTED' || p.status === 'IN_PROGRESS');
  const totalPaid = payoutHistory
    .filter((p) => p.status === 'PAID')
    .reduce((sum, p) => sum + decNum(p.amountPaid), 0);

  return ok({
    balance,
    credits: credits.map((c) => ({ id: c.id, amount: decNum(c.amount), note: c.note, createdAt: c.createdAt })),
    history: payoutHistory.map((p) => ({
      id:              p.id,
      createdAt:       p.createdAt,
      status:          p.status,
      method:          p.method,
      amountAtRequest: decNum(p.amountAtRequest),
      amountPaid:      p.amountPaid != null ? decNum(p.amountPaid) : null,
      penalty:         p.penalty   != null ? decNum(p.penalty)   : null,
      adminNote:       p.adminNote ?? null,
      paidAt:          p.paidAt ?? null,
      rejectedAt:      p.rejectedAt ?? null,
    })),
    minPayout: MIN_PAYOUT_USD,
    canRequest: balance >= MIN_PAYOUT_USD && !pending,
    pending: pending ? { id: pending.id, status: pending.status, createdAt: pending.createdAt } : null,
    totalPaid: Math.round(totalPaid * 100) / 100,
    savedDetails: lastReq ? { method: lastReq.method, details: lastReq.details } : null,
  });
}, { rateLimit: limits.employee });

export const POST = withEmployee(async ({ req, session }) => {
  const parsed = await parseBody(req, payoutRequestBody);
  if ('errorResponse' in parsed) return parsed.errorResponse;

  const balance = await getRepostWalletBalance(session.employeeId);
  if (balance < MIN_PAYOUT_USD) {
    return fail(400, `You need at least $${MIN_PAYOUT_USD} in your repost wallet to request a payout.`, 'BELOW_MIN');
  }

  const pending = await db.repostPayoutRequest.findFirst({
    where: { employeeId: session.employeeId, status: { in: ['REQUESTED', 'IN_PROGRESS'] } },
  });
  if (pending) return fail(400, 'You already have a repost payout request in progress.', 'PENDING_EXISTS');

  const data = parsed.data;
  let details: Record<string, unknown>;
  if (data.method === 'BANK') {
    details = { holderName: data.holderName, bankName: data.bankName, iban: data.iban, swift: data.swift };
  } else if (data.method === 'CRYPTO') {
    details = { network: data.network, address: data.address };
  } else {
    details = { email: data.email };
  }

  const created = await db.repostPayoutRequest.create({
    data: {
      employeeId: session.employeeId,
      method: data.method,
      details: details as object,
      amountAtRequest: new Prisma.Decimal(balance.toFixed(2)),
      notes: data.notes ?? null,
    },
  });

  log.info('repost.payout_requested', { employeeId: session.employeeId, id: created.id, amount: balance });
  return ok({ ok: true, id: created.id });
}, { rateLimit: limits.submitPost });
