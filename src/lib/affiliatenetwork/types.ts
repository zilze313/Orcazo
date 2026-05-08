// Types reflecting AffiliateNetwork's actual responses (captured 2026-04-28).
// Keep these tight to the wire format. Do NOT leak the raw `token` field
// from `verify-code` back to the browser — that's the upstream session.

export interface AnSendCodeResp {
  success: boolean;
  successMsg?: string;
  errorMsg?: string;
}

export interface AnVerifyCodeResp {
  success: boolean;
  successMsg?: string;
  errorMsg?: string;
  user?: {
    signupStatus: string;
    token: string; // upstream session — server-only
  };
}

export interface AnUserResp {
  success: boolean;
  errorMsg?: string;
  user?: {
    publicId: string;
    token: string; // ignore on read; we already have it
    bioVerificationCode: string;
    signupStatus: string;
    personal: {
      email: string;
      firstName: string | null;
      lastName: string | null;
      phoneNumber: string | null;
      discord: string | null;
      discordVerified: boolean;
      discordAvatar: string | null;
      discordGlobalName: string | null;
      invitedBy: string | null;
    };
    banking: {
      paymentMethod: string | null;
      paymentDetails: unknown;
      legalName: string | null;
      address: string | null;
      country: string | null;
    };
    myCampaigns: string[]; // publicIds
    balance: string;       // decimal string
    paymentSuspend: boolean;
  };
}

/** Per-platform per-language rate object inside rates.details */
export interface AnPlatformLanguageRate {
  thresholdType?: string;
  threshold?: number;
  days?: number;
  base?: number;
  // Upstream sends cpm as a string (e.g. "0.2"). Allow both.
  cpm?: number | string;
  cap?: number;
}

export interface AnCampaignRates {
  range: { min: number; max: number };
  standards: {
    base: number;
    cap: number;
    thresholdType: string; // "views"
    threshold: number;
    daysCounted?: number;
  };
  platforms: string[];
  languages: string[];
  details?: Record<string, Record<string, AnPlatformLanguageRate>>;
}

export interface AnApplyMode {
  on: boolean;
  [k: string]: unknown;
}

/** A single rule entry in the rules array. */
export interface AnRuleItem {
  text: string;
  order: number;
  platforms: string[];
}

/** Example media object — we only care about `url`. */
export interface AnExample {
  url: string;
  ordering?: number;
  platform?: string[];
  [k: string]: unknown;
}

/** Application question. We render these in the detail modal. */
export interface AnApplicationQuestion {
  id: string;
  text: string;
  type: 'yes_no' | 'media_upload' | 'text' | string;
}

export interface AnCampaign {
  publicId: string;
  name: string;
  icon: string;
  ordering: number;
  favorite: boolean;
  assetLinks: string[];
  rates: AnCampaignRates;
  // Rules can be either a URL string or an array of structured rule items.
  rules?: string | AnRuleItem[];
  applyMode?: AnApplyMode;
  examples?: AnExample[];
  applicationQuestions?: AnApplicationQuestion[];
  approvalRate?: number | null;
  dateEnd?: string | null;
  inviteOnly?: boolean;
  totalBudget?: number | null;
  budgetRemaining?: number | string | null;
  themes?: unknown;
  [k: string]: unknown;
}

export interface AnCampaignsResp {
  success: boolean;
  campaigns?: AnCampaign[];
  errorMsg?: string;
}

export interface AnFavoriteCampaignResp {
  success: boolean;
  successMsg?: string;
  errorMsg?: string;
}

export interface AnApplication {
  publicId: string;
  status: 'pending' | 'approved' | 'rejected' | string;
  appliedAt: string;
  reviewedAt: string | null;
  campaign: { publicId: string; name: string; icon: string };
  social: { publicId: string; platform: string; username: string; socialProfileUrl: string };
}

export interface AnApplicationsResp {
  success: boolean;
  campaignApplications?: AnApplication[];
  errorMsg?: string;
}

export interface AnApplyResp {
  success: boolean;
  successMsg?: string;
  errorMsg?: string;
}

export interface AnAddPostResp {
  success: boolean;
  successMsg?: string;
  errorMsg?: string;
}

export interface AnDashItem {
  time_submitted: string;
  time_posted: string | null;
  campaign_name: string;
  link_submitted: string;
  link_final: string | null;
  social_profile: { url: string; username: string; platform: string };
  on_time: boolean;
  seven_days: boolean;
  views: number | null;
  base: number;
  cpm: number;
  cap: number;
  earnings: number;
  threshold: number;
  payment_platform: string | null;
  status?: string;
  [k: string]: unknown;
}

export interface AnDashResp {
  success: boolean;
  items?: AnDashItem[];
  totalCount?: number;
  totalPaid?: number;
  totalWaitingReview?: number;
  totalWaitingPayment?: number;
  errorMsg?: string;
}

export interface AnPayoutItem {
  id: string;
  createdAt: string;
  updatedAt: string;
  provider?: string;
  paymentMethod?: string;
  amountSubmitted: string | number;
  fee: string | number | null;
  amountPaid: string | number | null;
  currency: string;
  status: string;
  eventData?: unknown;
}

export interface AnPayoutsResp {
  success: boolean;
  payouts?: AnPayoutItem[];
  errorMsg?: string;
}

export interface AnSocial {
  publicId: string;
  handle: string;
  platform: string;
  theme: string;
  url: string;
  language: string;
  campaigns: unknown[];
  status?: string;
}

export interface AnSocialsResp {
  success: boolean;
  socials?: AnSocial[];
  errorMsg?: string;
}

export interface AnSocialAddInput {
  publicId: string;     // client-generated id; we use crypto.randomUUID slice
  platform: string;     // 'instagram' | 'tiktok' | 'youtube' | ...
  handle: string;
  language: string;
  theme: string;
  url: string;
  campaigns: unknown[];
  status: 'UNVERIFIED' | 'VERIFIED' | string;
}

export interface AnAddSocialResp {
  success: boolean;
  successMsg?: string;
  errorMsg?: string;
}

export interface AnDeleteSocialResp {
  success: boolean;
  successMsg?: string;
  errorMsg?: string;
}

/** Errors thrown by our client. */
export class UpstreamError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: 'UNAUTHENTICATED' | 'NETWORK' | 'TIMEOUT' | 'RATE_LIMITED' | 'BAD_RESPONSE' | 'UPSTREAM_ERROR',
    public upstreamBody?: string,
  ) {
    super(message);
    this.name = 'UpstreamError';
  }
}
