// Helpers for the Reposting feature — a separate, real campaign type where
// creators subscribe to admin-owned social accounts and repost their content.
// Money here NEVER touches the upstream/AffiliateNetwork-derived balance; it's
// a fully separate wallet funded only by admin-issued RepostCredit rows.

import 'server-only';
import { randomBytes } from 'crypto';
import { db } from './db';
import { log } from './logger';
import { notifyEmployee } from './notifications';
import { sendEmail, repostNewPostEmail } from './email';

export const REPOST_CAMPAIGN_PREFIX = 'rp_';

export function newRepostCampaignPublicId(): string {
  return REPOST_CAMPAIGN_PREFIX + randomBytes(6).toString('hex');
}

export function repostAccountLabel(account: { handle: string; displayName?: string | null }): string {
  return account.displayName?.trim() || `@${account.handle}`;
}

/**
 * Fire-and-forget: notify every subscriber of a source account that a new
 * post was logged. In-app notification + best-effort email. Never throws —
 * a notification failure must not break the admin's "log post" action.
 */
export async function notifyRepostSubscribers(opts: {
  sourceAccountId: string;
  repostPostId: string;
  postUrl: string;
  note?: string | null;
  appUrl: string;
}): Promise<void> {
  try {
    const account = await db.repostSourceAccount.findUnique({
      where: { id: opts.sourceAccountId },
      select: { handle: true, displayName: true },
    });
    if (!account) return;
    const label = repostAccountLabel(account);

    const subs = await db.repostSubscription.findMany({
      where: { sourceAccountId: opts.sourceAccountId },
      select: { employee: { select: { id: true, email: true } } },
    });
    if (subs.length === 0) return;

    const feedUrl = `${opts.appUrl.replace(/\/$/, '')}/reposting`;

    await Promise.allSettled(
      subs.map(async ({ employee }) => {
        await notifyEmployee({
          employeeId: employee.id,
          type: 'repost_new_post',
          title: `New post on ${label}`,
          body: 'Repost it and submit your link to get reviewed for a payout.',
          url: '/reposting',
        });

        const { subject, html } = repostNewPostEmail({
          accountLabel: label,
          postUrl: opts.postUrl,
          note: opts.note,
          feedUrl,
        });
        await sendEmail({ to: employee.email, subject, html });
      }),
    );
  } catch (err) {
    log.warn('repost.notify_subscribers_failed', { sourceAccountId: opts.sourceAccountId, err: String(err) });
  }
}

export interface BountyTier {
  id: string;
  minFollowers: number;
  repostBounty: number;
  collabBounty: number;
}

/** Active bounty tiers, ascending by follower floor. */
export async function getActiveBountyTiers(): Promise<BountyTier[]> {
  const rows = await db.repostBountyTier.findMany({
    where: { active: true },
    orderBy: { minFollowers: 'asc' },
  });
  return rows.map((t) => ({
    id: t.id,
    minFollowers: t.minFollowers,
    repostBounty: parseFloat(String(t.repostBounty)) || 0,
    collabBounty: parseFloat(String(t.collabBounty)) || 0,
  }));
}

/**
 * Resolve the bounty for a follower count: the highest tier whose floor the
 * creator clears. Returns 0 when no tier matches (below the lowest floor or
 * unknown followers) — the admin can still set a custom amount on approval.
 */
export function resolveBounty(
  tiers: BountyTier[],
  followers: number | null | undefined,
  kind: 'repost' | 'collab',
): number {
  if (followers == null || followers < 0) return 0;
  let bounty = 0;
  for (const t of tiers) {
    if (followers >= t.minFollowers) bounty = kind === 'repost' ? t.repostBounty : t.collabBounty;
    else break;
  }
  return bounty;
}

/** Repost wallet balance = sum(credits) − sum(amountAtRequest of PAID requests). */
export async function getRepostWalletBalance(employeeId: string): Promise<number> {
  const [creditAgg, paidAgg] = await Promise.all([
    db.repostCredit.aggregate({ where: { employeeId }, _sum: { amount: true } }),
    db.repostPayoutRequest.aggregate({
      where: { employeeId, status: 'PAID' },
      _sum: { amountAtRequest: true },
    }),
  ]);
  const credited = parseFloat(String(creditAgg._sum.amount ?? 0)) || 0;
  const consumed = parseFloat(String(paidAgg._sum.amountAtRequest ?? 0)) || 0;
  return Math.max(0, credited - consumed);
}
