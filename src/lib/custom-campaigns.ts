// Helpers for "house" campaigns the admin creates locally. They live alongside
// real AffiliateNetwork campaigns in the creator feed and follow the same
// CampaignSummary shape so the existing UI doesn't know the difference.
//
// publicId is always prefixed `cc_` — that's how every API route detects them.

import 'server-only';
import type { CustomCampaign, CustomCampaignApplication } from '@prisma/client';
import { randomBytes } from 'crypto';

/** Stable prefix used to distinguish custom campaigns from upstream ones. */
export const CUSTOM_CAMPAIGN_PREFIX = 'cc_';

export function isCustomCampaignId(id: string | null | undefined): boolean {
  return !!id && id.startsWith(CUSTOM_CAMPAIGN_PREFIX);
}

/** Generate a new collision-resistant public ID. */
export function newCustomCampaignPublicId(): string {
  // 12 hex chars = 48 bits of entropy — collision risk is negligible at our scale.
  return CUSTOM_CAMPAIGN_PREFIX + randomBytes(6).toString('hex');
}

interface ExampleEntry { url: string; ordering?: number; platform?: string[] }

function safeExamples(raw: unknown): ExampleEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e): e is ExampleEntry => typeof e === 'object' && e !== null && typeof (e as ExampleEntry).url === 'string')
    .map((e) => ({ url: e.url, ordering: e.ordering, platform: e.platform }));
}

/** Decimal | string | number → number (always finite). */
function n(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (v == null) return 0;
  const parsed = parseFloat(String(v));
  return Number.isFinite(parsed) ? parsed : 0;
}

interface CustomAppShape {
  status: string;
  appliedAt: string;
  social: { publicId: string; platform: string; username: string };
}

/**
 * Convert a CustomCampaign + the calling creator's applications into the same
 * CampaignSummary shape the upstream campaigns get mapped to. This way the
 * frontend's CampaignExplorer renders both kinds identically.
 *
 * `apps` should be just this employee's applications for this campaign.
 */
export function mapCustomCampaignToSummary(
  cc: CustomCampaign,
  apps: CustomCampaignApplication[],
) {
  const rpm = n(cc.rpm);
  return {
    publicId: cc.publicId,
    name: cc.name,
    icon: cc.iconUrl ?? '',
    favorite: false,
    assetLinks: [],
    rates: {
      range: { min: rpm, max: rpm },
      standards: {
        base: n(cc.base),
        cap: n(cc.cap),
        thresholdType: cc.thresholdType,
        threshold: cc.threshold,
      },
      platforms: cc.platforms,
      languages: cc.languages,
    },
    applyMode: { on: true },
    rules: cc.rulesHtml ?? null,
    examples: safeExamples(cc.examplesJson),
    applicationQuestions: [],
    approvalRate: cc.approvalRate ?? null,
    dateEnd: cc.dateEnd?.toISOString() ?? null,
    inviteOnly: cc.inviteOnly,
    totalBudget: cc.totalBudget != null ? n(cc.totalBudget) : null,
    budgetRemaining: cc.budgetRemaining != null ? n(cc.budgetRemaining) : null,
    applications: apps.map((a) => ({
      // Map our enum back to the same lowercase strings the upstream uses
      status: a.status === 'AUTO_REJECTED' ? 'rejected' : 'pending',
      appliedAt: a.createdAt.toISOString(),
      social: {
        publicId: a.socialPublicId,
        platform: a.socialPlatform,
        username: a.socialHandle,
      },
    })),
    _ordering: cc.ordering,
  };
}
