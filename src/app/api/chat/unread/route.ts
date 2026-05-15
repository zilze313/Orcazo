// GET /api/chat/unread → returns { count: number }
// Lightweight endpoint for polling unread admin messages.

import { withEmployee, ok } from '@/lib/api';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withEmployee(async ({ session }) => {
  const count = await db.chatMessage.count({
    where: {
      employeeId: session.employeeId,
      fromAdmin: true,
      readAt: null,
    },
  });
  return ok({ count });
});
