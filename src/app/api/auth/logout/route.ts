import { NextRequest } from 'next/server';
import { ok } from '@/lib/api';
import { destroyEmployeeSession, getEmployeeSession } from '@/lib/session';
import { invalidateForToken } from '@/lib/affiliatenetwork/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest) {
  const session = await getEmployeeSession();
  if (session) invalidateForToken(session.affiliateNetworkToken);
  await destroyEmployeeSession();
  return ok({ ok: true });
}
