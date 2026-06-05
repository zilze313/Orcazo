// GET  /api/admin/creator-activity → proxy pool inventory + per-creator activity rows
// POST /api/admin/creator-activity  { action: 'reclaim', email } → manually free a proxy

import { z } from 'zod';
import { db } from '@/lib/db';
import { withAdmin, ok, fail, parseBody } from '@/lib/api';
import { getProxyReclaimConfig } from '@/lib/settings';
import { classify, reclaimProxyByEmail } from '@/lib/proxy-reclaim';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function decNum(v: unknown): number {
  if (v == null) return 0;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

export const GET = withAdmin(async () => {
  const [allowRows, ownedCount, config] = await Promise.all([
    db.allowlist.findMany({
      select: {
        email: true,
        proxyEmail: true,
        proxyConnectedAt: true,
        reclaimWarningSentAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    }),
    db.managedEmail.count(),
    getProxyReclaimConfig(),
  ]);

  const emails = allowRows.map((r) => r.email);

  const [employees, signups] = await Promise.all([
    emails.length
      ? db.employee.findMany({
          where: { email: { in: emails } },
          select: {
            id: true, email: true, firstName: true, lastName: true,
            lastLoginAt: true, cachedPaid: true, cachedWaitingPayment: true, cachedWaitingReview: true,
          },
        })
      : [],
    emails.length
      ? db.creatorSignupRequest.findMany({
          where: { publicEmail: { in: emails } },
          select: { publicEmail: true, fullName: true },
        })
      : [],
  ]);

  const empByEmail    = new Map(employees.map((e) => [e.email, e]));
  const nameByEmail   = new Map(signups.map((s) => [s.publicEmail, s.fullName]));

  const now = Date.now();
  let connected = 0;
  let reclaimable = 0;

  const rows = allowRows.map((r) => {
    const emp = empByEmail.get(r.email);
    // Real money this creator generated since connect (settled + approved + pending), unscaled.
    const earnings = emp
      ? decNum(emp.cachedPaid) + decNum(emp.cachedWaitingPayment) + decNum(emp.cachedWaitingReview)
      : 0;
    const hasProxy = !!r.proxyEmail;
    if (hasProxy) connected++;

    const c = classify({
      hasProxy,
      lastLoginAt: emp?.lastLoginAt ?? null,
      proxyConnectedAt: r.proxyConnectedAt,
      earnings,
      protectEarnings: config.protectEarnings,
      reclaimWarningSentAt: r.reclaimWarningSentAt,
      now,
    });
    if (c.reclaimable) reclaimable++;

    const afName = emp?.firstName
      ? `${emp.firstName}${emp.lastName ? ' ' + emp.lastName : ''}`
      : null;

    return {
      email:            r.email,
      displayName:      nameByEmail.get(r.email) ?? afName ?? null,
      proxyEmail:       r.proxyEmail,
      proxyConnectedAt: r.proxyConnectedAt,
      lastLoginAt:      emp?.lastLoginAt ?? null,
      earnings:         Math.round(earnings * 100) / 100,
      idleDays:         c.idleDays,
      status:           c.status,
      reclaimable:      c.reclaimable,
      warningSentAt:    r.reclaimWarningSentAt,
      hasAccount:       !!emp,
    };
  });

  return ok({
    pool: {
      owned:       ownedCount,
      connected,
      free:        Math.max(0, ownedCount - connected),
      reclaimable,
    },
    rows,
    protectEarnings: config.protectEarnings,
    reclaimEnabled:  config.enabled,
  });
}, { permission: 'creators' });

const postBody = z.object({
  action: z.literal('reclaim'),
  email:  z.string().trim().min(3),
});

export const POST = withAdmin(async ({ req, session }) => {
  const parsed = await parseBody(req, postBody);
  if ('errorResponse' in parsed) return parsed.errorResponse;

  const { email } = parsed.data;
  const result = await reclaimProxyByEmail(email);
  if (!result.proxyEmail) return fail(400, 'No connected proxy to reclaim for that creator.', 'NO_PROXY');

  db.adminAuditLog.create({
    data: {
      adminId: session.adminId,
      action:  'proxy.reclaim_manual',
      details: { email, freedProxy: result.proxyEmail },
    },
  }).catch((err) => log.warn('admin.audit_failed', { err: String(err) }));

  log.info('proxy.reclaimed_manual', { email, freedProxy: result.proxyEmail });
  return ok({ ok: true, freedProxy: result.proxyEmail });
}, { permission: 'creators' });
