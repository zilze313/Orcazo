// GET /api/referrals → referral stats + gamified reward status for the logged-in creator.
//
// Qualification rule: a referred signup counts toward the reward threshold only
// once the referred creator has earned >= referralQualifyEarnings on the platform.
// This prevents smurf-account farming.

import { withEmployee, ok } from '@/lib/api';
import { db } from '@/lib/db';
import { getReferralConfig } from '@/lib/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function decNum(v: unknown): number {
  if (v == null) return 0;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

export const GET = withEmployee(async ({ session }) => {
  const ownerNote = `creator:${session.employeeId}`;

  const [config, existingCode] = await Promise.all([
    getReferralConfig(),
    db.referralCode.findFirst({ where: { note: ownerNote }, select: { code: true } }),
  ]);

  let row = existingCode;
  if (!row) {
    const emailPrefix = session.email
      .split('@')[0]
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 12);
    const suffix = session.employeeId.slice(-6);
    const code = `${emailPrefix}-${suffix}`;
    row = await db.referralCode.upsert({
      where: { code },
      create: { code, note: ownerNote },
      update: {},
      select: { code: true },
    });
  }

  const [signups, latestClaim] = await Promise.all([
    db.creatorSignupRequest.findMany({
      where: { referralCode: row.code },
      select: { id: true, fullName: true, publicEmail: true, status: true, createdAt: true, referralCode: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    db.referralClaim.findFirst({
      where: { employeeId: session.employeeId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true, rewardAmount: true, adminNote: true, createdAt: true, resolvedAt: true },
    }),
  ]);

  // Look up Employee rows for each referred signup (matched by publicEmail).
  // Some signups won't have an Employee yet (still PENDING/REJECTED) — those just
  // count as $0 lifetime earnings.
  const emails = signups.map((s) => s.publicEmail);
  const employees = emails.length
    ? await db.employee.findMany({
        where:  { email: { in: emails } },
        select: { id: true, email: true, cachedWaitingPayment: true, cachedWaitingReview: true },
      })
    : [];
  const employeeByEmail = new Map(employees.map((e) => [e.email, e]));

  // For each referred Employee, aggregate the sum of amountPaid on PAID payout
  // requests — that's the "already paid out" half of their lifetime earnings.
  const employeeIds = employees.map((e) => e.id);
  const paidAgg = employeeIds.length
    ? await db.payoutRequest.groupBy({
        by: ['employeeId'],
        where: { employeeId: { in: employeeIds }, status: 'PAID' },
        _sum: { amountPaid: true },
      })
    : [];
  const paidByEmployeeId = new Map(
    paidAgg.map((row) => [row.employeeId, decNum(row._sum.amountPaid)]),
  );

  // Compute per-referral earnings + qualified flag.
  const referrals = signups.map((s) => {
    const emp = employeeByEmail.get(s.publicEmail);
    const earnings = emp
      ? decNum(emp.cachedWaitingPayment) +
        decNum(emp.cachedWaitingReview) +
        (paidByEmployeeId.get(emp.id) ?? 0)
      : 0;
    return {
      id:        s.id,
      name:      s.fullName,
      status:    s.status,
      date:      s.createdAt,
      code:      s.referralCode,
      earnings:  Math.round(earnings * 100) / 100,
      qualified: earnings >= config.qualifyEarnings,
    };
  });

  const totalReferred      = signups.length;
  const qualifiedReferrals = referrals.filter((r) => r.qualified).length;
  const thresholdMet       = qualifiedReferrals >= config.threshold;
  const canClaim           = thresholdMet && (!latestClaim || latestClaim.status === 'REJECTED');

  return ok({
    code: row.code,
    totalReferred,
    qualifiedReferrals,
    referrals,
    reward: {
      threshold:       config.threshold,
      amount:          config.reward,
      qualifyEarnings: config.qualifyEarnings,
      thresholdMet,
      canClaim,
      latestClaim: latestClaim
        ? {
            id:           latestClaim.id,
            status:       latestClaim.status,
            rewardAmount: parseFloat(String(latestClaim.rewardAmount)),
            adminNote:    latestClaim.adminNote ?? null,
            createdAt:    latestClaim.createdAt,
            resolvedAt:   latestClaim.resolvedAt ?? null,
          }
        : null,
    },
  });
});
