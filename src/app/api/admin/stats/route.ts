// GET /api/admin/stats
// High-level counts + chart data for the admin dashboard.

import { db } from '@/lib/db';
import { withAdmin, ok } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildDailyBuckets(days: number): Map<string, number> {
  const m = new Map<string, number>();
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    m.set(toDateKey(d), 0);
  }
  return m;
}

export const GET = withAdmin(async () => {
  const now = new Date();
  const dayAgo   = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    employeeCount,
    allowlistCount,
    submissionCount,
    submissions24h,
    submissions7d,
    submissionsFailed7d,
    activeSessions,
    recentSubmissions,
    earningsAggregate,
    submissionsMonth,
    signupsMonth,
    payoutsMonth,
    proxyOwned,
    proxyConnected,
  ] = await Promise.all([
    db.employee.count(),
    db.allowlist.count(),
    db.submissionAudit.count(),
    db.submissionAudit.count({ where: { createdAt: { gte: dayAgo } } }),
    db.submissionAudit.count({ where: { createdAt: { gte: weekAgo } } }),
    db.submissionAudit.count({ where: { createdAt: { gte: weekAgo }, upstreamSuccess: false } }),
    db.session.count({ where: { expiresAt: { gt: now } } }),
    db.submissionAudit.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { employee: { select: { email: true, firstName: true } } },
    }),
    db.employee.aggregate({
      _sum: {
        cachedPaid:           true,
        cachedWaitingPayment: true,
        cachedWaitingReview:  true,
      },
    }),
    db.submissionAudit.findMany({
      where: { createdAt: { gte: monthAgo } },
      select: { createdAt: true, upstreamSuccess: true },
    }),
    db.employee.findMany({
      where: { createdAt: { gte: monthAgo } },
      select: { createdAt: true },
    }),
    db.payoutRequest.findMany({
      where: { createdAt: { gte: monthAgo } },
      select: { createdAt: true, status: true, amountPaid: true, penalty: true, paidAt: true },
    }),
    db.managedEmail.count(),
    db.allowlist.count({ where: { proxyEmail: { not: null } } }),
  ]);

  const sumDecimal = (v: unknown) => {
    if (v == null) return 0;
    const n = parseFloat(String(v));
    return Number.isFinite(n) ? n : 0;
  };
  // Real (unscaled) money the creators generated since connect: settled + approved + pending.
  const totalEarnings =
    sumDecimal(earningsAggregate._sum.cachedPaid) +
    sumDecimal(earningsAggregate._sum.cachedWaitingPayment) +
    sumDecimal(earningsAggregate._sum.cachedWaitingReview);

  // ── Chart data: submissions per day (30d) ───────────────────────────────
  const subOk   = buildDailyBuckets(30);
  const subFail = buildDailyBuckets(30);
  for (const s of submissionsMonth) {
    const key = toDateKey(s.createdAt);
    if (s.upstreamSuccess) subOk.set(key, (subOk.get(key) ?? 0) + 1);
    else subFail.set(key, (subFail.get(key) ?? 0) + 1);
  }
  const submissionsChart = [...subOk.keys()].map((date) => ({
    date,
    success: subOk.get(date) ?? 0,
    failed: subFail.get(date) ?? 0,
  }));

  // ── Chart data: creator signups per day (30d) ──────────────────────────
  const signupBuckets = buildDailyBuckets(30);
  for (const s of signupsMonth) {
    const key = toDateKey(s.createdAt);
    signupBuckets.set(key, (signupBuckets.get(key) ?? 0) + 1);
  }
  const signupsChart = [...signupBuckets.entries()].map(([date, count]) => ({ date, signups: count }));

  // ── Chart data: payouts per day (30d) ──────────────────────────────────
  const payoutPaid    = buildDailyBuckets(30);
  const payoutPenalty = buildDailyBuckets(30);
  const payoutCount   = buildDailyBuckets(30);
  for (const p of payoutsMonth) {
    const key = toDateKey(p.createdAt);
    payoutCount.set(key, (payoutCount.get(key) ?? 0) + 1);
    if (p.status === 'PAID') {
      payoutPaid.set(key, (payoutPaid.get(key) ?? 0) + sumDecimal(p.amountPaid));
      payoutPenalty.set(key, (payoutPenalty.get(key) ?? 0) + sumDecimal(p.penalty));
    }
  }
  const payoutsChart = [...payoutCount.keys()].map((date) => ({
    date,
    requests: payoutCount.get(date) ?? 0,
    paid: Math.round((payoutPaid.get(date) ?? 0) * 100) / 100,
    penalty: Math.round((payoutPenalty.get(date) ?? 0) * 100) / 100,
  }));

  return ok({
    employeeCount,
    allowlistCount,
    submissionCount,
    submissions24h,
    submissions7d,
    submissionsFailed7d,
    activeSessions,
    recentSubmissions,
    totalEarnings: Math.round(totalEarnings * 100) / 100,
    totalEarningsBreakdown: {
      // "Paid" = what AffiliateNetwork has settled to us for creators' post-connect work (unscaled).
      paid:            Math.round(sumDecimal(earningsAggregate._sum.cachedPaid) * 100) / 100,
      awaitingPayment: Math.round(sumDecimal(earningsAggregate._sum.cachedWaitingPayment) * 100) / 100,
      awaitingReview:  Math.round(sumDecimal(earningsAggregate._sum.cachedWaitingReview) * 100) / 100,
    },
    charts: {
      submissions: submissionsChart,
      signups:     signupsChart,
      payouts:     payoutsChart,
    },
    proxyPool: {
      owned:     proxyOwned,
      connected: proxyConnected,
      free:      Math.max(0, proxyOwned - proxyConnected),
    },
  });
});
