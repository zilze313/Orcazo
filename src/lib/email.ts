// Email sending via Resend.
// Graceful degradation: if RESEND_API_KEY is not set (dev / not yet configured),
// we log to console and return success — the app continues to work without emails.
//
// To enable real sending in prod:
//   1. Sign up at https://resend.com (free tier: 3k emails/month)
//   2. Verify your domain (or use the onboarding `onboarding@resend.dev`)
//   3. Add to Vercel env vars:
//        RESEND_API_KEY=re_xxx
//        EMAIL_FROM=Orcazo <noreply@orcazo.com>

import 'server-only';
import { Resend } from 'resend';
import { log } from './logger';

const apiKey = process.env.RESEND_API_KEY;
const FROM   = process.env.EMAIL_FROM || 'Orcazo <onboarding@resend.dev>';

let client: Resend | null = null;
if (apiKey) {
  client = new Resend(apiKey);
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  /** Plain-text fallback. If omitted, generated from html. */
  text?: string;
  /** Optional reply-to address. */
  replyTo?: string;
}

export interface SendEmailResult {
  ok: boolean;
  id?: string;
  error?: string;
  /** Whether the email was actually sent (true) or just logged because Resend isn't configured (false). */
  delivered: boolean;
}

/**
 * Send an email. Always returns successfully if Resend is unconfigured (so the
 * caller doesn't crash); the `delivered` flag tells you what actually happened.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const { to, subject, html, text, replyTo } = input;

  if (!client) {
    log.info('email.skipped_no_resend', { to, subject });
    return { ok: true, delivered: false };
  }

  try {
    const { data, error } = await client.emails.send({
      from: FROM,
      to,
      subject,
      html,
      text: text ?? stripHtml(html),
      ...(replyTo ? { replyTo } : {}),
    });

    if (error) {
      log.error('email.resend_error', { to, subject, error: error.message });
      return { ok: false, error: error.message, delivered: false };
    }

    log.info('email.sent', { to, subject, id: data?.id });
    return { ok: true, id: data?.id, delivered: true };
  } catch (err) {
    log.error('email.exception', { to, subject, err: String(err) });
    return { ok: false, error: String(err), delivered: false };
  }
}

/** Lazy plain-text fallback. Strips tags + collapses whitespace. */
function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<\/?[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// =============================================================
// Templates — keep simple inline HTML so we don't pull in MJML.
// =============================================================

export function creatorRejectionEmail(opts: { fullName: string; reason?: string }): { subject: string; html: string } {
  const { fullName, reason } = opts;
  return {
    subject: 'Update on your Orcazo application',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #111;">
        <div style="text-align:center; margin-bottom: 24px;">
          <div style="display:inline-block; padding: 8px 14px; border-radius: 6px; background: #111; color: #fff; font-weight: 600; letter-spacing: 0.04em;">Orcazo</div>
        </div>
        <h1 style="font-size: 20px; margin: 0 0 16px;">Hi ${escapeHtml(fullName)},</h1>
        <p style="font-size: 14px; line-height: 1.6; margin: 0 0 12px;">
          Thank you for applying to join Orcazo as a creator. After reviewing your application,
          we're unable to approve your account at this time.
        </p>
        ${reason ? `
        <div style="background: #f5f5f5; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <div style="font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px;">Reason</div>
          <div style="font-size: 14px; line-height: 1.5;">${escapeHtml(reason)}</div>
        </div>` : ''}
        <p style="font-size: 14px; line-height: 1.6; margin: 16px 0;">
          You're welcome to reapply in the future as your accounts grow. We wish you the best of luck with your content.
        </p>
        <p style="font-size: 14px; color: #666; line-height: 1.6; margin: 24px 0 0;">— The Orcazo team</p>
      </div>
    `.trim(),
  };
}

export function loginCodeEmail(opts: { code: string }): { subject: string; html: string } {
  return {
    subject: 'Your Orcazo login code',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #111;">
        <div style="text-align:center; margin-bottom: 24px;">
          <div style="display:inline-block; padding: 8px 14px; border-radius: 6px; background: #111; color: #fff; font-weight: 600; letter-spacing: 0.04em;">Orcazo</div>
        </div>
        <h1 style="font-size: 20px; margin: 0 0 8px; text-align:center;">Your login code</h1>
        <p style="font-size: 14px; line-height: 1.6; margin: 0 0 24px; color: #555; text-align:center;">
          Use the code below to sign in to your Orcazo account. It expires in 10 minutes.
        </p>
        <div style="background: #f5f5f5; border-radius: 12px; padding: 24px; text-align: center; margin: 0 0 24px;">
          <div style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #111; font-variant-numeric: tabular-nums;">
            ${escapeHtml(opts.code)}
          </div>
        </div>
        <p style="font-size: 12px; color: #999; text-align:center; line-height: 1.6;">
          If you didn&apos;t request this code, you can safely ignore this email.
        </p>
        <p style="font-size: 14px; color: #666; line-height: 1.6; margin: 24px 0 0; text-align:center;">— The Orcazo team</p>
      </div>
    `.trim(),
  };
}

export function creatorApprovalEmail(opts: { fullName: string; loginUrl: string }): { subject: string; html: string } {
  const { fullName, loginUrl } = opts;
  return {
    subject: 'Welcome to Orcazo — your account is approved',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #111;">
        <div style="text-align:center; margin-bottom: 24px;">
          <div style="display:inline-block; padding: 8px 14px; border-radius: 6px; background: #111; color: #fff; font-weight: 600; letter-spacing: 0.04em;">Orcazo</div>
        </div>
        <h1 style="font-size: 20px; margin: 0 0 16px;">Welcome aboard, ${escapeHtml(fullName)}!</h1>
        <p style="font-size: 14px; line-height: 1.6; margin: 0 0 12px;">
          Your Orcazo creator account has been approved. We're excited to have you on the platform.
        </p>
        <p style="font-size: 14px; line-height: 1.6; margin: 0 0 8px; font-weight: 600;">
          Here's how to get started:
        </p>
        <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 0 0 20px;">
          <tr>
            <td style="padding: 10px 12px; border-bottom: 1px solid #eee; vertical-align: top;">
              <div style="display: inline-block; width: 24px; height: 24px; border-radius: 50%; background: #111; color: #fff; text-align: center; line-height: 24px; font-size: 13px; font-weight: 600;">1</div>
            </td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #eee; font-size: 14px; line-height: 1.5;">
              <strong>Sign in</strong> at <a href="${loginUrl}" style="color: #111;">orcazo.com</a>
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 12px; border-bottom: 1px solid #eee; vertical-align: top;">
              <div style="display: inline-block; width: 24px; height: 24px; border-radius: 50%; background: #111; color: #fff; text-align: center; line-height: 24px; font-size: 13px; font-weight: 600;">2</div>
            </td>
            <td style="padding: 10px 12px; border-bottom: 1px solid #eee; font-size: 14px; line-height: 1.5;">
              <strong>Browse campaigns</strong> and pick one that fits your audience
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 12px; vertical-align: top;">
              <div style="display: inline-block; width: 24px; height: 24px; border-radius: 50%; background: #111; color: #fff; text-align: center; line-height: 24px; font-size: 13px; font-weight: 600;">3</div>
            </td>
            <td style="padding: 10px 12px; font-size: 14px; line-height: 1.5;">
              <strong>Submit your first video</strong> and start earning
            </td>
          </tr>
        </table>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${loginUrl}"
             style="display:inline-block; padding: 12px 28px; background: #111; color: #fff;
                    border-radius: 8px; font-weight: 600; font-size: 15px; text-decoration: none;
                    letter-spacing: 0.01em;">
            Log in to Orcazo →
          </a>
        </div>
        <p style="font-size: 13px; color: #666; line-height: 1.6; margin: 24px 0 0;">
          If the button doesn't work, copy and paste this link into your browser:<br/>
          <a href="${loginUrl}" style="color: #111;">${loginUrl}</a>
        </p>
        <p style="font-size: 14px; color: #666; line-height: 1.6; margin: 24px 0 0;">— The Orcazo team</p>
      </div>
    `.trim(),
  };
}


function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
