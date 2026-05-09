// DELETE /api/admin/referral-codes/[id]  — remove a referral code

import { db } from '@/lib/db';
import { withAdmin, ok, fail } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const DELETE = withAdmin(async ({ req }) => {
  const id = req.url.split('/').at(-1)!;

  const existing = await db.referralCode.findUnique({ where: { id } });
  if (!existing) return fail(404, 'Referral code not found.', 'NOT_FOUND');

  await db.referralCode.delete({ where: { id } });

  return ok({ ok: true });
});
