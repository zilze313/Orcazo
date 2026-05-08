// GET /api/admin/stats
// High-level counts for the admin dashboard. Single round-trip via Promise.all.

import { db } from '@/lib/db';
import { withAdmin, ok } from '@/lib/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = withAdmin(async () => {
  const now = new Date();
  const dayAgo  = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);

  const [
    employeeCount,
    allowlistCount,
    submissionCount,
    submissions24h,
    submissions7d,
    submissionsFailed7d,
    activeSessions,
    recentSubmissions,
  ] = await Promise.all([
    db.employee.count(),
    db.allowlist.count(),
    db.submissionAudit.count(),
    db.submissionAudit.count({ where: { createdAt: { gte: dayAgo } } }),
    db.submissionAudit.count({ where: { createdAt: { gte: weekAgo } } }),
    db.submissionAudit.count({ where: { createdAt: { gte: weekAgo }, upstreamSuccess: false } }),
    db.session.count({ where: { expiresAt: { gt: now } } }),
    db.submissionAudit.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { employee: { select: { email: true, firstName: true } } },
    }),
  ]);

  return ok({
    employeeCount,
    allowlistCount,
    submissionCount,
    submissions24h,
    submissions7d,
    submissionsFailed7d,
    activeSessions,
    recentSubmissions,
  });
});
