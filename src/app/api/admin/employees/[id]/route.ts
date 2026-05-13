// PATCH /api/admin/employees/[id]
// Updates per-employee admin settings. Currently supports:
//   showFullHistory — bypass baseline isolation so the creator sees all
//                     pre-connection submissions and earnings.

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ok, fail } from '@/lib/api';
import { getAdminSession } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const patchBody = z.object({
  showFullHistory: z.boolean(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getAdminSession();
  if (!session) return fail(401, 'Not authenticated', 'UNAUTHENTICATED');

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail(400, 'Invalid JSON body.', 'BAD_REQUEST');
  }

  const parsed = patchBody.safeParse(body);
  if (!parsed.success) {
    return fail(400, 'Invalid request body.', 'VALIDATION_ERROR');
  }

  const employee = await db.employee.findUnique({ where: { id }, select: { id: true } });
  if (!employee) return fail(404, 'Employee not found.', 'NOT_FOUND');

  const updated = await db.employee.update({
    where: { id },
    data: { showFullHistory: parsed.data.showFullHistory },
    select: { id: true, showFullHistory: true },
  });

  return ok(updated);
}
