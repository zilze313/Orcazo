// GET  /api/admin/settings  → return all platform settings
// PUT  /api/admin/settings  → update one or more settings

import { withAdmin, ok, fail } from '@/lib/api';
import { getAllSettings, setSetting, KEYS } from '@/lib/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withAdmin(async () => {
  const settings = await getAllSettings();
  return ok(settings);
});

export const PUT = withAdmin(async ({ req }) => {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return fail(400, 'Invalid JSON'); }

  const updates: Array<Promise<void>> = [];

  if ('earningsMultiplier' in body) {
    const v = parseFloat(String(body.earningsMultiplier));
    if (!Number.isFinite(v) || v <= 0) return fail(400, 'earningsMultiplier must be a positive number');
    updates.push(setSetting(KEYS.EARNINGS_MULTIPLIER, String(v)));
  }
  if ('referralThreshold' in body) {
    const v = parseInt(String(body.referralThreshold), 10);
    if (!Number.isFinite(v) || v < 1) return fail(400, 'referralThreshold must be ≥ 1');
    updates.push(setSetting(KEYS.REFERRAL_THRESHOLD, String(v)));
  }
  if ('referralReward' in body) {
    const v = parseFloat(String(body.referralReward));
    if (!Number.isFinite(v) || v < 0) return fail(400, 'referralReward must be ≥ 0');
    updates.push(setSetting(KEYS.REFERRAL_REWARD, String(v)));
  }
  if ('referralQualifyEarnings' in body) {
    const v = parseFloat(String(body.referralQualifyEarnings));
    if (!Number.isFinite(v) || v < 0) return fail(400, 'referralQualifyEarnings must be ≥ 0');
    updates.push(setSetting(KEYS.REFERRAL_QUALIFY_EARNINGS, String(v)));
  }

  await Promise.all(updates);
  return ok({ ok: true });
});
