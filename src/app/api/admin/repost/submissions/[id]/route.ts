// PATCH /api/admin/repost/submissions/[id]
//   { action: "approve", bounty?, adminNote? } → APPROVED + wallet credit
//   { action: "reject",  adminNote? }          → REJECTED
//   { adminNote }                               → legacy "mark reviewed"
//
// Approving moves money: the bounty (tier-resolved from the creator's
// reported followers, admin-overridable) is credited to the repost wallet in
// the same transaction, so a submission can never be approved twice.

import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { withAdmin, ok, fail, parseBody } from '@/lib/api';
import { db } from '@/lib/db';
import { getActiveBountyTiers, resolveBounty, repostAccountLabel } from '@/lib/repost';
import { notifyEmployee } from '@/lib/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const approveSchema = z.object({
  action: z.literal('approve'),
  bounty: z.coerce.number().min(0).max(1_000_000).optional(),
  adminNote: z.string().trim().max(1000).nullish(),
});
const rejectSchema = z.object({
  action: z.literal('reject'),
  adminNote: z.string().trim().max(1000).nullish(),
});
const legacySchema = z.object({
  adminNote: z.string().trim().max(1000).nullish(),
});
const updateSchema = z.union([approveSchema, rejectSchema, legacySchema]);

function parseRouteId(req: Request): string | null {
  const segments = new URL(req.url).pathname.split('/').filter(Boolean);
  const last = segments[segments.length - 1];
  return last && last !== 'submissions' ? last : null;
}

export const PATCH = withAdmin(async ({ req }) => {
  const id = parseRouteId(req);
  if (!id) return fail(400, 'Missing id');

  const parsed = await parseBody(req, updateSchema);
  if ('errorResponse' in parsed) return parsed.errorResponse;
  const body = parsed.data;

  const submission = await db.repostSubmission.findUnique({
    where: { id },
    include: {
      repostPost: { include: { sourceAccount: { select: { handle: true, displayName: true } } } },
    },
  });
  if (!submission) return fail(404, 'Not found');

  const now = new Date();

  if ('action' in body && body.action === 'approve') {
    if (submission.status === 'APPROVED') return fail(400, 'Already approved.');

    const tiers = await getActiveBountyTiers();
    const bounty = body.bounty ?? resolveBounty(tiers, submission.followers, 'repost');
    const label = repostAccountLabel(submission.repostPost.sourceAccount);

    await db.$transaction([
      db.repostSubmission.update({
        where: { id },
        data: {
          status: 'APPROVED',
          bountyPaid: new Prisma.Decimal(bounty.toFixed(2)),
          adminNote: body.adminNote ?? null,
          reviewedAt: now,
        },
      }),
      ...(bounty > 0
        ? [db.repostCredit.create({
            data: {
              employeeId: submission.employeeId,
              amount: new Prisma.Decimal(bounty.toFixed(2)),
              note: `Repost bounty — ${label}`,
            },
          })]
        : []),
    ]);

    await notifyEmployee({
      employeeId: submission.employeeId,
      type: 'repost_credit',
      title: bounty > 0 ? `Repost approved — $${bounty.toFixed(2)} credited 🎉` : 'Repost approved',
      body: bounty > 0
        ? `Your repost for ${label} was approved and $${bounty.toFixed(2)} was added to your repost wallet.`
        : `Your repost for ${label} was approved.`,
      url: '/reposting',
    });

    return ok({ ok: true, bounty });
  }

  if ('action' in body && body.action === 'reject') {
    if (submission.status === 'APPROVED') return fail(400, 'Already approved — cannot reject.');

    await db.repostSubmission.update({
      where: { id },
      data: { status: 'REJECTED', adminNote: body.adminNote ?? null, reviewedAt: now },
    });

    await notifyEmployee({
      employeeId: submission.employeeId,
      type: 'system',
      title: 'Repost submission rejected',
      body: body.adminNote || 'Your repost submission was not approved.',
      url: '/reposting',
    });

    return ok({ ok: true });
  }

  // Legacy: mark reviewed without moving money.
  await db.repostSubmission.update({
    where: { id },
    data: { status: 'REVIEWED', adminNote: body.adminNote ?? null, reviewedAt: now },
  });

  return ok({ ok: true });
}, { permission: 'reposting' });
