// Typed client for api.affiliatenetwork.com.
// All public functions are server-side only — never import this from a "use client" component.
//
// IMPORTANT: AffiliateNetwork's auth model is non-standard. Some endpoints
// (notably /creator/fetch-user) ignore the `token` field in the payload and
// rely on the session cookie set by /verify-code. So we capture cookies on
// login and forward them on cookie-dependent endpoints. Other endpoints
// (fetch-socials, fetch-campaigns, apply-to-campaign, etc.) do honor
// token-in-payload — we still forward cookies on those for safety.

import "server-only";
import { createHash } from "crypto";
import { log } from "../logger";
import { memo, invalidatePrefix } from "../cache";
import {
  AnAddPostResp,
  AnAddSocialResp,
  AnApplicationsResp,
  AnApplyResp,
  AnCampaignsResp,
  AnDashResp,
  AnDeleteSocialResp,
  AnFavoriteCampaignResp,
  AnPayoutsResp,
  AnSendCodeResp,
  AnSocialAddInput,
  AnSocialsResp,
  AnUserResp,
  AnVerifyCodeResp,
  UpstreamError,
} from "./types";

const BASE =
  process.env.AFFILIATENETWORK_BASE_URL || "https://api.affiliatenetwork.com";
const TIMEOUT = parseInt(
  process.env.AFFILIATENETWORK_TIMEOUT_MS || "15000",
  10,
);

/**
 * Convert an array of Set-Cookie response headers into a Cookie request header
 * value. Strips attributes (Path, Expires, HttpOnly, etc.), keeps only name=value.
 */
function setCookiesToCookieHeader(setCookies: string[]): string {
  return setCookies
    .map((c) => c.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");
}

/** Pull Set-Cookie headers from a Response — handles both modern and legacy APIs. */
function extractSetCookies(headers: Headers): string[] {
  // Node 19.7+, undici 5.21+ — preferred (single Set-Cookie header per cookie)
  type WithGetSetCookie = Headers & { getSetCookie?: () => string[] };
  const h = headers as WithGetSetCookie;
  if (typeof h.getSetCookie === "function") {
    return h.getSetCookie();
  }
  // Fallback: comma-joined string. Splits on comma followed by a valid cookie name.
  const raw = headers.get("set-cookie");
  if (!raw) return [];
  return raw.split(/,(?=\s*[a-zA-Z0-9_!#$%&'*+\-.^`|~]+=)/);
}

/**
 * Low-level fetch wrapper. Adds timeout, JSON encoding, error normalization,
 * cookie passthrough, and a small retry-on-transient-failure (network / timeout
 * / 5xx) since AffiliateNetwork has occasional brief blips. Idempotent
 * endpoints retry safely; we limit to GET + the few read-only POST endpoints
 * (which is the majority of calls).
 */
async function call<T>(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown; cookies?: string | null; retries?: number },
): Promise<{ data: T; status: number; setCookies: string[] }> {
  const url = `${BASE}${path}`;
  const maxAttempts = (init.retries ?? 1) + 1;

  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), TIMEOUT);

    let resp: Response;
    try {
      const reqHeaders: Record<string, string> = {
        Accept: "application/json, text/plain, */*",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.cookies ? { Cookie: init.cookies } : {}),
      };

      resp = await fetch(url, {
        method: init.method,
        headers: reqHeaders,
        body: init.body ? JSON.stringify(init.body) : undefined,
        signal: ac.signal,
        cache: "no-store",
      });
    } catch (err: unknown) {
      clearTimeout(timer);
      lastErr = err;
      const isAbort = err instanceof Error && err.name === "AbortError";
      const code: "TIMEOUT" | "NETWORK" = isAbort ? "TIMEOUT" : "NETWORK";

      if (attempt < maxAttempts) {
        // Backoff: 250ms, 750ms, 1500ms
        await new Promise((r) => setTimeout(r, 250 * attempt * attempt));
        continue;
      }
      log.warn("upstream.network_failure", { url, err: String(err), attempts: attempt });
      throw new UpstreamError(
        isAbort ? "Upstream timeout" : "Network error talking to upstream",
        0,
        code,
      );
    }
    clearTimeout(timer);

    return await processResponse<T>(url, resp);
  }
  // Unreachable in practice — loop above always returns or throws
  throw new UpstreamError("Unreachable", 0, "NETWORK");
}

async function processResponse<T>(
  url: string,
  resp: Response,
): Promise<{ data: T; status: number; setCookies: string[] }> {

  const setCookies = extractSetCookies(resp.headers);

  const text = await resp.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    log.error("upstream.bad_json", {
      url,
      status: resp.status,
      snippet: text.slice(0, 300),
    });
    throw new UpstreamError(
      "Upstream returned non-JSON",
      resp.status,
      "BAD_RESPONSE",
      text,
    );
  }

  // Token-based auth: AffiliateNetwork returns 200 with success:false for "Please Login".
  const looksLikeAuth =
    typeof data === "object" &&
    data !== null &&
    (data as { success?: boolean; errorMsg?: string }).success === false &&
    /please.?log.?in/i.test((data as { errorMsg?: string }).errorMsg || "");

  if (looksLikeAuth) {
    throw new UpstreamError(
      "Upstream session expired",
      401,
      "UNAUTHENTICATED",
      text,
    );
  }

  if (resp.status === 429) {
    throw new UpstreamError("Upstream rate limited", 429, "RATE_LIMITED", text);
  }

  if (resp.status >= 500) {
    log.error("upstream.5xx", { url, status: resp.status });
    throw new UpstreamError(
      "Upstream server error",
      resp.status,
      "UPSTREAM_ERROR",
      text,
    );
  }

  return { data: data as T, status: resp.status, setCookies };
}

// =============================================================
// Auth (no token, no prior cookies)
// =============================================================

export async function sendLoginCode(email: string): Promise<AnSendCodeResp> {
  const { data } = await call<AnSendCodeResp>("/creator/auth/send-code", {
    method: "POST",
    body: { token: null, email },
  });
  return data;
}

/**
 * Verify the OTP code and capture both the upstream token AND any cookies
 * AffiliateNetwork sets. The cookies are required to authenticate /fetch-user
 * (which ignores the token field in payload).
 */
export async function verifyLoginCode(
  email: string,
  code: string,
): Promise<{ data: AnVerifyCodeResp; cookies: string }> {
  const { data, setCookies } = await call<AnVerifyCodeResp>(
    "/creator/auth/verify-code",
    {
      method: "POST",
      body: { email, code, token: null },
    },
  );
  return { data, cookies: setCookiesToCookieHeader(setCookies) };
}

// =============================================================
// Authenticated. All take token + (where useful) cookies.
// Cached endpoints use memo(); mutations call invalidate*() afterwards.
// =============================================================

const TTL_USER = 30_000; // 30s per-user
const TTL_CAMPAIGNS = 60_000; // 60s GLOBAL — same for everyone
const TTL_SOCIALS = 30_000; // 30s per-user
const TTL_APPLICATIONS = 15_000; // 15s per-user

/** Short hash of a cookie string — used to invalidate cache when cookies change. */
function cookieKey(cookies: string | null | undefined): string {
  if (!cookies) return "nocookie";
  return createHash("sha1").update(cookies).digest("hex").slice(0, 10);
}

/**
 * Fetch the current user's profile. **Cookie-authenticated** — pass the cookies
 * captured during verify-code. Without them, AffiliateNetwork returns the
 * empty `{ user: { token: "" } }` shape.
 */
export async function fetchUser(
  token: string,
  cookies?: string | null,
  opts?: { bypass?: boolean },
): Promise<AnUserResp> {
  // Include cookie hash in cache key so a fresh cookie set bypasses the stale entry.
  return memo(
    `user:${token}:${cookieKey(cookies)}`,
    { ttl: TTL_USER, bypass: opts?.bypass },
    async () => {
      const { data } = await call<AnUserResp>("/creator/fetch-user", {
        method: "POST",
        body: { token },
        cookies: cookies ?? undefined,
        retries: 1,
      });
      return data;
    },
  );
}

export async function fetchCampaigns(
  token: string,
  cookies?: string | null,
  opts?: { bypass?: boolean },
): Promise<AnCampaignsResp> {
  return memo(
    `campaigns:global`,
    { ttl: TTL_CAMPAIGNS, bypass: opts?.bypass },
    async () => {
      const { data } = await call<AnCampaignsResp>("/creator/fetch-campaigns", {
        method: "POST",
        body: { token },
        cookies: cookies ?? undefined,
        retries: 1,
      });
      return data;
    },
  );
}

export async function fetchApplications(
  token: string,
  cookies?: string | null,
  opts?: { bypass?: boolean },
): Promise<AnApplicationsResp> {
  return memo(
    `apps:${token}`,
    { ttl: TTL_APPLICATIONS, bypass: opts?.bypass },
    async () => {
      const { data } = await call<AnApplicationsResp>(
        "/creator/fetch-creator-campaign-applications",
        {
          method: "POST",
          body: { token },
          cookies: cookies ?? undefined,
          retries: 1,
        },
      );
      return data;
    },
  );
}

export async function applyToCampaign(
  token: string,
  campaignPublicId: string,
  socialPublicId: string,
  cookies?: string | null,
): Promise<AnApplyResp> {
  const { data } = await call<AnApplyResp>("/creator/apply-to-campaign", {
    method: "POST",
    body: { token, campaignPublicId, socialPublicId },
    cookies: cookies ?? undefined,
  });
  invalidatePrefix(`apps:${token}`);
  return data;
}

export async function addPost(
  token: string,
  campaignName: string,
  campaignPublicId: string,
  linkSubmitted: string,
  creatorTimezone: string,
  cookies?: string | null,
): Promise<AnAddPostResp> {
  const { data } = await call<AnAddPostResp>("/creator/add-post", {
    method: "POST",
    body: {
      token,
      campaignName,
      campaignPublicId,
      linkSubmitted,
      creatorTimezone,
    },
    cookies: cookies ?? undefined,
  });
  invalidatePrefix(`dash:${token}`);
  return data;
}

export async function fetchDash(
  token: string,
  filters: { status: string; campaignName: string; onlySevenDays: boolean },
  cookies?: string | null,
  opts?: { bypass?: boolean },
): Promise<AnDashResp> {
  const ttl = opts?.bypass ? 0 : 5_000;
  return memo(
    `dash:${token}:${filters.status}:${filters.campaignName}:${filters.onlySevenDays}`,
    { ttl, bypass: opts?.bypass },
    async () => {
      const { data } = await call<AnDashResp>("/creator/fetch-dash", {
        method: "POST",
        body: { token, ...filters },
        cookies: cookies ?? undefined,
        retries: 1,
      });
      return data;
    },
  );
}

export async function fetchSocials(
  token: string,
  cookies?: string | null,
  opts?: { bypass?: boolean },
): Promise<AnSocialsResp> {
  return memo(
    `socials:${token}`,
    { ttl: TTL_SOCIALS, bypass: opts?.bypass },
    async () => {
      const { data } = await call<AnSocialsResp>("/creator/fetch-socials", {
        method: "POST",
        body: { token },
        cookies: cookies ?? undefined,
        retries: 1,
      });
      return data;
    },
  );
}

export async function addSocial(
  token: string,
  profile: AnSocialAddInput,
  cookies?: string | null,
): Promise<AnAddSocialResp> {
  const { data } = await call<AnAddSocialResp>("/creator/add-social", {
    method: "POST",
    body: { token, socialProfiles: [profile] },
    cookies: cookies ?? undefined,
  });
  invalidatePrefix(`socials:${token}`);
  return data;
}

export async function deleteSocial(
  token: string,
  publicId: string,
  cookies?: string | null,
): Promise<AnDeleteSocialResp> {
  const { data } = await call<AnDeleteSocialResp>("/creator/delete-social", {
    method: "POST",
    body: { token, publicId },
    cookies: cookies ?? undefined,
  });
  invalidatePrefix(`socials:${token}`);
  return data;
}

export async function favoriteCampaign(
  token: string,
  campaignPublicId: string,
  favorite: boolean,
  cookies?: string | null,
): Promise<AnFavoriteCampaignResp> {
  const { data } = await call<AnFavoriteCampaignResp>(
    "/creator/fave-campaign",
    {
      method: "POST",
      body: { token, campaignPublicId, favorite },
      cookies: cookies ?? undefined,
    },
  );
  invalidatePrefix("campaigns:global");
  return data;
}

/** Payout history. Authenticated by token; cookies forwarded for safety. */
export async function fetchPayouts(
  token: string,
  cookies?: string | null,
): Promise<AnPayoutsResp> {
  const { data } = await call<AnPayoutsResp>("/creator/payouts/payouts", {
    method: "POST",
    body: { token },
    cookies: cookies ?? undefined,
    retries: 1,
  });
  return data;
}

/** Bust every cache entry for a user — used on logout. */
export function invalidateForToken(token: string) {
  invalidatePrefix(`user:${token}`);
  invalidatePrefix(`socials:${token}`);
  invalidatePrefix(`apps:${token}`);
  invalidatePrefix(`dash:${token}`);
}
