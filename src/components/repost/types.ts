export interface RepostSourceAccountSummary {
  id: string;
  platform: string;
  handle: string;
  displayName: string | null;
  profileUrl: string | null;
  avatarUrl: string | null;
  subscribed: boolean;
}

export interface RepostCampaignSummary {
  publicId: string;
  name: string;
  iconUrl: string | null;
  description: string | null;
  rulesHtml: string | null;
  accounts: RepostSourceAccountSummary[];
}

export interface RepostCampaignsResponse {
  items: RepostCampaignSummary[];
}
