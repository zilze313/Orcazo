// POST /api/referrals/claim
// Creator submits a claim for their referral reward once enough QUALIFIED
// referrals have earned referralQualifyEarnings each on the platform.
// Only one PENDING/APPROVED claim per employee is allowed.

import { withEmployee, ok, fail } from '@/lib/api';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { getReferralConfig } from '@/lib/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function decNum(v: unknown): number {
  if (v == null) return 0;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

export const POST = withEmployee(async ({ session }) => {
  const { threshold, reward, qualifyEarnings } = await getReferralConfig();

  const ownerNote = `creator:${session.employeeId}`;
  const referralCode = await db.referralCode.findFirst({
    where: { note: ownerNote },
    select: { code: true },
  });
  if (!referralCode) return fail(400, 'No referral code found for your account.', 'NO_CODE');

  // Look up referred signups + their employees + their lifetime earnings
  const signups = await db.creatorSignupRequest.findMany({
    where: { referralCode: referralCode.code },
    select: { publicEmail: true },
  });

  const totalReferred = signups.length;
  let qualifiedCount = 0;

  if (signups.length > 0) {
    const emails = signups.map((s) => s.publicEmail);
    const employees = await db.employee.findMany({
      where: { email: { in: emails } },
      select: { id: true, cachedWaitingPayment: true, cachedWaitingReview: true },
    });

    const paidAgg = employees.length
      ? await db.payoutRequest.groupBy({
          by: ['employeeId'],
          where: { employeeId: { in: employees.map((e) => e.id) }, status: 'PAID' },
          _sum: { amountPaid: true },
        })
      : [];
    const paidByEmployeeId = new Map(
      paidAgg.map((r) => [r.employeeId, decNum(r._sum.amountPaid)]),
    );

    for (const e of employees) {
      const earnings =
        decNum(e.cachedWaitingPayment) +
        decNum(e.cachedWaitingReview) +
        (paidByEmployeeId.get(e.id) ?? 0);
      if (earnings >= qualifyEarnings) qualifiedCount++;
    }
  }

  if (qualifiedCount < threshold) {
    return fail(
      400,
      `You need ${threshold} qualified referrals (each having earned at least $${qualifyEarnings}). You have ${qualifiedCount} qualified out of ${totalReferred} total.`,
      'BELOW_THRESHOLD',
    );
  }

  // Check for existing open/approved claim
  const existing = await db.referralClaim.findFirst({
    where: {
      employeeId: session.employeeId,
      status: { in: ['PENDING', 'APPROVED'] },
    },
  });
  if (existing) {
    return fail(400, 'You already have a pending or approved claim.', 'CLAIM_EXISTS');
  }

  const claim = await db.referralClaim.create({
    data: {
      employeeId:   session.employeeId,
      referralCount: qualifiedCount,
      threshold,
      rewardAmount: new Prisma.Decimal(reward.toFixed(2)),
    },
  });

  return ok({ claim: { id: claim.id, status: claim.status, createdAt: claim.createdAt } });
});
