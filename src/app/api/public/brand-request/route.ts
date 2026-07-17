// POST /api/public/brand-request — public, rate-limited, captcha-gated.
// A brand asks to launch a campaign on the platform. Stored as a lead and
// reviewed in the admin panel; no brand account is created.

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { applyLimit, fail, getClientIp, ok, parseBody } from '@/lib/api';
import { brandRequestBody } from '@/lib/validators';
import { limits } from '@/lib/ratelimit';
import { verifyTurnstile } from '@/lib/turnstile';
import { notifyAdmins } from '@/lib/push';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  const ipLimit = applyLimit(`ip:${ip}:brand-request`, limits.publicSignup);
  if (ipLimit) return ipLimit;

  const parsed = await parseBody(req, brandRequestBody);
  if ('errorResponse' in parsed) return parsed.errorResponse;

  const tsResult = await verifyTurnstile(parsed.data.turnstileToken, ip);
  if (!tsResult.ok) return fail(400, tsResult.error || 'Captcha failed', 'CAPTCHA_FAILED');

  const { brandName, contactName, email, website, campaignName, budget, platforms, description } = parsed.data;

  const created = await db.brandCampaignRequest.create({
    data: {
      brandName,
      contactName,
      email,
      website: website || null,
      campaignName,
      budget,
      platforms,
      description: description || null,
      ipAddress: ip.slice(0, 64),
      userAgent: req.headers.get('user-agent')?.slice(0, 500) ?? null,
    },
    select: { id: true },
  });

  log.info('brand_request.received', { id: created.id, brandName, email });

  // Notify admins (fire-and-forget — never block the response)
  notifyAdmins({
    title: '💼 New brand campaign request',
    body: `${brandName}: ${campaignName} (${budget})`,
    url: '/admin/brand-requests',
    tag: 'brand-request',
  }).catch(() => null);

  return ok({ ok: true, id: created.id });
}
