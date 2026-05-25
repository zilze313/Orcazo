// GET   /api/admin/referral-claims          → list claims (filterable by status)
// PATCH /api/admin/referral-claims/[id]     → approve or reject

import { withAdmin, ok, fail } from '@/lib/api';
import { db } from '@/lib/db';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withAdmin(async ({ req }) => {
  const status = new URL(req.url).searchParams.get('status') || 'PENDING';

  const claims = await db.referralClaim.findMany({
    where: status === 'all' ? {} : { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' },
    orderBy: { createdAt: 'desc' },
    include: {
      employee: { select: { email: true, firstName: true, lastName: true } },
    },
  });

  return ok({
    claims: claims.map((c) => ({
      id:           c.id,
      status:       c.status,
      referralCount: c.referralCount,
      threshold:    c.threshold,
      rewardAmount: parseFloat(String(c.rewardAmount)),
      adminNote:    c.adminNote ?? null,
      createdAt:    c.createdAt,
      resolvedAt:   c.resolvedAt ?? null,
      employee: {
        email:       c.employee.email,
        displayName: c.employee.firstName
          ? `${c.employee.firstName}${c.employee.lastName ? ' ' + c.employee.lastName : ''}`
          : c.employee.email,
      },
    })),
  });
}, { permission: 'creators' });

const patchBody = z.object({
  action:    z.enum(['approve', 'reject']),
  adminNote: z.string().trim().max(500).optional(),
});

export const PATCH = withAdmin(async ({ req }) => {
  const id = new URL(req.url).pathname.split('/').at(-1)!;
  let body: unknown;
  try { body = await req.json(); } catch { return fail(400, 'Invalid JSON'); }
  const parsed = patchBody.safeParse(body);
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
}, { permission: 'creators' });
