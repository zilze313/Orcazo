// GET /api/cron/reclaim-idle-proxies
//
// Idle-proxy reclamation. For every creator holding a proxy who is NOT protected
// (earnings <= protect threshold):
//   • idle >= WARN_DAYS and not yet warned  → send "log in or lose access" email, stamp warning
//   • warned >= 48h ago and still idle       → detach the proxy (free it) + force logout
//   • logged back in / now protected         → clear the stale warning
//
// Gated by the proxyReclaimEnabled setting (default off). Invoked by Vercel Cron
// once per day (see vercel.json).

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fail, ok } from '@/lib/api';
import { getProxyReclaimConfig } from '@/lib/settings';
import { classify, reclaimProxyByEmail, WARN_DAYS, DETACH_GRACE_MS } from '@/lib/proxy-reclaim';
import { sendEmail, accountInactivityWarningEmail } from '@/lib/email';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_PER_RUN = 100;

// Authorize Vercel Cron requests (they carry a `vercel-cron` user-agent), or a
// bearer token if a CRON_SECRET env var is ever set (for manual triggering).
function isAuthorized(req: NextRequest): boolean {
  const ua = req.headers.get('user-agent') ?? '';
  if (ua.includes('vercel-cron')) return true;
  const secret = process.env.CRON_SECRET ?? '';
  return secret.length > 0 && req.headers.get('authorization') === `Bearer ${secret}`;
}

function decNum(v: unknown): number {
  if (v == null) return 0;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return fail(401, 'Unauthorized', 'UNAUTHENTICATED');

  const config = await getProxyReclaimConfig();
  if (!config.enabled) {
    return ok({ ok: true, skipped: 'disabled', warned: 0, detached: 0 });
  }

  const now = Date.now();

  // Only rows that still hold a proxy can be reclaimed.
  const rows = await db.allowlist.findMany({
    where: { proxyEmail: { not: null } },
    select: { email: true, proxyEmail: true, proxyConnectedAt: true, reclaimWarningSentAt: true },
    take: 1000,
  });
  if (rows.length === 0) return ok({ ok: true, warned: 0, detached: 0, cleared: 0 });

  const emails = rows.map((r) => r.email);
  const employees = await db.employee.findMany({
    where: { email: { in: emails } },
    select: { id: true, email: true, firstName: true, lastName: true, lastLoginAt: true, cachedWaitingPayment: true, cachedWaitingReview: true },
  });
  const empByEmail = new Map(employees.map((e) => [e.email, e]));

  const paidAgg = employees.length
    ? await db.payoutRequest.groupBy({
        by: ['employeeId'],
        where: { employeeId: { in: employees.map((e) => e.id) }, status: 'PAID' },
        _sum: { amountPaid: true },
      })
    : [];
  const paidByEmpId = new Map(paidAgg.map((r) => [r.employeeId, decNum(r._sum.amountPaid)]));

  const signups = await db.creatorSignupRequest.findMany({
    where: { publicEmail: { in: emails } },
    select: { publicEmail: true, fullName: true },
  });
  const nameByEmail = new Map(signups.map((s) => [s.publicEmail, s.fullName]));

  const appUrl  = process.env.NEXT_PUBLIC_APP_URL || 'https://orcazo.com';
  const loginUrl = `${appUrl}/login`;

  let warned = 0;
  let detached = 0;
  let cleared = 0;

  for (const r of rows) {
    if (warned + detached >= MAX_PER_RUN) break;

    const emp = empByEmail.get(r.email);
    const earnings = emp
      ? decNum(emp.cachedWaitingPayment) + decNum(emp.cachedWaitingReview) + (paidByEmpId.get(emp.id) ?? 0)
      : 0;

    const c = classify({
      hasProxy: true,
      lastLoginAt: emp?.lastLoginAt ?? null,
      proxyConnectedAt: r.proxyConnectedAt,
      earnings,
      protectEarnings: config.protectEarnings,
      reclaimWarningSentAt: r.reclaimWarningSentAt,
      now,
    });

    // Protected (earning) — clear any stale warning and skip.
    if (c.isProtected) {
      if (r.reclaimWarningSentAt) {
        await db.allowlist.update({ where: { email: r.email }, data: { reclaimWarningSentAt: null } }).catch(() => {});
        cleared++;
      }
      continue;
    }

    if (r.reclaimWarningSentAt) {
      // Already warned. Did they come back after the warning?
      const cameBack = emp?.lastLoginAt && new Date(emp.lastLoginAt).getTime() > new Date(r.reclaimWarningSentAt).getTime();
      if (cameBack) {
        await db.allowlist.update({ where: { email: r.email }, data: { reclaimWarningSentAt: null } }).catch(() => {});
        cleared++;
        continue;
      }
      // Still idle — has the 48h grace elapsed?
      if (now - new Date(r.reclaimWarningSentAt).getTime() >= DETACH_GRACE_MS) {
        const res = await reclaimProxyByEmail(r.email);
        if (res.proxyEmail) {
          detached++;
          log.info('cron.proxy_reclaimed', { email: r.email, freedProxy: res.proxyEmail });
        }
      }
      continue;
    }

    // Not warned yet — warn once they cross the idle threshold.
    if ((c.idleDays ?? 0) >= WARN_DAYS) {
      const displayName = nameByEmail.get(r.email)
        ?? (emp?.firstName ? `${emp.firstName}${emp.lastName ? ' ' + emp.lastName : ''}` : null);
      const tpl = accountInactivityWarningEmail({ displayName, loginUrl });
      const sent = await sendEmail({ to: r.email, ...tpl });
      if (sent.ok) {
        await db.allowlist.update({ where: { email: r.email }, data: { reclaimWarningSentAt: new Date() } }).catch(() => {});
        warned++;
        log.info('cron.proxy_warning_sent', { email: r.email });
      }
    }
  }

  log.info('cron.reclaim_idle_proxies', { scanned: rows.length, warned, detached, cleared });
  return ok({ ok: true, scanned: rows.length, warned, detached, cleared });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  return GET(req);
}
