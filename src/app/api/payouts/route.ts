// GET  /api/payouts  → upstream payout history (halved monetary fields) + own
//                       saved payout details from last request (auto-fill) +
//                       current waiting-payment amount (gates the request button)
// POST /api/payouts  → create a new PayoutRequest (server enforces $10 minimum)

import { Prisma } from '@prisma/client';
import { withEmployee, ok, parseBody, fail } from '@/lib/api';
import { fetchDash, fetchPayouts } from '@/lib/affiliatenetwork/client';
import { payoutRequestBody } from '@/lib/validators';
import { limits } from '@/lib/ratelimit';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MIN_PAYOUT_USD = 10;

function num(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export const GET = withEmployee(async ({ session }) => {
  // Three things in parallel:
  //   1. Upstream payout history (halved)
  //   2. Live waiting-payment from upstream dash (halved)
  //   3. Last saved payout details from our DB (for auto-fill)
  const [payoutsResp, dashResp, lastReq] = await Promise.all([
    fetchPayouts(session.affiliateNetworkToken, session.affiliateNetworkCookies).catch(() => null),
    fetchDash(
      session.affiliateNetworkToken,
      { status: 'all', campaignName: 'all', onlySevenDays: false },
      session.affiliateNetworkCookies,
    ).catch(() => null),
    db.payoutRequest.findFirst({
      where: { employeeId: session.employeeId },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  // Halve every monetary field; pass through the rest (id, status, dates, fee).
  // Fee is NOT halved per spec — fees aren't earnings, they're real costs.
  const history = (payoutsResp?.payouts ?? []).map((p) => ({
    id: p.id,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    status: p.status,
    paymentMethod: p.paymentMethod,
    amountSubmitted: num(p.amountSubmitted) / 2,
    fee:             p.fee != null ? num(p.fee) : null,
    amountPaid:      p.amountPaid != null ? num(p.amountPaid) / 2 : null,
    currency: p.currency,
  }));

  const waitingPayment = num(dashResp?.totalWaitingPayment) / 2;

  // Cache waiting-payment on the Employee row so other parts of the app can
  // read it cheaply (we don't currently use this elsewhere, but it sets up the
  // pattern for future server-side gates).
  if (dashResp != null) {
    const waitingReview = num(dashResp.totalWaitingReview) / 2;
    db.employee.update({
      where: { id: session.employeeId },
      data: {
        cachedWaitingPayment: new Prisma.Decimal(waitingPayment.toFixed(2)),
        cachedWaitingReview:  new Prisma.Decimal(waitingReview.toFixed(2)),
        cachedSummaryAt: new Date(),
      },
    }).catch(() => {});
  }

  // Pre-fill: surface only the saved details, never amounts/status from old requests
  const savedDetails = lastReq
    ? { method: lastReq.method, details: lastReq.details }
    : null;

  // Pending request status — block submitting another while one is open
  const pending = await db.payoutRequest.findFirst({
    where: {
      employeeId: session.employeeId,
      status: { in: ['REQUESTED', 'IN_PROGRESS'] },
    },
    orderBy: { createdAt: 'desc' },
  });

  return ok({
    history,
    waitingPayment,
    minPayout: MIN_PAYOUT_USD,
    canRequest: waitingPayment >= MIN_PAYOUT_USD && !pending,
    pending: pending ? { id: pending.id, status: pending.status, createdAt: pending.createdAt } : null,
    savedDetails,
  });
}, { rateLimit: limits.employee });

export const POST = withEmployee(async ({ req, session }) => {
  const parsed = await parseBody(req, payoutRequestBody);
  if ('errorResponse' in parsed) return parsed.errorResponse;

  // Pull live waiting-payment AT request time. Trust upstream over our cache.
  const dashResp = await fetchDash(
    session.affiliateNetworkToken,
    { status: 'all', campaignName: 'all', onlySevenDays: false },
    session.affiliateNetworkCookies,
  ).catch(() => null);

  const waitingPayment = num(dashResp?.totalWaitingPayment) / 2;
  if (waitingPayment < MIN_PAYOUT_USD) {
    return fail(400, `You need at least $${MIN_PAYOUT_USD} in awaiting payment to request a payout.`, 'BELOW_MIN');
  }

  // Block parallel pending requests
  const pending = await db.payoutRequest.findFirst({
    where: {
      employeeId: session.employeeId,
      status: { in: ['REQUESTED', 'IN_PROGRESS'] },
    },
  });
  if (pending) {
    return fail(400, 'You already have a payout request in progress.', 'PENDING_EXISTS');
  }

  const data = parsed.data;
  let details: Record<string, unknown>;
  if (data.method === 'BANK') {
    details = {
      holderName: data.holderName,
      bankName:   data.bankName,
      iban:       data.iban,
      swift:      data.swift,
    };
  } else {
    details = {
      network: data.network,
      address: data.address,
    };
  }

  const created = await db.payoutRequest.create({
    data: {
      employeeId: session.employeeId,
      method:     data.method,
      details:    details as object,
      amountAtRequest: new Prisma.Decimal(waitingPayment.toFixed(2)),
      notes: data.notes ?? null,
    },
  });

  log.info('payout.requested', { employeeId: session.employeeId, id: created.id, amount: waitingPayment });

  return ok({ ok: true, id: created.id });
}, { rateLimit: limits.submitPost });
