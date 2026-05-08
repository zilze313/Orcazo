// GET  /api/admin/campaign-rules        → list all campaign rules
// POST /api/admin/campaign-rules        → create or update rules for a campaign

import { z } from 'zod';
import { db } from '@/lib/db';
import { withAdmin, ok, parseBody } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  campaignPublicId: z.string().trim().min(1).max(120),
  campaignName:     z.string().trim().min(1).max(300),
  rulesHtml:        z.string().min(1).max(50_000),
});

export const GET = withAdmin(async () => {
  const all = await db.campaignRules.findMany({
    orderBy: { updatedAt: 'desc' },
  });
  return ok({ campaignRules: all });
});

export const POST = withAdmin(async ({ req }) => {
  const parsed = await parseBody(req, bodySchema);
  if ('errorResponse' in parsed) return parsed.errorResponse;

  const { campaignPublicId, campaignName, rulesHtml } = parsed.data;

  const saved = await db.campaignRules.upsert({
    where:  { campaignPublicId },
    create: { campaignPublicId, campaignName, rulesHtml },
    update: { campaignName, rulesHtml },
  });

  return ok({ campaignRules: saved });
});
