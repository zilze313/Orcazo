// GET /api/admin/campaigns
// Returns all upstream campaigns joined with our visibility table so the admin
// can see which are visible / hidden.  Uses the first available employee token
// to call the upstream API (campaigns are the same for all users).

import { withAdmin, ok } from '@/lib/api';
import { fetchCampaigns } from '@/lib/affiliatenetwork/client';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withAdmin(async () => {
  // Grab any employee's credentials — campaigns are global, not user-specific.
  const sysEmployee = await db.employee.findFirst({
    select: { affiliateNetworkToken: true, affiliateNetworkCookies: true },
  });

  if (!sysEmployee) {
    return ok({ campaigns: [] });
  }

  const [campaignsResp, visibilityRows] = await Promise.all([
    fetchCampaigns(
      sysEmployee.affiliateNetworkToken,
      sysEmployee.affiliateNetworkCookies,
    ),
    db.campaignVisibility.findMany(),
  ]);

  const hiddenSet = new Set(
    visibilityRows.filter((r) => r.hidden).map((r) => r.campaignPublicId),
  );

  const campaigns = (campaignsResp.campaigns ?? [])
    .sort((a, b) => (Number(a.ordering ?? 9999)) - (Number(b.ordering ?? 9999)))
    .map((c) => ({
      publicId:  c.publicId,
      name:      c.name ?? c.publicId,
      icon:      c.icon ?? null,
      hidden:    hiddenSet.has(c.publicId),
    }));

  return ok({ campaigns });
});
