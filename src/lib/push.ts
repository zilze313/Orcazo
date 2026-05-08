// Server-side web push utility. Never import this from client components.
import 'server-only';
import webpush from 'web-push';
import { db } from './db';
import { log } from './logger';

const vapidConfigured =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
  process.env.VAPID_PRIVATE_KEY &&
  process.env.VAPID_SUBJECT;

if (vapidConfigured) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/**
 * Send a push notification to all subscribed admin devices.
 * Fire-and-forget — never throws; stale subscriptions are auto-removed.
 */
export async function notifyAdmins(payload: PushPayload): Promise<void> {
  if (!vapidConfigured) return;

  let subscriptions;
  try {
    subscriptions = await db.adminPushSubscription.findMany();
  } catch (err) {
    log.warn('push.fetch_subscriptions_failed', { err: String(err) });
    return;
  }

  if (subscriptions.length === 0) return;

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
      ).catch(async (err: { statusCode?: number }) => {
        // 410 Gone / 404 = subscription expired — delete it
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await db.adminPushSubscription
            .delete({ where: { id: sub.id } })
            .catch(() => null);
        }
        throw err;
      }),
    ),
  );

  const failed = results.filter((r) => r.status === 'rejected').length;
  if (failed > 0) {
    log.warn('push.some_failed', { total: subscriptions.length, failed });
  }
}
