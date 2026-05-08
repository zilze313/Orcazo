// Helpers for API route handlers — consistent error shape, request parsing,
// and a guard that wraps authenticated handlers.

import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { ZodSchema, ZodError } from 'zod';
import { getEmployeeSession, getAdminSession } from './session';
import { rateLimit, RateLimitOpts } from './ratelimit';
import { UpstreamError } from './affiliatenetwork/types';
import { log } from './logger';

export interface ApiError {
  error: string;
  code?: string;
  details?: unknown;
}

export const ok = <T,>(data: T, init?: ResponseInit) => NextResponse.json(data, init);

export const fail = (status: number, error: string, code?: string, details?: unknown) =>
  NextResponse.json<ApiError>({ error, code, details }, { status });

export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

/** Parse + validate JSON body. Returns either parsed data or an error response. */
export async function parseBody<T>(
  req: NextRequest,
  schema: ZodSchema<T>,
): Promise<{ data: T } | { errorResponse: NextResponse }> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return { errorResponse: fail(400, 'Invalid JSON body', 'BAD_JSON') };
  }
  try {
    return { data: schema.parse(json) };
  } catch (err) {
    if (err instanceof ZodError) {
      return { errorResponse: fail(400, 'Validation failed', 'VALIDATION', err.flatten()) };
    }
    return { errorResponse: fail(400, 'Bad request', 'BAD_REQUEST') };
  }
}

/** Standard rate-limit response. Sets Retry-After header. */
export function rateLimitResponse(retryAfterMs: number) {
  return fail(429, 'Too many requests', 'RATE_LIMITED', { retryAfterMs });
}

export function applyLimit(key: string, opts: RateLimitOpts) {
  const r = rateLimit(key, opts);
  return r.ok ? null : rateLimitResponse(r.retryAfterMs);
}

/**
 * Wrap an authenticated route handler. Resolves the session, applies a per-employee
 * rate limit, and converts UpstreamError into a stable JSON response.
 */
export function withEmployee<T>(
  handler: (
    ctx: {
      req: NextRequest;
      session: NonNullable<Awaited<ReturnType<typeof getEmployeeSession>>>;
      ip: string;
    },
  ) => Promise<NextResponse>,
  opts?: { rateLimit?: RateLimitOpts },
) {
  return async (req: NextRequest) => {
    const session = await getEmployeeSession();
    if (!session) return fail(401, 'Not authenticated', 'UNAUTHENTICATED');

    if (opts?.rateLimit) {
      const r = applyLimit(`emp:${session.employeeId}`, opts.rateLimit);
      if (r) return r;
    }

    const ip = getClientIp(req);

    try {
      return await handler({ req, session, ip });
    } catch (err) {
      return mapError(err);
    }
  };
}

export function withAdmin<T>(
  handler: (
    ctx: {
      req: NextRequest;
      session: NonNullable<Awaited<ReturnType<typeof getAdminSession>>>;
      ip: string;
    },
  ) => Promise<NextResponse>,
) {
  return async (req: NextRequest) => {
    const session = await getAdminSession();
    if (!session) return fail(401, 'Not authenticated', 'UNAUTHENTICATED');
    const ip = getClientIp(req);
    try {
      return await handler({ req, session, ip });
    } catch (err) {
      return mapError(err);
    }
  };
}

function mapError(err: unknown): NextResponse {
  if (err instanceof UpstreamError) {
    if (err.code === 'UNAUTHENTICATED') {
      // Upstream session died. Tell the client to re-login.
      return fail(401, 'Upstream session expired — please log in again', 'UPSTREAM_EXPIRED');
    }
    if (err.code === 'RATE_LIMITED') {
      return fail(503, 'Upstream is rate-limiting us, please retry shortly', 'UPSTREAM_RATE_LIMITED');
    }
    if (err.code === 'TIMEOUT') {
      return fail(504, 'Upstream timed out', 'UPSTREAM_TIMEOUT');
    }
    if (err.code === 'NETWORK') {
      return fail(502, 'Cannot reach upstream', 'UPSTREAM_NETWORK');
    }
    log.error('upstream.unhandled', { code: err.code, status: err.status, msg: err.message });
    return fail(502, 'Upstream error', 'UPSTREAM_ERROR');
  }

  log.error('route.unhandled', { err: String(err), stack: err instanceof Error ? err.stack : undefined });
  return fail(500, 'Internal server error', 'INTERNAL');
}
