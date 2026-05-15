// GET /api/referrals → returns referral stats for the logged-in creator
// Each creator's email is their implicit referral code (we look up
// signups that used a code matching any ReferralCode associated with them).
// For now, we return signups that used ANY referral code where the code
// matches the creator's first name or email prefix.

import { withEmployee, ok } from '@/lib/api';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withEmployee(async ({ session }) => {
  // Get the employee's info
  const employee = await db.employee.findUnique({
    where: { id: session.employeeId },
    select: { email: true, firstName: true },
  });

  if (!employee) return ok({ referrals: [], totalReferred: 0, code: null });

  // Find referral codes that might belong to this creator
  // Strategy: match codes against the creator's email prefix or first name
  const emailPrefix = employee.email.split('@')[0].toLowerCase();

  // Look for referral codes containing the creator's email prefix
  const codes = await db.referralCode.findMany({
    where: {
      code: {
        contains: emailPrefix,
        mode: 'insensitive',
      },
    },
    select: { code: true },
  });

  if (codes.length === 0) {
    return ok({ referrals: [], totalReferred: 0, code: null });
  }

  const codeValues = codes.map((c) => c.code);

  // Count signups that used these referral codes
  const signups = await db.creatorSignupRequest.findMany({
    where: {
      referralCode: { in: codeValues },
    },
    select: {
      id: true,
      fullName: true,
      status: true,
      createdAt: true,
      referralCode: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return ok({
    code: codeValues[0] ?? null,
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
