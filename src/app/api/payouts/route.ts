// GET  /api/payouts  → upstream payout history (2× display rate) + own
//                       saved payout details from last request (auto-fill) +
//                       current waiting-payment amount (gates the request button)
// POST /api/payouts  → create a new PayoutRequest (server enforces $10 minimum)
//
// 2× display rate: every monetary value is doubled before delivery to the browser.
//
// Baseline isolation: payout history is filtered to entries on/after
// proxyConnectedAt; waitingPayment is adjusted by subtracting the baseline
// captured at first dashboard/payouts load.

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

/** Convert a Prisma Decimal (or any stringify-able value) to a plain number. */
function decNum(v: unknown): number {
  if (v == null) return 0;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

export const GET = withEmployee(async ({ session }) => {
  // Five things in parallel:
  //   1. Upstream payout history
  //   2. Live waiting-payment from upstream dash
  //   3. Last saved payout details (auto-fill)
  //   4. Allowlist row (proxyConnectedAt cutoff)
  //   5. Employee baseline fields
  const [payoutsResp, dashResp, lastReq, allowlistRow, employee] = await Promise.all([
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
    db.allowlist.findUnique({
      where: { email: session.email },
      select: { proxyConnectedAt: true },
    }),
    db.employee.findUnique({
      where: { id: session.employeeId },
      select: {
        baselineTotalPaid:      true,
        baselineWaitingPayment: true,
        baselineWaitingReview:  true,
        baselineCapturedAt:     true,
        showFullHistory:        true,
      },
    }),
  ]);

  // ── Lazy baseline capture (if creator arrives here before the dashboard) ──
  if (employee && !employee.baselineCapturedAt && dashResp != null) {
    db.employee.update({
      where: { id: session.employeeId },
      data: {
        baselineTotalPaid:      new Prisma.Decimal(String(num(dashResp.totalPaid))),
        baselineWaitingPayment: new Prisma.Decimal(String(num(dashResp.totalWaitingPayment))),
        baselineWaitingReview:  new Prisma.Decimal(String(num(dashResp.totalWaitingReview))),
        baselineCapturedAt:     new Date(),
      },
    }).catch(() => {});
  }

  // ── Cutoff filter ─────────────────────────────────────────────────────────
  const showFull = employee?.showFullHistory ?? false;
  const cutoff = showFull ? null : (allowlistRow?.proxyConnectedAt ?? null);
  const cutoffMs = cutoff ? cutoff.getTime() : 0;

  // Filter payout history to entries on/after the connection date.
  // Double every monetary field (2× display rate); pass through the rest.
  // Fee is NOT doubled — fees aren't earnings, they're real costs.
  const history = (payoutsResp?.payouts ?? [])
    .filter((p) => {
      if (!cutoff) return true;
      const ts = new Date(p.createdAt).getTime();
      return Number.isFinite(ts) && ts >= cutoffMs;
    })
    .map((p) => ({
      id: p.id,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      status: p.status,
      paymentMethod: p.paymentMethod,
      amountSubmitted: num(p.amountSubmitted) * 2,
      fee:             p.fee != null ? num(p.fee) : null,
      amountPaid:      p.amountPaid != null ? num(p.amountPaid) * 2 : null,
      currency: p.currency,
    }));

  // ── Baseline-adjusted waitingPayment ──────────────────────────────────────
  const isFirstLoad = !showFull && employee && !employee.baselineCapturedAt;
  const bPayment = showFull ? 0 : (isFirstLoad ? num(dashResp?.totalWaitingPayment) : decNum(employee?.baselineWaitingPayment));
  const bReview  = showFull ? 0 : (isFirstLoad ? num(dashResp?.totalWaitingReview)  : decNum(employee?.baselineWaitingReview));

  const waitingPayment = Math.max(0, num(dashResp?.totalWaitingPayment) - bPayment) * 2;

  // Cache adjusted waiting-payment on the Employee row
  if (dashResp != null) {
    const waitingReview = Math.max(0, num(dashResp.totalWaitingReview) - bReview) * 2;
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
  // Also fetch employee baseline to correctly compute the adjusted amount.
  const [dashResp, employee] = await Promise.all([
    fetchDash(
      session.affiliateNetworkToken,
      { status: 'all', campaignName: 'all', onlySevenDays: false },
      session.affiliateNetworkCookies,
    ).catch(() => null),
    db.employee.findUnique({
      where: { id: session.employeeId },
      select: { baselineWaitingPayment: true, baselineCapturedAt: true, showFullHistory: true },
    }),
  ]);

  const showFull = employee?.showFullHistory ?? false;
  const isFirstLoad = !showFull && employee && !employee.baselineCapturedAt;
  const bPayment = showFull ? 0 : (isFirstLoad ? num(dashResp?.totalWaitingPayment) : decNum(employee?.baselineWaitingPayment));
  const waitingPayment = Math.max(0, num(dashResp?.totalWaitingPayment) - bPayment) * 2;

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
