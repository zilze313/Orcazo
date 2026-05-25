// GET /api/referrals → referral stats + gamified reward status for the logged-in creator.

import { withEmployee, ok } from '@/lib/api';
import { db } from '@/lib/db';
import { getReferralConfig } from '@/lib/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
      select: { id: true, fullName: true, status: true, createdAt: true, referralCode: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    db.referralClaim.findFirst({
      where: { employeeId: session.employeeId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true, rewardAmount: true, adminNote: true, createdAt: true, resolvedAt: true },
    }),
  ]);

  const totalReferred = signups.length;
  const thresholdMet = totalReferred >= config.threshold;
  const canClaim = thresholdMet && (!latestClaim || latestClaim.status === 'REJECTED');

  return ok({
    code: row.code,
    totalReferred,
    referrals: signups.map((s) => ({
      id:     s.id,
      name:   s.fullName,
      status: s.status,
      date:   s.createdAt,
      code:   s.referralCode,
    })),
    reward: {
      threshold:    config.threshold,
      amount:       config.reward,
      thresholdMet,
      canClaim,
      latestClaim: latestClaim
        ? {
            id:          latestClaim.id,
            status:      latestClaim.status,
            rewardAmount: parseFloat(String(latestClaim.rewardAmount)),
            adminNote:   latestClaim.adminNote ?? null,
            createdAt:   latestClaim.createdAt,
            resolvedAt:  latestClaim.resolvedAt ?? null,
          }
        : null,
    },
  });
});
