// DELETE /api/admin/campaign-rules/[campaignPublicId] → remove custom rules

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fail, ok } from '@/lib/api';
import { getAdminSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ campaignPublicId: string }> },
): Promise<NextResponse> {
  const session = await getAdminSession();
  if (!session) return fail(401, 'Not authenticated', 'UNAUTHENTICATED');

  const { campaignPublicId } = await params;
  const deleted = await db.campaignRules.delete({ where: { campaignPublicId } }).catch(() => null);
  if (!deleted) return fail(404, 'Not found');

  return ok({ ok: true });
}
