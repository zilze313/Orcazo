// POST /api/campaigns/apply
// body: { campaignPublicId, socialPublicId }
// Forwards to AffiliateNetwork's /creator/apply-to-campaign.

import { withEmployee, ok, parseBody, fail } from '@/lib/api';
import { applyToCampaign } from '@/lib/affiliatenetwork/client';
import { applyToCampaignBody } from '@/lib/validators';
import { limits } from '@/lib/ratelimit';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withEmployee(async ({ req, session }) => {
  const parsed = await parseBody(req, applyToCampaignBody);
  if ('errorResponse' in parsed) return parsed.errorResponse;

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
