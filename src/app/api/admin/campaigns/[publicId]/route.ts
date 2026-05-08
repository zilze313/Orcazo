// PATCH /api/admin/campaigns/[publicId]
// Toggle the hidden flag for a campaign.  Body: { hidden: boolean, campaignName: string }

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getAdminSession } from '@/lib/session';
import { fail, ok, parseBody } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  hidden:       z.boolean(),
  campaignName: z.string().trim().min(1).max(300),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ publicId: string }> },
): Promise<NextResponse> {
  const session = await getAdminSession();
  if (!session) return fail(401, 'Not authenticated', 'UNAUTHENTICATED');

  const { publicId } = await params;

  const parsed = await parseBody(req, bodySchema);
  if ('errorResponse' in parsed) return parsed.errorResponse;

  const { hidden, campaignName } = parsed.data;

  await db.campaignVisibility.upsert({
    where:  { campaignPublicId: publicId },
    create: { campaignPublicId: publicId, campaignName, hidden },
    update: { hidden, campaignName },
  });

  return ok({ ok: true });
}
