// POST /api/admin/auth/logout — destroys the admin session

import { NextRequest } from 'next/server';
import { ok } from '@/lib/api';
import { destroyAdminSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest) {
  await destroyAdminSession();
  return ok({ ok: true });
}
