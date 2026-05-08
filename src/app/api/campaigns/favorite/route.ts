// POST /api/campaigns/favorite
// Toggles the favorite state for a campaign via upstream /creator/fave-campaign.

import { z } from 'zod';
import { withEmployee, ok, parseBody, fail } from '@/lib/api';
import { favoriteCampaign } from '@/lib/affiliatenetwork/client';
import { limits } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const body = z.object({
  campaignPublicId: z.string().min(1).max(64),
  favorite: z.boolean(),
});

export const POST = withEmployee(async ({ req, session }) => {
  const parsed = await parseBody(req, body);
  if ('errorResponse' in parsed) return parsed.errorResponse;

  const resp = await favoriteCampaign(
    session.affiliateNetworkToken,
    parsed.data.campaignPublicId,
    parsed.data.favorite,
    session.affiliateNetworkCookies,
  );

  if (!resp.success) {
    return fail(400, resp.errorMsg || 'Could not update favorite', 'UPSTREAM_REJECTED');
  }
  return ok({ ok: true });
}, { rateLimit: limits.employee });
