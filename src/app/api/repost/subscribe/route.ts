// POST /api/repost/subscribe → { sourceAccountId, subscribe: boolean }
// Instant, no approval needed — the creator just toggles it.

import { withEmployee, ok, fail, parseBody } from '@/lib/api';
import { db } from '@/lib/db';
import { repostSubscribeBody } from '@/lib/validators';
import { limits } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withEmployee(async ({ req, session }) => {
  const parsed = await parseBody(req, repostSubscribeBody);
  if ('errorResponse' in parsed) return parsed.errorResponse;
  const { sourceAccountId, subscribe } = parsed.data;

  const account = await db.repostSourceAccount.findUnique({
    where: { id: sourceAccountId },
    select: { id: true, active: true },
  });
  if (!account || !account.active) return fail(404, 'Account not found', 'NOT_FOUND');

  if (subscribe) {
    await db.repostSubscription.upsert({
      where: { employeeId_sourceAccountId: { employeeId: session.employeeId, sourceAccountId } },
      create: { employeeId: session.employeeId, sourceAccountId },
      update: {},
    });
  } else {
    await db.repostSubscription.deleteMany({
      where: { employeeId: session.employeeId, sourceAccountId },
    });
  }

  return ok({ ok: true, subscribed: subscribe });
}, { rateLimit: limits.employee });
