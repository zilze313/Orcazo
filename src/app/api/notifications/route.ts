// GET  /api/notifications      → latest notifications + unread count
// POST /api/notifications      → { action: "mark-read" } marks all as read

import { withEmployee, ok, fail } from '@/lib/api';
import { db } from '@/lib/db';
import { limits } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withEmployee(async ({ session }) => {
  const [items, unread] = await Promise.all([
    db.notification.findMany({
      where: { employeeId: session.employeeId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, type: true, title: true, body: true, url: true, readAt: true, createdAt: true },
    }),
    db.notification.count({ where: { employeeId: session.employeeId, readAt: null } }),
  ]);
  return ok({ items, unread });
}, { rateLimit: limits.employee });

export const POST = withEmployee(async ({ req, session }) => {
  let body: { action?: string } | null = null;
  try { body = await req.json(); } catch { return fail(400, 'Invalid JSON'); }
  if (body?.action !== 'mark-read') return fail(400, 'Unknown action');

  await db.notification.updateMany({
    where: { employeeId: session.employeeId, readAt: null },
    data: { readAt: new Date() },
  });
  return ok({ ok: true });
}, { rateLimit: limits.employee });
