// POST /api/posts
// Submit a video link to a campaign.
//   - Forwards to AffiliateNetwork /creator/add-post
//   - Writes a SubmissionAudit row (success or failure) so admin can paginate quickly
//   - Tighter rate limit than other authed routes

import { db } from '@/lib/db';
import { withEmployee, ok, parseBody, fail } from '@/lib/api';
import { addPost } from '@/lib/affiliatenetwork/client';
import { submitPostBody } from '@/lib/validators';
import { limits } from '@/lib/ratelimit';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = withEmployee(async ({ req, session }) => {
  const parsed = await parseBody(req, submitPostBody);
  if ('errorResponse' in parsed) return parsed.errorResponse;

  const tz = parsed.data.creatorTimezone || 'UTC';

  let upstream;
  try {
    upstream = await addPost(
      session.affiliateNetworkToken,
      parsed.data.campaignName,
      parsed.data.campaignPublicId,
      parsed.data.linkSubmitted,
      tz,
      session.affiliateNetworkCookies,
    );
  } catch (err) {
    // Audit even network failures so admin sees retries
    await db.submissionAudit.create({
      data: {
        employeeId: session.employeeId,
        campaignPublicId: parsed.data.campaignPublicId,
        campaignName: parsed.data.campaignName,
        linkSubmitted: parsed.data.linkSubmitted,
        upstreamStatus: 0,
        upstreamSuccess: false,
        upstreamMessage: String(err).slice(0, 500),
      },
    }).catch(() => {});
    throw err; // let withEmployee map it
  }

  // Audit
  await db.submissionAudit.create({
    data: {
      employeeId: session.employeeId,
      campaignPublicId: parsed.data.campaignPublicId,
      campaignName: parsed.data.campaignName,
      linkSubmitted: parsed.data.linkSubmitted,
      upstreamStatus: upstream.success ? 200 : 400,
      upstreamSuccess: !!upstream.success,
      upstreamMessage: (upstream.successMsg || upstream.errorMsg || '').slice(0, 500),
    },
  }).catch((err) => log.warn('audit.write_failed', { err: String(err) }));

  if (!upstream.success) {
    return fail(400, upstream.errorMsg || 'Submission rejected', 'UPSTREAM_REJECTED');
  }

  return ok({ ok: true, message: upstream.successMsg ?? 'Submitted' });
}, { rateLimit: limits.submitPost });
