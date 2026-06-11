// GET /api/cron/reclaim-idle-proxies
//
// Inactivity warning emails. For every creator holding a proxy who is NOT protected
// (earnings <= protect threshold):
//   • idle >= WARN_DAYS and not yet warned  → send the "we haven't seen you" email, stamp warning
//   • logged back in / now protected        → clear the stale warning so they can be warned again later
//
// Proxies are NEVER detached automatically. An idle proxy is only ever freed by an
// admin from the Creator Activity page; this job only sends the nudge email.
//
// Gated by the proxyReclaimEnabled setting (default off). Invoked by Vercel Cron
// once per day (see vercel.json).

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fail, ok } from '@/lib/api';
import { getProxyReclaimConfig } from '@/lib/settings';
import { classify, WARN_DAYS } from '@/lib/proxy-reclaim';
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
    return ok({ ok: true, skipped: 'disabled', warned: 0 });
  }

  const now = Date.now();

  // Only rows that still hold a proxy are relevant.
  const rows = await db.allowlist.findMany({
    where: { proxyEmail: { not: null } },
    select: { email: true, proxyEmail: true, proxyConnectedAt: true, reclaimWarningSentAt: true },
    take: 1000,
  });
  if (rows.length === 0) return ok({ ok: true, warned: 0, cleared: 0 });

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
  let cleared = 0;

  for (const r of rows) {
    if (warned >= MAX_PER_RUN) break;

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
      // Already warned. If they came back after the warning, clear the flag so a
      // later idle stretch can warn them again. Otherwise leave it as-is: we never
      // email twice for the same stretch, and the proxy is never auto-detached
      // (admins free idle proxies manually from the Creator Activity page).
      const cameBack = emp?.lastLoginAt && new Date(emp.lastLoginAt).getTime() > new Date(r.reclaimWarningSentAt).getTime();
      if (cameBack) {
        await db.allowlist.update({ where: { email: r.email }, data: { reclaimWarningSentAt: null } }).catch(() => {});
        cleared++;
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

  log.info('cron.reclaim_idle_proxies', { scanned: rows.length, warned, cleared });
  return ok({ ok: true, scanned: rows.length, warned, cleared });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  return GET(req);
}
