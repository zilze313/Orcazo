// GET  /api/payouts  → payout history from OUR DB (not upstream) + current
//                       balance available for withdrawal
// POST /api/payouts  → create a new PayoutRequest
//
// Earnings multiplier: all balance/earnings figures use the admin-configured
// multiplier from AdminSetting (key: earningsMultiplier).
//
// Manual payout tracking: history comes exclusively from our PayoutRequest table.
// The "paid" stat = sum of amountPaid on PAID requests for this employee.
// Available balance = (upstream waitingPayment - baseline) * multiplier
//                   - sum(amountAtRequest on PAID payout requests)
// Note: amountAtRequest (not amountPaid) is deducted from balance so that
// penalties are permanently consumed — the creator never gets penalised amount back.

import { Prisma } from '@prisma/client';
import { withEmployee, ok, parseBody, fail } from '@/lib/api';
import { fetchDash } from '@/lib/affiliatenetwork/client';
import { payoutRequestBody } from '@/lib/validators';
import { limits } from '@/lib/ratelimit';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';
import { getEarningsMultiplier } from '@/lib/settings';

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

function decNum(v: unknown): number {
  if (v == null) return 0;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

export const GET = withEmployee(async ({ session }) => {
  const [dashResp, lastReq, employee, payoutHistory, paidAggregate, M] = await Promise.all([
    fetchDash(
      session.affiliateNetworkToken,
      { status: 'all', campaignName: 'all', onlySevenDays: false },
      session.affiliateNetworkCookies,
    ).catch(() => null),
    db.payoutRequest.findFirst({
      where: { employeeId: session.employeeId },
      orderBy: { createdAt: 'desc' },
    }),
    db.employee.findUnique({
      where: { id: session.employeeId },
      select: {
        baselineWaitingPayment: true,
        baselineWaitingReview:  true,
        baselineTotalPaid:      true,
        baselineCapturedAt:     true,
        showFullHistory:        true,
      },
    }),
    // Payout history from our own DB — no upstream fetch needed
    db.payoutRequest.findMany({
      where: { employeeId: session.employeeId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        status: true,
        method: true,
        amountAtRequest: true,
        amountPaid: true,
        penalty: true,
        adminNote: true,
        paidAt: true,
        rejectedAt: true,
      },
    }),
    // Sums for PAID requests:
    // - amountPaid     → what we actually sent the creator (shown as "Total paid out")
    // - amountAtRequest → full amount deducted from balance (penalties are gone permanently)
    db.payoutRequest.aggregate({
      where: { employeeId: session.employeeId, status: 'PAID' },
      _sum: { amountPaid: true, amountAtRequest: true },
    }),
    getEarningsMultiplier(),
  ]);

  // ── Lazy baseline capture ─────────────────────────────────────────────────
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

  // ── Baseline-adjusted balance ─────────────────────────────────────────────
  // Available balance pools both upstream.totalWaitingPayment (approved on AffiliateNetwork)
  // and upstream.totalPaid (paid by AffiliateNetwork to admin, still owed to creator),
  // then deducts the full amountAtRequest of every PAID DB request (penalty stays gone).
  const showFull = employee?.showFullHistory ?? false;
  const isFirstLoad = !showFull && employee && !employee.baselineCapturedAt;
  const bPayment = showFull ? 0 : (isFirstLoad ? num(dashResp?.totalWaitingPayment) : decNum(employee?.baselineWaitingPayment));
  const bPaid    = showFull ? 0 : (isFirstLoad ? num(dashResp?.totalPaid)           : decNum(employee?.baselineTotalPaid));

  const grossWaiting   = (
    Math.max(0, num(dashResp?.totalWaitingPayment) - bPayment) +
    Math.max(0, num(dashResp?.totalPaid)           - bPaid)
  ) * M;
  const totalPaidByUs  = decNum(paidAggregate._sum.amountPaid);      // for "Total paid out" stat
  const totalDeducted  = decNum(paidAggregate._sum.amountAtRequest);  // for balance deduction
  const waitingPayment = Math.max(0, grossWaiting - totalDeducted);

  // Cache adjusted waiting-payment
  if (dashResp != null) {
    const bReview = showFull ? 0 : (isFirstLoad ? num(dashResp?.totalWaitingReview) : decNum(employee?.baselineWaitingReview));
    const waitingReview = Math.max(0, num(dashResp.totalWaitingReview) - bReview) * M;
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

  // Pending request — block submitting another while one is open
  const pending = payoutHistory.find((p) =>
    p.status === 'REQUESTED' || p.status === 'IN_PROGRESS'
  );

  return ok({
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
    waitingPayment,
    totalPaid: Math.round(totalPaidByUs * 100) / 100,
    minPayout: MIN_PAYOUT_USD,
    canRequest: waitingPayment >= MIN_PAYOUT_USD && !pending,
    pending: pending ? { id: pending.id, status: pending.status, createdAt: pending.createdAt } : null,
    savedDetails,
  });
}, { rateLimit: limits.employee });

export const POST = withEmployee(async ({ req, session }) => {
  const parsed = await parseBody(req, payoutRequestBody);
  if ('errorResponse' in parsed) return parsed.errorResponse;

  const [dashResp, employee, paidAggregate, M] = await Promise.all([
    fetchDash(
      session.affiliateNetworkToken,
      { status: 'all', campaignName: 'all', onlySevenDays: false },
      session.affiliateNetworkCookies,
    ).catch(() => null),
    db.employee.findUnique({
      where: { id: session.employeeId },
      select: {
        baselineWaitingPayment: true,
        baselineTotalPaid:      true,
        baselineCapturedAt:     true,
        showFullHistory:        true,
      },
    }),
    db.payoutRequest.aggregate({
      where: { employeeId: session.employeeId, status: 'PAID' },
      _sum: { amountAtRequest: true },
    }),
    getEarningsMultiplier(),
  ]);

  const showFull = employee?.showFullHistory ?? false;
  const isFirstLoad = !showFull && employee && !employee.baselineCapturedAt;
  const bPayment = showFull ? 0 : (isFirstLoad ? num(dashResp?.totalWaitingPayment) : parseFloat(String(employee?.baselineWaitingPayment ?? 0)) || 0);
  const bPaid    = showFull ? 0 : (isFirstLoad ? num(dashResp?.totalPaid)           : parseFloat(String(employee?.baselineTotalPaid      ?? 0)) || 0);
  const grossWaiting  = (
    Math.max(0, num(dashResp?.totalWaitingPayment) - bPayment) +
    Math.max(0, num(dashResp?.totalPaid)           - bPaid)
  ) * M;
  const totalDeducted = parseFloat(String(paidAggregate._sum.amountAtRequest ?? 0)) || 0;
  const waitingPayment = Math.max(0, grossWaiting - totalDeducted);

  if (waitingPayment < MIN_PAYOUT_USD) {
    return fail(400, `You need at least $${MIN_PAYOUT_USD} available to request a payout.`, 'BELOW_MIN');
  }

  const pending = await db.payoutRequest.findFirst({
    where: { employeeId: session.employeeId, status: { in: ['REQUESTED', 'IN_PROGRESS'] } },
  });
  if (pending) {
    return fail(400, 'You already have a payout request in progress.', 'PENDING_EXISTS');
  }

  const data = parsed.data;
  let details: Record<string, unknown>;
  if (data.method === 'BANK') {
    details = { holderName: data.holderName, bankName: data.bankName, iban: data.iban, swift: data.swift };
  } else {
    details = { network: data.network, address: data.address };
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
