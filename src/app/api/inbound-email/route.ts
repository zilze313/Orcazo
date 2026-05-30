// POST /api/inbound-email
//
// Called by the Cloudflare Email Worker whenever an email lands at a creator's
// inbound address (e.g. alice@orcazo.com).
//
// Body (JSON):
//   { to: string, from: string, subject: string, rawEmail: string }
//
// The handler:
//   1. Verifies the shared secret.
//   2. Extracts the 4-8 digit OTP from the raw MIME email.
//   3. On success: looks up the Allowlist row, stores a debug copy of the OTP,
//      and sends a freshly-branded copy to the creator via Resend.
//   4. On failure: persists an InboundMailEvent so the admin can review it in
//      the admin panel (Gmail forwarding-confirmation links land here).
//
// InboundMailEvent rows older than 30 days are purged on each call.

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { log } from '@/lib/logger';
import { sendEmail, loginCodeEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WEBHOOK_SECRET = process.env.INBOUND_EMAIL_SECRET ?? '';
const RETENTION_DAYS = 30;

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
// Helpers for surfacing non-OTP emails to the admin
// ---------------------------------------------------------------------------

const GMAIL_CONFIRM_RE = /https:\/\/mail\.google\.com\/mail\/vf-[^\s\r\n"<>]+/;

/**
 * Look for a Gmail forwarding-confirmation URL anywhere in the email —
 * including inside base64-encoded MIME body sections.
 */
function extractGmailConfirmUrl(rawEmail: string): string | null {
  const direct = rawEmail.match(GMAIL_CONFIRM_RE);
  if (direct) return direct[0];

  const b64Sections = rawEmail.match(/([A-Za-z0-9+/]{60,}={0,2})/g) ?? [];
  for (const section of b64Sections) {
    try {
      const decoded = Buffer.from(section, 'base64').toString('utf-8');
      const m = decoded.match(GMAIL_CONFIRM_RE);
      if (m) return m[0];
    } catch { /* skip */ }
  }
  return null;
}

/** Decode quoted-printable encoding (=XX hex + =\n soft breaks). */
function decodeQuotedPrintable(s: string): string {
  return s
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Best-effort readable preview of the email body. Tries plain text first,
 * falls back to decoded+stripped HTML, then to the raw email tail.
 * Returns at most ~1500 chars.
 */
function extractReadableBody(rawEmail: string): string {
  // 1. text/plain MIME section
  const plain = rawEmail.match(
    /Content-Type:\s*text\/plain[^\n]*\r?\n(?:[A-Za-z-]+:[^\n]*\r?\n)*\r?\n([\s\S]*?)(?:\r?\n--|$)/i,
  );
  if (plain) {
    const decoded = /quoted-printable/i.test(rawEmail) ? decodeQuotedPrintable(plain[1]) : plain[1];
    const cleaned = decoded.replace(/\r/g, '').trim();
    if (cleaned.length > 20) return cleaned.slice(0, 1500);
  }

  // 2. base64 HTML section, strip tags
  const b64Sections = rawEmail.match(/([A-Za-z0-9+/]{60,}={0,2})/g) ?? [];
  for (const section of b64Sections) {
    try {
      const decoded = Buffer.from(section, 'base64').toString('utf-8');
      if (decoded.includes('<') && decoded.length > 100) {
        const text = decoded
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/\s+/g, ' ')
          .trim();
        if (text.length > 50) return text.slice(0, 1500);
      }
    } catch { /* skip */ }
  }

  // 3. Fallback to raw after headers
  const headersEnd = rawEmail.indexOf('\n\n');
  const body = headersEnd > -1 ? rawEmail.slice(headersEnd + 2) : rawEmail;
  return body.slice(0, 1500).trim();
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

  const { to, from, subject, rawEmail } = body;
  if (!to || !rawEmail) {
    return new Response('Missing to or rawEmail', { status: 400 });
  }

  // Best-effort purge of stale events (fire-and-forget; cheap, indexed).
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  db.inboundMailEvent
    .deleteMany({ where: { createdAt: { lt: cutoff } } })
    .catch((err) => log.warn('inbound_email.purge_failed', { err: String(err) }));

  // Extract OTP
  const otp = extractOtp(rawEmail);
  if (!otp) {
    // Couldn't find an OTP — surface this to the admin so they can act on
    // confirmation links / unusual messages.
    const confirmUrl  = extractGmailConfirmUrl(rawEmail);
    const bodySnippet = extractReadableBody(rawEmail);

    await db.inboundMailEvent
      .create({
        data: {
          to,
          fromAddress: from ?? null,
          subject:     subject ?? null,
          confirmUrl,
          bodySnippet,
        },
      })
      .catch((err) => log.warn('inbound_email.event_create_failed', { err: String(err) }));

    log.warn('inbound_email.otp_not_found', {
      to,
      subject: subject?.slice(0, 80),
      hasConfirmUrl: !!confirmUrl,
    });
    return new Response('OK – stored for admin review', { status: 200 });
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
  const tpl = loginCodeEmail({ code: otp });
  await sendEmail({ to: entry.email, subject: tpl.subject, html: tpl.html });

  log.info('inbound_email.otp_stored', {
    publicEmail: entry.email,
    otpHint: `${otp.slice(0, 2)}****`,
  });

  return new Response('OK', { status: 200 });
}
