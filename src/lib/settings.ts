// Typed getters/setters for admin-configurable platform settings.
// Backed by the AdminSetting table (key-value store).

import 'server-only';
import { db } from './db';

export const KEYS = {
  EARNINGS_MULTIPLIER:        'earningsMultiplier',
  REFERRAL_THRESHOLD:         'referralThreshold',
  REFERRAL_REWARD:            'referralReward',
  /// Minimum earnings a referred creator must accumulate before they count
  /// towards the referrer's reward threshold. Prevents smurf-account farming.
  REFERRAL_QUALIFY_EARNINGS:  'referralQualifyEarnings',
  /// Idle-proxy reclamation. Master kill switch (default off) + the earnings
  /// figure above which a creator is protected from auto-reclaim.
  PROXY_RECLAIM_ENABLED:          'proxyReclaimEnabled',
  PROXY_RECLAIM_PROTECT_EARNINGS: 'proxyReclaimProtectEarnings',
} as const;

async function getRaw(key: string): Promise<string | null> {
  const row = await db.adminSetting.findUnique({ where: { key } }).catch(() => null);
  return row?.value ?? null;
}

export async function getAllSettings() {
  const rows = await db.adminSetting.findMany().catch(() => [] as Array<{ key: string; value: string }>);
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    earningsMultiplier:      parseMultiplier(map.get(KEYS.EARNINGS_MULTIPLIER)),
    referralThreshold:       parseThreshold(map.get(KEYS.REFERRAL_THRESHOLD)),
    referralReward:          parseReward(map.get(KEYS.REFERRAL_REWARD)),
    referralQualifyEarnings: parseQualifyEarnings(map.get(KEYS.REFERRAL_QUALIFY_EARNINGS)),
    proxyReclaimEnabled:         parseBool(map.get(KEYS.PROXY_RECLAIM_ENABLED)),
    proxyReclaimProtectEarnings: parseProtectEarnings(map.get(KEYS.PROXY_RECLAIM_PROTECT_EARNINGS)),
  };
}

function parseMultiplier(v: string | undefined): number {
  if (!v) return 1;
  const n = parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n : 1;
}
function parseThreshold(v: string | undefined): number {
  if (!v) return 3;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 1 ? n : 3;
}
function parseReward(v: string | undefined): number {
  if (!v) return 100;
  const n = parseFloat(v);
  return Number.isFinite(n) && n >= 0 ? n : 100;
}
function parseQualifyEarnings(v: string | undefined): number {
  if (!v) return 100;
  const n = parseFloat(v);
  return Number.isFinite(n) && n >= 0 ? n : 100;
}
function parseBool(v: string | undefined): boolean {
  return v === '1' || v === 'true';
}
function parseProtectEarnings(v: string | undefined): number {
  if (!v) return 0;
  const n = parseFloat(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export async function getEarningsMultiplier(): Promise<number> {
  return parseMultiplier(await getRaw(KEYS.EARNINGS_MULTIPLIER) ?? undefined);
}

export async function getReferralConfig(): Promise<{ threshold: number; reward: number; qualifyEarnings: number }> {
  const [t, r, q] = await Promise.all([
    getRaw(KEYS.REFERRAL_THRESHOLD),
    getRaw(KEYS.REFERRAL_REWARD),
    getRaw(KEYS.REFERRAL_QUALIFY_EARNINGS),
  ]);
  return {
    threshold:       parseThreshold(t ?? undefined),
    reward:          parseReward(r ?? undefined),
    qualifyEarnings: parseQualifyEarnings(q ?? undefined),
  };
}

export async function getProxyReclaimConfig(): Promise<{ enabled: boolean; protectEarnings: number }> {
  const [e, p] = await Promise.all([
    getRaw(KEYS.PROXY_RECLAIM_ENABLED),
    getRaw(KEYS.PROXY_RECLAIM_PROTECT_EARNINGS),
  ]);
  return {
    enabled:         parseBool(e ?? undefined),
    protectEarnings: parseProtectEarnings(p ?? undefined),
  };
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.adminSetting.upsert({
    where:  { key },
    create: { key, value },
    update: { value },
  });
}
