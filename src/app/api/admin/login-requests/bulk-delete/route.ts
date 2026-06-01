// POST /api/admin/login-requests/bulk-delete  { ids: string[] }
// Hard-delete one or more login requests in a single round-trip.

import { z } from 'zod';
import { db } from '@/lib/db';
import { withAdmin, ok, parseBody } from '@/lib/api';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(200),
});

export const POST = withAdmin(async ({ req, session }) => {
  const parsed = await parseBody(req, bodySchema);
  if ('errorResponse' in parsed) return parsed.errorResponse;

  const { ids } = parsed.data;
  const result  = await db.loginRequest.deleteMany({ where: { id: { in: ids } } });

  db.adminAuditLog.create({
    data: {
      adminId: session.adminId,
      action:  'login_request.bulk_delete',
      details: { idsCount: ids.length, deleted: result.count },
    },
  }).catch((err) => log.warn('admin.audit_failed', { err: String(err) }));

  return ok({ ok: true, deleted: result.count });
});
