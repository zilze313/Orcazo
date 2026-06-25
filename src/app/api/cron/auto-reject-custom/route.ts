// GET /api/cron/auto-reject-custom
//
// Daily sweep: any CustomCampaignApplication that's been PENDING longer than
// its campaign's configured autoRejectDelayHours flips to AUTO_REJECTED with
// the global rejection reason from AdminSetting.
//
// Idempotent — once flipped, an application is never visited again.

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { fail, ok } from '@/lib/api';
import { getCustomCampaignRejectionReason } from '@/lib/settings';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_PER_RUN = 500;

function isAuthorized(req: NextRequest): boolean {
  const ua = req.headers.get('user-agent') ?? '';
  if (ua.includes('vercel-cron')) return true;
  const secret = process.env.CRON_SECRET ?? '';
  return secret.length > 0 && req.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return fail(401, 'Unauthorized', 'UNAUTHENTICATED');

  const now = new Date();

  // Pull a batch of pending applications with their campaign's delay so we can
  // compare per-row. We bound the batch to keep one run finite.
  const pending = await db.customCampaignApplication.findMany({
    where: { status: 'PENDING' },
    include: { customCampaign: { select: { autoRejectDelayHours: true } } },
    take: MAX_PER_RUN,
    orderBy: { createdAt: 'asc' },
  });

  const dueIds: string[] = [];
  for (const a of pending) {
    const ageMs = now.getTime() - a.createdAt.getTime();
    const ageHours = ageMs / (60 * 60 * 1000);
    if (ageHours >= a.customCampaign.autoRejectDelayHours) {
      dueIds.push(a.id);
    }
  }

  if (dueIds.length === 0) {
    return ok({ scanned: pending.length, rejected: 0 });
  }

  const reason = await getCustomCampaignRejectionReason();
  const result = await db.customCampaignApplication.updateMany({
    where: { id: { in: dueIds }, status: 'PENDING' },
    data: { status: 'AUTO_REJECTED', rejectedAt: now, rejectionReason: reason },
  });

  log.info('cron.custom_campaign_auto_reject', { scanned: pending.length, rejected: result.count });

  return ok({ scanned: pending.length, rejected: result.count });
}
