// GET /api/campaigns?search=&page=&pageSize=
// Lists all campaigns from upstream (cached globally 60s — single-flight),
// joined with the employee's applications so the UI knows whether to show
// "Apply" or "Submit Post" per card.
// Every monetary value is doubled before delivery (2× display rate).
// Campaigns marked hidden in the CampaignVisibility table are excluded.

import { withEmployee, ok } from "@/lib/api";
import {
  fetchCampaigns,
  fetchApplications,
} from "@/lib/affiliatenetwork/client";
import {
  AnCampaignRates,
  AnPlatformLanguageRate,
} from "@/lib/affiliatenetwork/types";
import { limits } from "@/lib/ratelimit";
import { db } from "@/lib/db";
import { getEarningsMultiplier } from "@/lib/settings";
import { mapCustomCampaignToSummary } from "@/lib/custom-campaigns";
import { log } from "@/lib/logger";
import type { CustomCampaign, CustomCampaignApplication } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Coerce to number; upstream sometimes sends money fields as strings ("0.2"). */
function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/** Multiply every monetary field in a rates object by the configured multiplier. */
function doubleRates(
  rates: AnCampaignRates | undefined,
  M: number,
): AnCampaignRates | undefined {
  if (!rates) return rates;

  const standards = rates.standards
    ? {
        ...rates.standards,
        base: num(rates.standards.base) * M,
        cap: num(rates.standards.cap) * M,
      }
    : rates.standards;

  const range = rates.range
    ? { min: num(rates.range.min) * M, max: num(rates.range.max) * M }
    : rates.range;

  // details: Record<platform, Record<language, AnPlatformLanguageRate>>
  let details: AnCampaignRates["details"] = undefined;
  if (rates.details) {
    details = {};
    for (const [platform, langs] of Object.entries(rates.details)) {
      const bucket: Record<string, AnPlatformLanguageRate> = {};
      for (const [lang, vals] of Object.entries(langs ?? {})) {
        const v = vals as AnPlatformLanguageRate;
        bucket[lang] = {
          ...v,
          base: v.base != null ? num(v.base) * M : v.base,
          cap: v.cap != null ? num(v.cap) * M : v.cap,
          cpm: v.cpm != null ? num(v.cpm) * M : v.cpm,
        };
      }
      details[platform] = bucket;
    }
  }

  return {
    ...rates,
    ...(standards && { standards }),
    ...(range && { range }),
    ...(details && { details }),
  };
}

export const GET = withEmployee(
  async ({ req, session }) => {
    const url = new URL(req.url);
    const search = (url.searchParams.get("search") || "").trim().toLowerCase();
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const pageSize = Math.min(
      60,
      Math.max(1, parseInt(url.searchParams.get("pageSize") || "24", 10)),
    );

    const [
      campaignsResp,
      appsResp,
      customRulesRows,
      hiddenRows,
      overrideRows,
      customCampaigns,
      customApps,
      M,
    ] = await Promise.all([
      fetchCampaigns(
        session.affiliateNetworkToken,
        session.affiliateNetworkCookies,
      ),
      fetchApplications(
        session.affiliateNetworkToken,
        session.affiliateNetworkCookies,
      ),
      db.campaignRules.findMany({
        select: { campaignPublicId: true, rulesHtml: true },
      }),
      db.campaignVisibility.findMany({
        where: { hidden: true },
        select: { campaignPublicId: true },
      }),
      db.campaignOverride.findMany(),
      // Custom campaigns are an enhancement layer — if their queries fail (e.g.
      // the table is missing or the DB hiccups), degrade gracefully so the real
      // campaign feed still loads instead of failing the whole request with a 500.
      db.customCampaign
        .findMany({ where: { active: true } })
        .catch((err): CustomCampaign[] => {
          log.error("campaigns.custom_campaigns_failed", { err: String(err) });
          return [];
        }),
      db.customCampaignApplication
        .findMany({ where: { employeeId: session.employeeId } })
        .catch((err): CustomCampaignApplication[] => {
          log.error("campaigns.custom_apps_failed", { err: String(err) });
          return [];
        }),
      getEarningsMultiplier(),
    ]);

    const customRulesMap = new Map(
      customRulesRows.map((r) => [r.campaignPublicId, r.rulesHtml]),
    );
    const hiddenSet = new Set(hiddenRows.map((r) => r.campaignPublicId));
    const overrideMap = new Map(overrideRows.map((r) => [r.campaignPublicId, r]));

    let campaigns = (campaignsResp.campaigns ?? []).filter(
      (c) => !hiddenSet.has(c.publicId),
    );
    if (search)
      campaigns = campaigns.filter((c) =>
        (c.name || "").toLowerCase().includes(search),
      );
    campaigns.sort(
      (a, b) => Number(a.ordering ?? 9999) - Number(b.ordering ?? 9999),
    );

    // Pre-build custom-campaign summaries (matched to this employee's applications).
    const customAppsByCampaign = new Map<string, typeof customApps>();
    for (const a of customApps) {
      const list = customAppsByCampaign.get(a.customCampaignId) ?? [];
      list.push(a);
      customAppsByCampaign.set(a.customCampaignId, list);
    }
    let customSummaries = customCampaigns.map((cc) =>
      mapCustomCampaignToSummary(cc, customAppsByCampaign.get(cc.id) ?? []),
    );
    if (search)
      customSummaries = customSummaries.filter((c) =>
        c.name.toLowerCase().includes(search),
      );
    customSummaries.sort((a, b) => a._ordering - b._ordering);

    // Build a per-campaign application index (a creator can apply with multiple socials)
    const apps = appsResp.campaignApplications ?? [];
    const appsByCampaign = new Map<
      string,
      Array<{
        status: string;
        appliedAt: string;
        social: { publicId: string; platform: string; username: string };
      }>
    >();
    for (const a of apps) {
      const list = appsByCampaign.get(a.campaign.publicId) ?? [];
      list.push({ status: a.status, appliedAt: a.appliedAt, social: a.social });
      appsByCampaign.set(a.campaign.publicId, list);
    }

    // Real campaigns mapped to summary shape first; custom summaries concat
    // in front. Avoids a discriminated-union flatMap whose inferred type can't
    // unify the two output shapes.
    const realItems = campaigns.map((c) => {
      const ov = overrideMap.get(c.publicId);
      let rates = doubleRates(c.rates, M);

      // Apply admin rate overrides (displayCpm / displayBase / displayCap).
      // These replace the post-multiplier values so the creator sees exactly
      // what the admin entered.
      if (ov && rates?.details) {
        for (const [platform, langs] of Object.entries(rates.details)) {
          const bucket: Record<string, AnPlatformLanguageRate> = {};
          for (const [lang, vals] of Object.entries(langs ?? {})) {
            const v = vals as AnPlatformLanguageRate;
            bucket[lang] = {
              ...v,
              ...(ov.displayCpm != null && { cpm: Number(ov.displayCpm) }),
              ...(ov.displayBase != null && { base: Number(ov.displayBase) }),
              ...(ov.displayCap != null && { cap: Number(ov.displayCap) }),
            };
          }
          rates.details[platform] = bucket;
        }
      }
      if (ov && rates?.standards) {
        rates = {
          ...rates,
          standards: {
            ...rates.standards,
            ...(ov.displayBase != null && { base: Number(ov.displayBase) }),
            ...(ov.displayCap != null && { cap: Number(ov.displayCap) }),
          },
        };
      }

      return {
        publicId: c.publicId,
        name: ov?.displayName || c.name,
        icon: c.icon,
        favorite: c.favorite,
        assetLinks: c.assetLinks ?? [],
        rates,
        // Extras for detail modal + card logic
        applyMode: c.applyMode ?? null,
        // Use admin-managed rules only; never expose upstream rules (URL or array)
        rules: customRulesMap.get(c.publicId) || null,
        examples: c.examples ?? [],
        applicationQuestions: c.applicationQuestions ?? [],
        approvalRate: c.approvalRate ?? null,
        dateEnd: c.dateEnd ?? null,
        inviteOnly: c.inviteOnly ?? false,
        totalBudget: c.totalBudget != null ? num(c.totalBudget) * M : null,
        budgetRemaining:
          c.budgetRemaining != null ? num(c.budgetRemaining) * M : null,
        applications: appsByCampaign.get(c.publicId) ?? [],
      };
    });

    const customItems = customSummaries.map(
      ({ _ordering: _ignore, ...rest }) => rest,
    );
    const allItems = [...customItems, ...realItems];
    const total = allItems.length;
    const start = (page - 1) * pageSize;
    const items = allItems.slice(start, start + pageSize);

    return ok({
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  },
  { rateLimit: limits.employee },
);
