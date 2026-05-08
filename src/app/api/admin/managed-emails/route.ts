// GET /api/admin/managed-emails?available=true|false
//   Returns all managed emails. If available=true, only returns those NOT
//   currently connected to an Allowlist row — used by the approve modal.
// POST /api/admin/managed-emails    { email, note? }

import { z } from 'zod';
import { db } from '@/lib/db';
import { withAdmin, ok, parseBody, fail } from '@/lib/api';
import { managedEmailAddBody } from '@/lib/validators';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const querySchema = z.object({
  available: z.enum(['true', 'false']).optional(),
});

export const GET = withAdmin(async ({ req }) => {
  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  const availableOnly = parsed.success && parsed.data.available === 'true';

  const all = await db.managedEmail.findMany({ orderBy: { createdAt: 'desc' } });

  if (!availableOnly) {
    // Annotate each with "isConnected" + the public email it's connected to (if any)
    const connections = await db.allowlist.findMany({
      where: { proxyEmail: { in: all.map((m) => m.email) } },
      select: { email: true, proxyEmail: true },
    });
    const connectedMap = new Map(connections.map((c) => [c.proxyEmail!, c.email]));
    return ok({
      entries: all.map((m) => ({
        ...m,
        connectedTo: connectedMap.get(m.email) ?? null,
      })),
    });
  }

  // Available only: subtract currently-connected proxies
  const connectedSet = new Set(
    (await db.allowlist.findMany({
      where: { proxyEmail: { not: null } },
      select: { proxyEmail: true },
    })).map((a) => a.proxyEmail!),
  );

  const entries = all.filter((m) => !connectedSet.has(m.email));
  return ok({ entries });
});

export const POST = withAdmin(async ({ req, session }) => {
  const parsed = await parseBody(req, managedEmailAddBody);
  if ('errorResponse' in parsed) return parsed.errorResponse;

  const { email, note } = parsed.data;

  const existing = await db.managedEmail.findUnique({ where: { email } });
  if (existing) {
    return ok({ entry: existing, alreadyExisted: true });
  }

  const entry = await db.managedEmail.create({
    data: { email, note: note ?? null },
  });

  db.adminAuditLog.create({
    data: {
      adminId: session.adminId,
      action: 'managed_email.add',
      details: { id: entry.id, email },
    },
  }).catch((err) => log.warn('admin.audit_failed', { err: String(err) }));

  return ok({ entry, alreadyExisted: false });
});
