// Cloudflare Turnstile server-side verification.
// Call verifyTurnstile(token, ip) from your API route; it returns { ok, error? }.
// If TURNSTILE_SECRET_KEY isn't configured, verification is skipped (returns ok)
// so dev / pre-deploy works without it. Add the env var in Vercel to enforce.
//
// To enable in prod:
//   1. Go to https://dash.cloudflare.com → Turnstile → Add site
//   2. Get site key (public) and secret key (server-only)
//   3. Add to Vercel:
//        NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x4xxx
//        TURNSTILE_SECRET_KEY=0x4xxx
//   4. The widget on the public signup forms automatically activates.

import 'server-only';
import { log } from './logger';

const SECRET = process.env.TURNSTILE_SECRET_KEY;
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export interface TurnstileResult {
  ok: boolean;
  error?: string;
  /** Whether verification actually ran (false = skipped because secret not set). */
  enforced: boolean;
}

export async function verifyTurnstile(token: string | null | undefined, ip?: string): Promise<TurnstileResult> {
  if (!SECRET) {
    return { ok: true, enforced: false };
  }
  if (!token) {
    return { ok: false, error: 'Captcha token missing', enforced: true };
  }

  try {
    const body = new URLSearchParams();
    body.append('secret', SECRET);
    body.append('response', token);
    if (ip) body.append('remoteip', ip);

    const r = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      cache: 'no-store',
    });

    type CFResp = { success: boolean; 'error-codes'?: string[] };
    const data = (await r.json()) as CFResp;
    if (!data.success) {
      log.warn('turnstile.verify_failed', { codes: data['error-codes'] });
      return { ok: false, error: 'Captcha failed — please try again', enforced: true };
    }
    return { ok: true, enforced: true };
  } catch (err) {
    log.error('turnstile.exception', { err: String(err) });
    // On network failure to Cloudflare, fail open rather than locking everyone out.
    return { ok: true, enforced: true };
  }
}
