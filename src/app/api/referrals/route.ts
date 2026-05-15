// GET /api/referrals → referral stats for the logged-in creator.
//
// On first call, auto-creates a unique ReferralCode owned by this creator.
// The code is stored as: code = "{emailPrefix}-{last6ofEmployeeId}"
// The note field is "creator:{employeeId}" so we can look it up cheaply.

import { withEmployee, ok } from '@/lib/api';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withEmployee(async ({ session }) => {
  // 1. Look up (or create) this creator's referral code
  const ownerNote = `creator:${session.employeeId}`;

  let row = await db.referralCode.findFirst({
    where: { note: ownerNote },
    select: { code: true },
  });

  if (!row) {
    // Derive a short, readable code from email prefix + last 6 chars of employeeId
    const emailPrefix = session.email
      .split('@')[0]
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')   // strip dots, plus signs, etc.
      .slice(0, 12);                // cap length
    const suffix = session.employeeId.slice(-6);
    const code = `${emailPrefix}-${suffix}`;

    // upsert in case of a race (two simultaneous requests)
    row = await db.referralCode.upsert({
      where: { code },
      create: { code, note: ownerNote },
      update: {},
      select: { code: true },
    });
  }

  // 2. Count signups that used this code
  const signups = await db.creatorSignupRequest.findMany({
    where: { referralCode: row.code },
    select: {
      id: true,
      fullName: true,
      status: true,
      createdAt: true,
      referralCode: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return ok({
    code: row.code,
    totalReferred: signups.length,
    referrals: signups.map((s) => ({
      id: s.id,
      name: s.fullName,
      status: s.status,
      date: s.createdAt,
      code: s.referralCode,
    })),
  });
});
