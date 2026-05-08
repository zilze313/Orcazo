// GET /api/campaigns?search=&page=&pageSize=
// Lists all campaigns from upstream (cached globally 60s — single-flight),
// joined with the employee's applications so the UI knows whether to show
// "Apply" or "Submit Post" per card.
// Every monetary value is doubled before delivery (2× display rate).
// Campaigns marked hidden in the CampaignVisibility table are excluded.

import { withEmployee, ok } from '@/lib/api';
import { fetchCampaigns, fetchApplications } from '@/lib/affiliatenetwork/client';
import {
  AnCampaignRates, AnPlatformLanguageRate,
} from '@/lib/affiliatenetwork/types';
import { limits } from '@/lib/ratelimit';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Coerce to number; upstream sometimes sends money fields as strings ("0.2"). */
function num(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/** Double every monetary field in a rates object (2× display rate). */
function doubleRates(rates: AnCampaignRates | undefined): AnCampaignRates | undefined {
  if (!rates) return rates;

  const standards = rates.standards
    ? {
        ...rates.standards,
        base: num(rates.standards.base) * 2,
        cap:  num(rates.standards.cap)  * 2,
      }
    : rates.standards;

  const range = rates.range
    ? { min: num(rates.range.min) * 2, max: num(rates.range.max) * 2 }
    : rates.range;

  // details: Record<platform, Record<language, AnPlatformLanguageRate>>
  let details: AnCampaignRates['details'] = undefined;
  if (rates.details) {
    details = {};
    for (const [platform, langs] of Object.entries(rates.details)) {
      const bucket: Record<string, AnPlatformLanguageRate> = {};
      for (const [lang, vals] of Object.entries(langs ?? {})) {
        const v = vals as AnPlatformLanguageRate;
        bucket[lang] = {
          ...v,
          base: v.base != null ? num(v.base) * 2 : v.base,
          cap:  v.cap  != null ? num(v.cap)  * 2 : v.cap,
          cpm:  v.cpm  != null ? num(v.cpm)  * 2 : v.cpm,
        };
      }
      details[platform] = bucket;
    }
  }

  return {
    ...rates,
    ...(standards && { standards }),
    ...(range     && { range }),
    ...(details   && { details }),
  };
}

export const GET = withEmployee(async ({ req, session }) => {
  const url = new URL(req.url);
  const search = (url.searchParams.get('search') || '').trim().toLowerCase();
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const pageSize = Math.min(60, Math.max(1, parseInt(url.searchParams.get('pageSize') || '24', 10)));

  const [campaignsResp, appsResp, customRulesRows, hiddenRows] = await Promise.all([
    fetchCampaigns(session.affiliateNetworkToken, session.affiliateNetworkCookies),
    fetchApplications(session.affiliateNetworkToken, session.affiliateNetworkCookies),
    db.campaignRules.findMany({ select: { campaignPublicId: true, rulesHtml: true } }),
    db.campaignVisibility.findMany({ where: { hidden: true }, select: { campaignPublicId: true } }),
  ]);

  const customRulesMap = new Map(customRulesRows.map((r) => [r.campaignPublicId, r.rulesHtml]));
  const hiddenSet = new Set(hiddenRows.map((r) => r.campaignPublicId));

  let campaigns = (campaignsResp.campaigns ?? []).filter((c) => !hiddenSet.has(c.publicId));
  if (search) campaigns = campaigns.filter((c) => (c.name || '').toLowerCase().includes(search));
  campaigns.sort((a, b) => (Number(a.ordering ?? 9999)) - (Number(b.ordering ?? 9999)));

  // Build a per-campaign application index (a creator can apply with multiple socials)
  const apps = appsResp.campaignApplications ?? [];
  const appsByCampaign = new Map<string, Array<{ status: string; appliedAt: string; social: { publicId: string; platform: string; username: string } }>>();
  for (const a of apps) {
    const list = appsByCampaign.get(a.campaign.publicId) ?? [];
    list.push({ status: a.status, appliedAt: a.appliedAt, social: a.social });
    appsByCampaign.set(a.campaign.publicId, list);
  }

  const total = campaigns.length;
  const start = (page - 1) * pageSize;
  const slice = campaigns.slice(start, start + pageSize);

  const items = slice.map((c) => ({
    publicId: c.publicId,
    name: c.name,
    icon: c.icon,
    favorite: c.favorite,
    assetLinks: c.assetLinks ?? [],
    rates: doubleRates(c.rates),
    // Extras for detail modal + card logic
    applyMode: c.applyMode ?? null,
    // Use admin-managed rules only; never expose upstream rules (URL or array)
    rules: customRulesMap.get(c.publicId) || null,
    examples: c.examples ?? [],
    applicationQuestions: c.applicationQuestions ?? [],
    approvalRate: c.approvalRate ?? null,
    dateEnd: c.dateEnd ?? null,
    inviteOnly: c.inviteOnly ?? false,
    totalBudget:     c.totalBudget != null ? num(c.totalBudget) * 2 : null,
    budgetRemaining: c.budgetRemaining != null ? num(c.budgetRemaining) * 2 : null,
    applications: appsByCampaign.get(c.publicId) ?? [],
  }));

  return ok({
    items,
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  });
}, { rateLimit: limits.employee });
