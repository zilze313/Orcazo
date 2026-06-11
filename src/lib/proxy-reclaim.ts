// Shared logic for idle-proxy classification + manual reclamation. Used by the
// admin activity dashboard (status badges + the manual "Reclaim" action) and by
// the inactivity-warning cron, so both classify creators identically.
//
// Note: there is NO automatic detach. A proxy is only ever freed when an admin
// clicks "Reclaim"; the cron just emails idle creators a nudge.

import 'server-only';
import { db } from './db';

export const WARN_DAYS = 3; // warn after this many idle days

export type ActivityStatus =
  | 'earning'           // protected: has earned > threshold
  | 'never_logged_in'   // proxy connected, never logged in
  | 'at_risk'           // warning email sent, pending detach
  | 'idle'              // logged in once, $0, idle past the warn window
  | 'recent'            // logged in recently, no earnings yet
  | 'no_proxy';         // allowlist row with no proxy connected

export function daysSince(d: Date | null | undefined, now: number = Date.now()): number | null {
  if (!d) return null;
  return Math.floor((now - new Date(d).getTime()) / 86_400_000);
}

/** Pure classification — no DB. The "clock" is lastLoginAt, or proxyConnectedAt if never logged in. */
export function classify(opts: {
  hasProxy: boolean;
  lastLoginAt: Date | null;
  proxyConnectedAt: Date | null;
  earnings: number;
  protectEarnings: number;
  reclaimWarningSentAt: Date | null;
  now?: number;
}): { status: ActivityStatus; idleDays: number | null; isProtected: boolean; reclaimable: boolean } {
  const now = opts.now ?? Date.now();
  const isProtected = opts.earnings > opts.protectEarnings;
  const clock = opts.lastLoginAt ?? opts.proxyConnectedAt;
  const idleDays = daysSince(clock, now);

  let status: ActivityStatus;
  if (!opts.hasProxy)                              status = 'no_proxy';
  else if (isProtected)                            status = 'earning';
  else if (opts.reclaimWarningSentAt)              status = 'at_risk';
  else if (!opts.lastLoginAt)                      status = 'never_logged_in';
  else if ((idleDays ?? 0) >= WARN_DAYS)           status = 'idle';
  else                                             status = 'recent';

  const reclaimable = opts.hasProxy && !isProtected && (idleDays ?? 0) >= WARN_DAYS;

  return { status, idleDays, isProtected, reclaimable };
}

/**
 * Detach a proxy from a creator: frees the proxy back to the pool and logs the
 * creator out. Keeps the Allowlist row + Employee record so they can be
 * reconnected later. Returns the freed proxy email (or null if nothing to do).
 */
export async function reclaimProxyByEmail(email: string): Promise<{ proxyEmail: string | null; employeeId: string | null }> {
  const row = await db.allowlist.findUnique({
    where: { email },
    select: { id: true, email: true, proxyEmail: true },
  });
  if (!row || !row.proxyEmail) return { proxyEmail: null, employeeId: null };

  const freedProxy = row.proxyEmail;

  await db.allowlist.update({
    where: { id: row.id },
    data: {
      proxyEmail:           null,
      proxyConnectedAt:     null,
      inboundAddress:       null,
      pendingOtp:           null,
      pendingOtpAt:         null,
      reclaimWarningSentAt: null,
    },
  });

  // Force logout: end any active sessions for this creator.
  const employee = await db.employee.findUnique({ where: { email }, select: { id: true } });
  if (employee) {
    await db.session.deleteMany({ where: { employeeId: employee.id } }).catch(() => {});
  }

  return { proxyEmail: freedProxy, employeeId: employee?.id ?? null };
}
