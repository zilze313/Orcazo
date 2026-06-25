// POST /api/campaigns/apply
// body: { campaignPublicId, socialPublicId }
//
// If campaignPublicId starts with `cc_` it's a local "house" campaign —
// we record a CustomCampaignApplication in PENDING and the daily cron
// auto-rejects it after the campaign's configured delay.
//
// Otherwise we forward to AffiliateNetwork's /creator/apply-to-campaign as before.

import { withEmployee, ok, parseBody, fail } from '@/lib/api';
import { applyToCampaign, fetchSocials } from '@/lib/affiliatenetwork/client';
import { applyToCampaignBody } from '@/lib/validators';
import { limits } from '@/lib/ratelimit';
import { log } from '@/lib/logger';
import { db } from '@/lib/db';
import { isCustomCampaignId } from '@/lib/custom-campaigns';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withEmployee(async ({ req, session }) => {
  const parsed = await parseBody(req, applyToCampaignBody);
  if ('errorResponse' in parsed) return parsed.errorResponse;

  // ── House (custom) campaign branch ────────────────────────────────────────
  if (isCustomCampaignId(parsed.data.campaignPublicId)) {
    const cc = await db.customCampaign.findUnique({
      where: { publicId: parsed.data.campaignPublicId },
      select: { id: true, active: true, platforms: true },
    });
    if (!cc) return fail(404, 'Campaign not found', 'NOT_FOUND');
    if (!cc.active) return fail(400, 'Campaign is not accepting applications', 'INACTIVE');

    // Resolve the social so we can capture platform + handle (used in the
    // auto-rejection email + admin views).
    const socialsResp = await fetchSocials(
      session.affiliateNetworkToken,
      session.affiliateNetworkCookies,
    );
    const social = (socialsResp.socials ?? []).find(
      (s) => s.publicId === parsed.data.socialPublicId,
    );
    if (!social) return fail(400, 'Social account not found', 'NO_SOCIAL');

    // Block applying with a platform that isn't allowed (matches upstream UX).
    if (cc.platforms.length > 0 && !cc.platforms.includes(social.platform)) {
      return fail(400, "This campaign doesn't accept that platform", 'BAD_PLATFORM');
    }

    try {
      await db.customCampaignApplication.create({
        data: {
          customCampaignId: cc.id,
          employeeId: session.employeeId,
          socialPublicId: social.publicId,
          socialPlatform: social.platform,
          socialHandle: social.handle ?? '',
        },
      });
    } catch (err: unknown) {
      // P2002 = unique constraint (already applied with this social)
      if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === 'P2002') {
        return fail(409, 'You have already applied to this campaign with this account', 'ALREADY_APPLIED');
      }
      throw err;
    }

    return ok({ ok: true, message: 'Application submitted — most brands respond within 1-2 days.' });
  }

  // ── Real upstream campaign branch ─────────────────────────────────────────
  const resp = await applyToCampaign(
    session.affiliateNetworkToken,
    parsed.data.campaignPublicId,
    parsed.data.socialPublicId,
    session.affiliateNetworkCookies,
  );

  if (!resp.success) {
    log.warn('campaigns.apply_rejected', { employeeId: session.employeeId, ...parsed.data, errorMsg: resp.errorMsg });
    return fail(400, resp.errorMsg || 'Could not apply to this campaign', 'UPSTREAM_REJECTED');
  }

  return ok({ ok: true, message: resp.successMsg ?? 'Applied' });
}, { rateLimit: limits.employee });
