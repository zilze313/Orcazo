// GET /api/admin/inbound-mail?status=pending|all
//   pending (default): non-dismissed events, newest first
//   all:               everything including dismissed, newest first
//
// Returns up to 100 rows along with the allowlist match (so the UI can show
// which creator the inbound address belongs to).

import { withAdmin, ok } from '@/lib/api';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withAdmin(async ({ req }) => {
  const url = new URL(req.url);
  const status = url.searchParams.get('status') === 'all' ? 'all' : 'pending';

  const events = await db.inboundMailEvent.findMany({
    where: status === 'pending' ? { dismissedAt: null } : {},
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  // Resolve each `to` address to its owning creator (if any) so the UI can show
  // "for: alice@gmail.com". Single batched query — cheap.
  const inboundAddrs = Array.from(new Set(events.map((e) => e.to.toLowerCase())));
  const allowlistRows = inboundAddrs.length
    ? await db.allowlist.findMany({
        where: { inboundAddress: { in: inboundAddrs, mode: 'insensitive' } },
        select: { inboundAddress: true, email: true },
      })
    : [];
  const ownerMap = new Map(
    allowlistRows
      .filter((r) => r.inboundAddress)
      .map((r) => [r.inboundAddress!.toLowerCase(), r.email]),
  );

  return ok({
    events: events.map((e) => ({
      id:          e.id,
      to:          e.to,
      fromAddress: e.fromAddress,
      subject:     e.subject,
      confirmUrl:  e.confirmUrl,
      bodySnippet: e.bodySnippet,
      dismissedAt: e.dismissedAt?.toISOString() ?? null,
      createdAt:   e.createdAt.toISOString(),
      ownerEmail:  ownerMap.get(e.to.toLowerCase()) ?? null,
    })),
  });
}, { permission: 'login-requests' });
