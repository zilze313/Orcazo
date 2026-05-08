// GET  /api/admin/allowlist?search=&page=&pageSize=  → list (newest first)
// POST /api/admin/allowlist                          → add an email

import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { withAdmin, ok, parseBody, fail } from '@/lib/api';
import { allowlistAddBody } from '@/lib/validators';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const querySchema = z.object({
  search:   z.string().trim().max(100).optional(),
  page:     z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export const GET = withAdmin(async ({ req }) => {
  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return ok({ entries: [], pagination: { page: 1, pageSize: 50, total: 0, totalPages: 1 } });
  }
  const { search, page, pageSize } = parsed.data;

  const where: Prisma.AllowlistWhereInput = search
    ? {
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          { note:  { contains: search, mode: 'insensitive' } },
        ],
      }
    : {};

  const [total, entries] = await Promise.all([
    db.allowlist.count({ where }),
    db.allowlist.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return ok({
    entries,
    pagination: {
      page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
});

export const POST = withAdmin(async ({ req, session }) => {
  const parsed = await parseBody(req, allowlistAddBody);
  if ('errorResponse' in parsed) return parsed.errorResponse;

  const { email, note, proxyEmail } = parsed.data;

  // If a proxy was supplied, validate it's in the managed pool and not already used
  if (proxyEmail) {
    const managed = await db.managedEmail.findUnique({ where: { email: proxyEmail } });
    if (!managed) return fail(400, 'That proxy email is not in your managed pool', 'NOT_MANAGED');
    const inUse = await db.allowlist.findFirst({ where: { proxyEmail } });
    if (inUse) return fail(400, `Already connected to ${inUse.email}`, 'PROXY_IN_USE');
  }

  // Idempotent: existing email → return existing row (don't overwrite proxy)
  const existing = await db.allowlist.findUnique({ where: { email } });
  if (existing) {
    return ok({ entry: existing, alreadyExisted: true });
  }

  const entry = await db.allowlist.create({
    data: {
      email,
      note: note ?? null,
      proxyEmail: proxyEmail ?? null,
      proxyConnectedAt: proxyEmail ? new Date() : null,
      createdBy: session.adminId,
    },
  });

  db.adminAuditLog.create({
    data: {
      adminId: session.adminId,
      action: 'allowlist.add',
      details: { email, entryId: entry.id, proxyEmail },
    },
  }).catch((err) => log.warn('admin.audit_failed', { err: String(err) }));

  return ok({ entry, alreadyExisted: false });
});
