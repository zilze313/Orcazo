// In-app notifications for creators. Rows feed the bell menu in the creator
// shell. Fire-and-forget: a notification failure must never break the action
// that triggered it.

import 'server-only';
import { db } from './db';
import { log } from './logger';

const MAX_PER_EMPLOYEE = 50;

export async function notifyEmployee(opts: {
  employeeId: string;
  type: 'payout_approved' | 'payout_rejected' | 'repost_new_post' | 'repost_credit' | 'system';
  title: string;
  body?: string;
  url?: string;
}): Promise<void> {
  try {
    await db.notification.create({
      data: {
        employeeId: opts.employeeId,
        type: opts.type,
        title: opts.title.slice(0, 200),
        body: opts.body?.slice(0, 500) ?? null,
        url: opts.url ?? null,
      },
    });

    // Cap stored rows per creator so the table can't grow unbounded.
    const stale = await db.notification.findMany({
      where: { employeeId: opts.employeeId },
      orderBy: { createdAt: 'desc' },
      skip: MAX_PER_EMPLOYEE,
      select: { id: true },
    });
    if (stale.length > 0) {
      await db.notification.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
    }
  } catch (err) {
    log.warn('notifications.create_failed', { employeeId: opts.employeeId, err: String(err) });
  }
}
