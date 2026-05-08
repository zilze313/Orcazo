// GET /api/dashboard?sort=&page=&pageSize=
// Wraps fetch-dash. Upstream returns the whole array; we paginate server-side
// so the client doesn't render thousands of rows at once.
//
// 50% commission: every monetary value (per-item base/cap/cpm/earnings AND
// summary totalPaid/totalWaitingPayment/totalWaitingReview) is halved before
// being delivered to the browser. totalCount is a count, not money — pass it
// through unmodified.

import { withEmployee, ok } from '@/lib/api';
import { fetchDash } from '@/lib/affiliatenetwork/client';
import { limits } from '@/lib/ratelimit';

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

  const resp = await fetchDash(
    session.affiliateNetworkToken,
    { status, campaignName, onlySevenDays },
    session.affiliateNetworkCookies,
  );

  const all = resp.items ?? [];

  // Sort BEFORE pagination so the user sees the highest-earning rows on page 1.
  // Stable secondary sort by submitted-time desc keeps results predictable when
  // many rows share the same value (e.g. earnings=0).
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

  // Upstream summary fields. totalCount is a count; the rest are money.
  const summary = {
    totalCount:          resp.totalCount ?? total,
    totalWaitingReview:  num(resp.totalWaitingReview)  / 2,
    totalWaitingPayment: num(resp.totalWaitingPayment) / 2,
    totalPaid:           num(resp.totalPaid)           / 2,
  };

  return ok({
    items,
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    summary,
    sort,
  });
}, { rateLimit: limits.employee });
