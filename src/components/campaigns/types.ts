// Lean types for the campaigns page only — server filters the heavy fields
// and applies 50% commission to monetary values before sending these.

export interface CampaignApplication {
  status: string;
  appliedAt: string;
  social: { publicId: string; platform: string; username: string };
}

export interface PlatformLanguageRate {
  thresholdType?: string;
  threshold?: number;
  days?: number;
  base?: number;
  cpm?: number | string;
  cap?: number;
}

export interface CampaignExample {
  url: string;
  ordering?: number;
  platform?: string[];
}

export interface CampaignApplicationQuestion {
  id: string;
  text: string;
  type: string;
}

export interface CampaignSummary {
  publicId: string;
  name: string;
  icon: string;
  favorite: boolean;
  assetLinks: string[];
  rates: {
    range?: { min?: number; max?: number };
    standards?: {
      base: number;
      cap: number;
      thresholdType: string;
      threshold: number;
      daysCounted?: number;
    };
    platforms?: string[];
    languages?: string[];
    details?: Record<string, Record<string, PlatformLanguageRate>>;
  };
  applyMode?: { on: boolean; [k: string]: unknown } | null;
  /** Rich-text HTML rules written by admin, or null if no custom rules set. */
  rules?: string | null;
  examples?: CampaignExample[];
  applicationQuestions?: CampaignApplicationQuestion[];
  approvalRate?: number | null;
  dateEnd?: string | null;
  inviteOnly?: boolean;
  totalBudget?: number | null;
  budgetRemaining?: number | null;
  applications: CampaignApplication[];
}

export interface CampaignsResponse {
  items: CampaignSummary[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}
