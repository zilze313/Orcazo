// POST /api/referrals/claim
// Creator submits a claim for their referral reward once the threshold is met.
// Only one PENDING/APPROVED claim per employee is allowed.

import { withEmployee, ok, fail } from '@/lib/api';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { getReferralConfig } from '@/lib/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withEmployee(async ({ session }) => {
  const { threshold, reward } = await getReferralConfig();

  // Count referrals for this employee
  const ownerNote = `creator:${session.employeeId}`;
  const referralCode = await db.referralCode.findFirst({
    where: { note: ownerNote },
    select: { code: true },
  });
  if (!referralCode) return fail(400, 'No referral code found for your account.', 'NO_CODE');

  const referralCount = await db.creatorSignupRequest.count({
    where: { referralCode: referralCode.code },
  });

  if (referralCount < threshold) {
    return fail(400, `You need ${threshold} referrals to claim. You have ${referralCount}.`, 'BELOW_THRESHOLD');
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
      referralCount,
      threshold,
      rewardAmount: new Prisma.Decimal(reward.toFixed(2)),
    },
  });

  return ok({ claim: { id: claim.id, status: claim.status, createdAt: claim.createdAt } });
});
