// POST /api/admin/push  → save a push subscription
// DELETE /api/admin/push → remove the subscription by endpoint

import { z } from 'zod';
import { db } from '@/lib/db';
import { withAdmin, ok, parseBody } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth:   z.string().min(1),
  }),
});

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

export const POST = withAdmin(async ({ req }) => {
  const parsed = await parseBody(req, subscribeSchema);
  if ('errorResponse' in parsed) return parsed.errorResponse;

  const { endpoint, keys } = parsed.data;

  await db.adminPushSubscription.upsert({
    where:  { endpoint },
    create: { endpoint, p256dh: keys.p256dh, auth: keys.auth },
    update: { p256dh: keys.p256dh, auth: keys.auth, lastUsed: new Date() },
  });

  return ok({ ok: true });
});

export const DELETE = withAdmin(async ({ req }) => {
  const parsed = await parseBody(req, unsubscribeSchema);
  if ('errorResponse' in parsed) return parsed.errorResponse;

  await db.adminPushSubscription
    .delete({ where: { endpoint: parsed.data.endpoint } })
    .catch(() => null); // already gone — that's fine

  return ok({ ok: true });
});
