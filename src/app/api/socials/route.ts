// GET /api/socials  → list connected social accounts
// POST /api/socials → add a new social account
//
// The client only sends platform + handle. We auto-generate the canonical
// profile URL server-side so the user doesn't have to type it.

import { randomUUID } from 'crypto';
import { withEmployee, ok, parseBody, fail } from '@/lib/api';
import { fetchSocials, addSocial } from '@/lib/affiliatenetwork/client';
import { addSocialBody } from '@/lib/validators';
import { limits } from '@/lib/ratelimit';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Generate a canonical profile URL from platform + handle. */
function platformUrl(platform: string, handle: string): string {
  const h = handle.replace(/^@/, '');
  switch (platform) {
    case 'instagram': return `https://www.instagram.com/${h}`;
    case 'tiktok':    return `https://www.tiktok.com/@${h}`;
    case 'youtube':   return `https://www.youtube.com/@${h}`;
    case 'snapchat':  return `https://www.snapchat.com/add/${h}`;
    case 'x':         return `https://x.com/${h}`;
    case 'facebook':  return `https://www.facebook.com/${h}`;
    default:          return `https://${platform}.com/${h}`;
  }
}

export const GET = withEmployee(async ({ session }) => {
  const [resp, employee] = await Promise.all([
    fetchSocials(session.affiliateNetworkToken, session.affiliateNetworkCookies),
    db.employee.findUnique({
      where: { id: session.employeeId },
      select: { baselineSocialIds: true, showFullHistory: true },
    }),
  ]);

  let socials = resp.socials ?? [];

  // Hide social accounts that pre-existed when this creator's proxy was connected,
  // unless the admin has enabled full-history mode for them.
  if (!employee?.showFullHistory && employee?.baselineSocialIds) {
    try {
      const baselineSet = new Set<string>(JSON.parse(employee.baselineSocialIds));
      socials = socials.filter((s: { publicId: string }) => !baselineSet.has(s.publicId));
    } catch {
      // malformed JSON — skip filter
    }
  }

  return ok({ socials });
}, { rateLimit: limits.employee });

export const POST = withEmployee(async ({ req, session }) => {
  const parsed = await parseBody(req, addSocialBody);
  if ('errorResponse' in parsed) return parsed.errorResponse;

  // Upstream expects a publicId on the input — looks client-generated. Match the
  // captured shape: 8-char alphanumeric.
  const publicId = randomUUID().replace(/-/g, '').slice(0, 8);
  const url = platformUrl(parsed.data.platform, parsed.data.handle);

  const resp = await addSocial(
    session.affiliateNetworkToken,
    {
      publicId,
      platform: parsed.data.platform,
      handle: parsed.data.handle,
      language: parsed.data.language ?? 'English',
      theme: parsed.data.theme,
      url,
      campaigns: [],
      status: 'UNVERIFIED',
    },
    session.affiliateNetworkCookies,
  );

  if (!resp.success) {
    return fail(400, resp.errorMsg || 'Could not add social account', 'UPSTREAM_REJECTED');
  }
  return ok({ ok: true, message: resp.successMsg ?? 'Added' });
}, { rateLimit: limits.employee });
