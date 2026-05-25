// PATCH /api/admin/referral-claims/[id] → approve or reject a referral claim

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { fail, ok } from '@/lib/api';
import { getAdminSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const body = z.object({
  action:    z.enum(['approve', 'reject']),
  adminNote: z.string().trim().max(500).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getAdminSession();
  if (!session) return fail(401, 'Not authenticated', 'UNAUTHENTICATED');

  const { id } = await params;
  const json = await req.json().catch(() => null);
  const parsed = body.safeParse(json);
  if (!parsed.success) return fail(400, 'Invalid body');

  const now = new Date();
  const updated = await db.referralClaim.update({
    where: { id },
    data: {
      status:     parsed.data.action === 'approve' ? 'APPROVED' : 'REJECTED',
      adminNote:  parsed.data.adminNote ?? null,
      resolvedAt: now,
    },
  }).catch(() => null);

  if (!updated) return fail(404, 'Claim not found');
  return ok({ ok: true });
}
