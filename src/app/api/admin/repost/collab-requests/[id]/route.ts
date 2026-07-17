// PATCH /api/admin/repost/collab-requests/[id]
//   { action: "invited", adminNote? }           → admin sent the invite in the app
//   { action: "approve", bounty?, adminNote? }  → verified on the post; credit wallet
//   { action: "reject",  adminNote? }           → declined
//
// Approving moves money: the collab bounty (tier-resolved from reported
// followers, admin-overridable) is credited in the same transaction.

import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { withAdmin, ok, fail, parseBody } from '@/lib/api';
import { db } from '@/lib/db';
import { getActiveBountyTiers, resolveBounty, repostAccountLabel } from '@/lib/repost';
import { notifyEmployee } from '@/lib/notifications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const patchSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('invited'), adminNote: z.string().trim().max(1000).nullish() }),
  z.object({
    action: z.literal('approve'),
    bounty: z.coerce.number().min(0).max(1_000_000).optional(),
    adminNote: z.string().trim().max(1000).nullish(),
  }),
  z.object({ action: z.literal('reject'), adminNote: z.string().trim().max(1000).nullish() }),
]);

function parseRouteId(req: Request): string | null {
  const segments = new URL(req.url).pathname.split('/').filter(Boolean);
  const last = segments[segments.length - 1];
  return last && last !== 'collab-requests' ? last : null;
}

export const PATCH = withAdmin(async ({ req }) => {
  const id = parseRouteId(req);
  if (!id) return fail(400, 'Missing id');

  const parsed = await parseBody(req, patchSchema);
  if ('errorResponse' in parsed) return parsed.errorResponse;
  const body = parsed.data;

  const request = await db.repostCollabRequest.findUnique({
    where: { id },
    include: {
      repostPost: { include: { sourceAccount: { select: { handle: true, displayName: true } } } },
    },
  });
  if (!request) return fail(404, 'Not found');
  if (request.status === 'APPROVED') return fail(400, 'Already approved.');

  const now = new Date();
  const label = repostAccountLabel(request.repostPost.sourceAccount);

  if (body.action === 'invited') {
    await db.repostCollabRequest.update({
      where: { id },
      data: { status: 'INVITED', adminNote: body.adminNote ?? request.adminNote, invitedAt: now },
    });

    await notifyEmployee({
      employeeId: request.employeeId,
      type: 'system',
      title: `Collab invite sent to @${request.handle} 📩`,
      body: `Check your ${request.platform || 'app'} collab invites for the ${label} post, accept it, then confirm here.`,
      url: '/reposting',
    });

    return ok({ ok: true });
  }

  if (body.action === 'approve') {
    const tiers = await getActiveBountyTiers();
    const bounty = body.bounty ?? resolveBounty(tiers, request.followers, 'collab');

    await db.$transaction([
      db.repostCollabRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          bountyPaid: new Prisma.Decimal(bounty.toFixed(2)),
          adminNote: body.adminNote ?? request.adminNote,
          reviewedAt: now,
        },
      }),
      ...(bounty > 0
        ? [db.repostCredit.create({
            data: {
              employeeId: request.employeeId,
              amount: new Prisma.Decimal(bounty.toFixed(2)),
              note: `Collab bounty — ${label}`,
            },
          })]
        : []),
    ]);

    await notifyEmployee({
      employeeId: request.employeeId,
      type: 'repost_credit',
      title: bounty > 0 ? `Collab approved — $${bounty.toFixed(2)} credited 🎉` : 'Collab approved',
      body: bounty > 0
        ? `Your collab on ${label} was verified and $${bounty.toFixed(2)} was added to your repost wallet.`
        : `Your collab on ${label} was verified.`,
      url: '/reposting',
    });

    return ok({ ok: true, bounty });
  }

  // reject
  await db.repostCollabRequest.update({
    where: { id },
    data: { status: 'REJECTED', adminNote: body.adminNote ?? request.adminNote, reviewedAt: now },
  });

  await notifyEmployee({
    employeeId: request.employeeId,
    type: 'system',
    title: 'Collab request declined',
    body: body.adminNote || `Your collab request for ${label} was declined.`,
    url: '/reposting',
  });

  return ok({ ok: true });
}, { permission: 'reposting' });
