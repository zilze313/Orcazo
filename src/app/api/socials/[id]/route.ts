// DELETE /api/socials/[id] — remove a social account by publicId

import { NextRequest, NextResponse } from 'next/server';
import { fail, ok, getClientIp } from '@/lib/api';
import { getEmployeeSession } from '@/lib/session';
import { deleteSocial } from '@/lib/affiliatenetwork/client';
import { rateLimit, limits } from '@/lib/ratelimit';
import { UpstreamError } from '@/lib/affiliatenetwork/types';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getEmployeeSession();
  if (!session) return fail(401, 'Not authenticated');

  const r = rateLimit(`emp:${session.employeeId}`, limits.employee);
  if (!r.ok) return fail(429, 'Too many requests', 'RATE_LIMITED', { retryAfterMs: r.retryAfterMs });

  const { id } = await ctx.params;
  if (!id || id.length > 64) return fail(400, 'Bad id', 'BAD_REQUEST');

  try {
    const resp = await deleteSocial(
      session.affiliateNetworkToken,
      id,
      session.affiliateNetworkCookies,
    );
    if (!resp.success) return fail(400, resp.errorMsg || 'Could not delete social', 'UPSTREAM_REJECTED');
    return ok({ ok: true });
  } catch (err) {
    if (err instanceof UpstreamError) {
      if (err.code === 'UNAUTHENTICATED') return fail(401, 'Upstream session expired', 'UPSTREAM_EXPIRED');
      if (err.code === 'TIMEOUT') return fail(504, 'Upstream timed out');
      if (err.code === 'NETWORK') return fail(502, 'Cannot reach upstream');
    }
    log.error('socials.delete_failed', { err: String(err) });
    return fail(500, 'Could not delete social', 'INTERNAL');
  }
}
