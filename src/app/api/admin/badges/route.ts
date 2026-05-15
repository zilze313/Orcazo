// GET /api/admin/badges
// Returns pending-item counts for the sidebar badges. Kept cheap: count queries.

import { db } from '@/lib/db';
import { withAdmin, ok } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withAdmin(async () => {
  const [creatorSignups, payouts, loginRequests, messages] = await Promise.all([
    db.creatorSignupRequest.count({ where: { status: 'PENDING' } }),
    db.payoutRequest.count({ where: { status: { in: ['REQUESTED', 'IN_PROGRESS'] } } }),
    db.loginRequest.count({ where: { status: 'PENDING' } }),
    db.chatMessage.count({ where: { fromAdmin: false, readAt: null } }),
  ]);

  return ok({ creatorSignups, payouts, loginRequests, messages });
});
