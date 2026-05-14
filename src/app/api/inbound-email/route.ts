// POST /api/inbound-email
//
// Called by the Cloudflare Email Worker whenever an OTP email lands at a
// creator's inbound address (e.g. alice@orcazo.com).
//
// Body (JSON):
//   { to: string, from: string, subject: string, rawEmail: string }
//
// The handler:
//   1. Verifies the shared secret.
//   2. Extracts the 4-8 digit OTP from the raw MIME email.
//   3. Looks up the Allowlist row by inboundAddress.
//   4. Stores the OTP in pendingOtp / pendingOtpAt.
//
// The creator's login page polls /api/auth/await-otp which reads this field.

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';
import { sendEmail, loginCodeEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WEBHOOK_SECRET = process.env.INBOUND_EMAIL_SECRET ?? '';

// ---------------------------------------------------------------------------
// OTP extraction
// ---------------------------------------------------------------------------

function extractOtp(rawEmail: string): string | null {
  // Primary: HTML pattern from AffiliateNetwork emails
  //   "Your verification code is:</p>\n<p ...>468875</p>"
  const htmlMatch = rawEmail.match(
    /verification code is:\s*<\/p>\s*<p[^>]*>\s*(\d{4,8})\s*<\/p>/is,
  );
  if (htmlMatch) return htmlMatch[1];

  // Secondary: plain-text / quoted-printable — code appears close to "verification code"
  const textMatch = rawEmail.match(/verification code(?:[^0-9]{0,120})(\d{4,8})/i);
  if (textMatch) return textMatch[1];

  // Tertiary: try decoding base64-encoded MIME body sections
  const b64Sections = rawEmail.match(/([A-Za-z0-9+/]{60,}={0,2})/g) ?? [];
  for (const section of b64Sections) {
    try {
      const decoded = Buffer.from(section, 'base64').toString('utf-8');
      const m =
        decoded.match(/verification code is:\s*<\/p>\s*<p[^>]*>\s*(\d{4,8})\s*<\/p>/is) ??
        decoded.match(/verification code(?:[^0-9]{0,120})(\d{4,8})/i);
      if (m) return m[1];
    } catch {
      // not valid base64 — skip
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  // Authenticate
  const secret = req.headers.get('x-webhook-secret') ?? '';
  if (!WEBHOOK_SECRET || secret !== WEBHOOK_SECRET) {
    log.warn('inbound_email.unauthorized', { hint: secret.slice(0, 4) });
    return new Response('Unauthorized', { status: 401 });
  }

  let body: { to?: string; from?: string; subject?: string; rawEmail?: string };
  try {
    body = await req.json();
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }

  const { to, rawEmail } = body;
  if (!to || !rawEmail) {
    return new Response('Missing to or rawEmail', { status: 400 });
  }

  // Extract OTP
  const otp = extractOtp(rawEmail);
  if (!otp) {
    // Look for a Gmail forwarding confirmation URL (vf- prefix = verify forwarding).
    // Search both the raw text AND any base64-encoded MIME body sections.
    const CONFIRM_RE = /https:\/\/mail\.google\.com\/mail\/vf-[^\s\r\n"<>]+/;
    let confirmUrl = rawEmail.match(CONFIRM_RE)?.[0] ?? null;

    if (!confirmUrl) {
      const b64Sections = rawEmail.match(/([A-Za-z0-9+/]{60,}={0,2})/g) ?? [];
      for (const section of b64Sections) {
        try {
          const decoded = Buffer.from(section, 'base64').toString('utf-8');
          const m = decoded.match(CONFIRM_RE);
          if (m) { confirmUrl = m[0]; break; }
        } catch { /* not valid base64 */ }
      }
    }

    log.warn('inbound_email.otp_not_found', {
      to,
      subject: body.subject?.slice(0, 80),
      ...(confirmUrl ? { gmailConfirmUrl: confirmUrl } : { bodySnippet: rawEmail.slice(0, 400) }),
    });
    // Return 200 so Cloudflare doesn't retry indefinitely
    return new Response('OK – OTP not found', { status: 200 });
  }

  // Find Allowlist row by inbound address (case-insensitive)
  const entry = await db.allowlist.findFirst({
    where: { inboundAddress: { equals: to, mode: 'insensitive' } },
    select: { id: true, email: true },
  });

  if (!entry) {
    log.warn('inbound_email.no_allowlist_match', { to });
    return new Response('OK – no match', { status: 200 });
  }

  // Store OTP (kept for admin visibility / audit)
  await db.allowlist.update({
    where: { id: entry.id },
    data: {
      pendingOtp:   otp,
      pendingOtpAt: new Date(),
    },
  });

  // Forward the code to the creator's own email under Orcazo branding
  const { subject, html } = loginCodeEmail({ code: otp });
  await sendEmail({ to: entry.email, subject, html });

  log.info('inbound_email.otp_stored', {
    publicEmail: entry.email,
    otpHint: `${otp.slice(0, 2)}****`,
  });

  return new Response('OK', { status: 200 });
}
