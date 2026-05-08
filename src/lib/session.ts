// Cookie-based session for Startify.
// We store ONLY the sessionId in the cookie. The actual upstream token lives
// server-side on the Employee row, so the client never sees it.

import 'server-only';
import { cookies } from 'next/headers';
import { db } from './db';
import { log } from './logger';

const COOKIE_NAME = 'sf_session';
const ADMIN_COOKIE_NAME = 'sf_admin';
const SESSION_TTL_DAYS = 30;
const ADMIN_TTL_HOURS = 12;

const cookieOpts = {
  httpOnly: true as const,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

// =============================================================
// Employee sessions
// =============================================================

export interface EmployeeSession {
  sessionId: string;
  employeeId: string;
  email: string;
  affiliateNetworkToken: string;
  /** Captured during verify-code; required for /fetch-user. May be null for accounts that logged in before cookie capture was added. */
  affiliateNetworkCookies: string | null;
}

export async function createEmployeeSession(opts: {
  employeeId: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  const session = await db.session.create({
    data: {
      employeeId: opts.employeeId,
      expiresAt,
      ipAddress: opts.ipAddress?.slice(0, 64),
      userAgent: opts.userAgent?.slice(0, 256),
    },
  });
  (await cookies()).set(COOKIE_NAME, session.id, { ...cookieOpts, expires: expiresAt });
  return session;
}

export async function getEmployeeSession(): Promise<EmployeeSession | null> {
  const sessionId = (await cookies()).get(COOKIE_NAME)?.value;
  if (!sessionId) return null;

  const session = await db.session.findUnique({
    where: { id: sessionId },
    include: { employee: true },
  });
  if (!session || session.expiresAt < new Date()) return null;

  return {
    sessionId: session.id,
    employeeId: session.employeeId,
    email: session.employee.email,
    affiliateNetworkToken: session.employee.affiliateNetworkToken,
    affiliateNetworkCookies: session.employee.affiliateNetworkCookies,
  };
}

export async function destroyEmployeeSession() {
  const c = await cookies();
  const sessionId = c.get(COOKIE_NAME)?.value;
  if (sessionId) {
    try {
      await db.session.delete({ where: { id: sessionId } });
    } catch (err) {
      log.warn('session.destroy_failed', { err: String(err) });
    }
  }
  c.delete(COOKIE_NAME);
}

// =============================================================
// Admin sessions (separate cookie, separate model, separate auth)
// =============================================================

export interface AdminSession {
  sessionId: string;
  adminId: string;
  email: string;
}

export async function createAdminSession(adminId: string) {
  const expiresAt = new Date(Date.now() + ADMIN_TTL_HOURS * 60 * 60 * 1000);
  const session = await db.adminSession.create({
    data: { adminId, expiresAt },
  });
  (await cookies()).set(ADMIN_COOKIE_NAME, session.id, { ...cookieOpts, expires: expiresAt });
  return session;
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const sessionId = (await cookies()).get(ADMIN_COOKIE_NAME)?.value;
  if (!sessionId) return null;

  const session = await db.adminSession.findUnique({
    where: { id: sessionId },
    include: { admin: true },
  });
  if (!session || session.expiresAt < new Date()) return null;

  return {
    sessionId: session.id,
    adminId: session.adminId,
    email: session.admin.email,
  };
}

export async function destroyAdminSession() {
  const c = await cookies();
  const sessionId = c.get(ADMIN_COOKIE_NAME)?.value;
  if (sessionId) {
    try { await db.adminSession.delete({ where: { id: sessionId } }); } catch {}
  }
  c.delete(ADMIN_COOKIE_NAME);
}

/** Background-safe: prune expired sessions. Call sparingly (e.g. on login). */
export async function pruneExpiredSessions() {
  const now = new Date();
  await Promise.all([
    db.session.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.adminSession.deleteMany({ where: { expiresAt: { lt: now } } }),
  ]).catch(() => {});
}
