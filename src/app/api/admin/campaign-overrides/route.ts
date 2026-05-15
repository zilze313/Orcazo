// GET  /api/admin/campaign-overrides  — list all overrides
// POST /api/admin/campaign-overrides  — create or update (upsert by campaignPublicId)

import { withAdmin, ok, parseBody } from '@/lib/api';
import { campaignOverrideBody } from '@/lib/validators';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withAdmin(async () => {
  const rows = await db.campaignOverride.findMany({
    orderBy: { updatedAt: 'desc' },
  });
  return ok({ overrides: rows });
});

export const POST = withAdmin(async ({ req }) => {
  const parsed = await parseBody(req, campaignOverrideBody);
  if ('errorResponse' in parsed) return parsed.errorResponse;

  const { campaignPublicId, displayName, displayCpm, displayBase, displayCap } = parsed.data;

  // If every field is null/undefined, delete the override row instead of keeping an empty one.
  const allEmpty =
    (displayName == null || displayName === '') &&
    displayCpm == null &&
    displayBase == null &&
    displayCap == null;

  if (allEmpty) {
    await db.campaignOverride.deleteMany({ where: { campaignPublicId } });
    return ok({ deleted: true, campaignPublicId });
  }

  const row = await db.campaignOverride.upsert({
    where: { campaignPublicId },
    create: {
      campaignPublicId,
      displayName: displayName || null,
      displayCpm: displayCpm ?? null,
      displayBase: displayBase ?? null,
      displayCap: displayCap ?? null,
    },
    update: {
      displayName: displayName || null,
      displayCpm: displayCpm ?? null,
      displayBase: displayBase ?? null,
      displayCap: displayCap ?? null,
    },
  });

  return ok({ override: row });
});
