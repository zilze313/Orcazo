// GET /api/dashboard?sort=&page=&pageSize=
// Wraps fetch-dash. Upstream returns the whole array; we paginate server-side
// so the client doesn't render thousands of rows at once.
//
// 50% commission: every monetary value (per-item base/cap/cpm/earnings AND
// summary totalPaid/totalWaitingPayment/totalWaitingReview) is halved before
// being delivered to the browser. totalCount is a count, not money — pass it
// through unmodified.
//
// Baseline isolation: only show data from the day the creator's proxy email was
// connected. Items are filtered by time_submitted >= proxyConnectedAt; aggregate
// totals are adjusted by subtracting a baseline snapshot captured on the
// creator's first dashboard load.

import { withEmployee, ok } from '@/lib/api';
import { fetchDash } from '@/lib/affiliatenetwork/client';
import { limits } from '@/lib/ratelimit';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SortKey = 'earnings' | 'submitted' | 'posted' | 'views';
const SORTS: SortKey[] = ['earnings', 'submitted', 'posted', 'views'];

function num(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/** Convert a Prisma Decimal (or any stringify-able value) to a plain number. */
function decNum(v: unknown): number {
  if (v == null) return 0;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

function tsOrZero(v: string | null | undefined): number {
  if (!v) return 0;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
}

export const GET = withEmployee(async ({ req, session }) => {
  const url = new URL(req.url);
  const status         = url.searchParams.get('status')        || 'all';
  const campaignName   = url.searchParams.get('campaignName')  || 'all';
  const onlySevenDays  = url.searchParams.get('onlySevenDays') === 'true';
  const page           = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const pageSize       = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') || '20', 10)));

  const sortParam = url.searchParams.get('sort') as SortKey | null;
  const sort: SortKey = sortParam && SORTS.includes(sortParam) ? sortParam : 'earnings';

  const [resp, allowlistRow, employee] = await Promise.all([
    fetchDash(
      session.affiliateNetworkToken,
      { status, campaignName, onlySevenDays },
      session.affiliateNetworkCookies,
    ),
    db.allowlist.findUnique({
      where: { email: session.email },
      select: { proxyConnectedAt: true },
    }),
    db.employee.findUnique({
      where: { id: session.employeeId },
      select: {
        baselineTotalPaid:      true,
        baselineWaitingPayment: true,
        baselineWaitingReview:  true,
        baselineCapturedAt:     true,
        showFullHistory:        true,
      },
    }),
  ]);

  // ── Lazy baseline capture ─────────────────────────────────────────────────
  // On the creator's first dashboard load, store the raw upstream aggregate
  // totals as a baseline. Future requests subtract this baseline so creators
  // only see earnings accrued after their proxy email was connected.
  if (employee && !employee.baselineCapturedAt) {
    db.employee.update({
      where: { id: session.employeeId },
      data: {
        baselineTotalPaid:      new Prisma.Decimal(String(num(resp.totalPaid))),
        baselineWaitingPayment: new Prisma.Decimal(String(num(resp.totalWaitingPayment))),
        baselineWaitingReview:  new Prisma.Decimal(String(num(resp.totalWaitingReview))),
        baselineCapturedAt:     new Date(),
      },
    }).catch(() => {});
  }

  // ── Cutoff filter ─────────────────────────────────────────────────────────
  // Hide any submission that was submitted before the proxy email was connected.
  // Bypassed when admin has enabled showFullHistory for this creator.
  const showFull = employee?.showFullHistory ?? false;
  const cutoff   = showFull ? null : (allowlistRow?.proxyConnectedAt ?? null);
  const cutoffMs = cutoff ? cutoff.getTime() : 0;

  const all = (resp.items ?? []).filter((item) => {
    if (!cutoff) return true; // no cutoff set, or full history enabled → show everything
    const ts = tsOrZero(item.time_submitted);
    return ts >= cutoffMs;
  });

  // Sort BEFORE pagination so the user sees the highest-earning rows on page 1.
  // Stable secondary sort by submitted-time desc keeps results predictable.
  all.sort((a, b) => {
    let primary = 0;
    switch (sort) {
      case 'earnings':  primary = num(b.earnings) - num(a.earnings); break;
      case 'views':     primary = num(b.views)    - num(a.views);    break;
      case 'posted':    primary = tsOrZero(b.time_posted)    - tsOrZero(a.time_posted);    break;
      case 'submitted': primary = tsOrZero(b.time_submitted) - tsOrZero(a.time_submitted); break;
    }
    if (primary !== 0) return primary;
    return tsOrZero(b.time_submitted) - tsOrZero(a.time_submitted);
  });

  const total = all.length;
  const start = (page - 1) * pageSize;
  const rawItems = all.slice(start, start + pageSize);

  // Halve all per-item monetary fields before delivery
  const items = rawItems.map((i) => ({
    ...i,
    base:     num(i.base)     / 2,
    cap:      num(i.cap)      / 2,
    cpm:      num(i.cpm)      / 2,
    earnings: num(i.earnings) / 2,
  }));

  // ── Baseline-adjusted summary totals ─────────────────────────────────────
  // showFull → no subtraction (baseline = 0, show raw upstream / 2).
  // First load → use current upstream as baseline so totals start at zero.
  const isFirstLoad = !showFull && employee && !employee.baselineCapturedAt;
  const bPaid    = showFull ? 0 : (isFirstLoad ? num(resp.totalPaid)           : decNum(employee?.baselineTotalPaid));
  const bPayment = showFull ? 0 : (isFirstLoad ? num(resp.totalWaitingPayment) : decNum(employee?.baselineWaitingPayment));
  const bReview  = showFull ? 0 : (isFirstLoad ? num(resp.totalWaitingReview)  : decNum(employee?.baselineWaitingReview));

  const summary = {
    totalCount:          total,
    totalWaitingReview:  Math.max(0, num(resp.totalWaitingReview)  - bReview)  / 2,
    totalWaitingPayment: Math.max(0, num(resp.totalWaitingPayment) - bPayment) / 2,
    totalPaid:           Math.max(0, num(resp.totalPaid)           - bPaid)    / 2,
  };

  return ok({
    items,
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    summary,
    sort,
  });
}, { rateLimit: limits.employee });
