'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  LineChart, ExternalLink, DollarSign, Clock, CheckCircle2,
  Film, Hourglass, Eye,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/components/empty-state';
import { PaginationBar } from '@/components/pagination-bar';
import { PlatformIcon } from '@/components/platform-icon';
import { formatMoney, formatNumber, formatRelative } from '@/lib/utils';
import { api, isUpstreamExpired } from '@/lib/api-client';

interface DashItem {
  time_submitted: string;
  time_posted: string | null;
  campaign_name: string;
  link_submitted: string;
  link_final: string | null;
  social_profile: { url: string; username: string; platform: string };
  views: number | null;
  threshold: number;
  base: number;
  cpm: number;
  cap: number;
  earnings: number;
  on_time: boolean;
  seven_days: boolean;
  payment_platform: string | null;
  status?: string;
}

interface DashResp {
  items: DashItem[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  summary: {
    totalCount: number;
    totalWaitingReview: number;
    totalWaitingPayment: number;
    totalPaid: number;
  };
  sort: 'earnings' | 'submitted' | 'posted' | 'views';
}

const SORT_OPTIONS: Array<{ value: DashResp['sort']; label: string }> = [
  { value: 'earnings',  label: 'Top earning' },
  { value: 'views',     label: 'Most viewed' },
  { value: 'posted',    label: 'Recently posted' },
  { value: 'submitted', label: 'Recently submitted' },
];

/** Map upstream status string to a Badge variant. */
function statusVariant(status: string | undefined): 'success' | 'warning' | 'destructive' | 'secondary' | 'default' {
  if (!status) return 'secondary';
  const s = status.toLowerCase();
  if (s.includes('paid'))     return 'success';
  if (s.includes('approved')) return 'success';
  if (s.includes('reject'))   return 'destructive';
  if (s.includes('wait'))     return 'warning';
  if (s.includes('review'))   return 'warning';
  return 'secondary';
}

export default function DashboardPage() {
  const router = useRouter();
  const params = useSearchParams();
  const page = Math.max(1, parseInt(params.get('page') || '1', 10));
  const sortParam = (params.get('sort') as DashResp['sort'] | null) ?? 'earnings';

  const query = useQuery<DashResp>({
    queryKey: ['dashboard', page, sortParam],
    queryFn: () => api.get<DashResp>(`/api/dashboard?page=${page}&pageSize=20&sort=${sortParam}`),
    staleTime: 5_000,
  });

  React.useEffect(() => {
    if (query.error && isUpstreamExpired(query.error)) router.replace('/login');
  }, [query.error, router]);

  const setPage = (p: number) => {
    const u = new URLSearchParams(params);
    u.set('page', String(p));
    router.replace(`/dashboard?${u.toString()}`, { scroll: false });
  };

  const setSort = (s: DashResp['sort']) => {
    const u = new URLSearchParams(params);
    u.set('sort', s);
    u.set('page', '1');
    router.replace(`/dashboard?${u.toString()}`, { scroll: false });
  };

  const summary = query.data?.summary;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Your submissions, views, and earnings."
        actions={
          <div className="w-48">
            <Select value={sortParam} onValueChange={(v) => setSort(v as DashResp['sort'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />
      <div className="container max-w-7xl py-6 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            icon={Film}
            label="Total videos"
            value={summary ? formatNumber(summary.totalCount) : null}
            loading={query.isLoading}
            tone="default"
          />
          <SummaryCard
            icon={Eye}
            label="Waiting review"
            value={summary ? formatMoney(summary.totalWaitingReview) : null}
            loading={query.isLoading}
            tone="muted"
          />
          <SummaryCard
            icon={Hourglass}
            label="Waiting payment"
            value={summary ? formatMoney(summary.totalWaitingPayment) : null}
            loading={query.isLoading}
            tone="warning"
          />
          <SummaryCard
            icon={DollarSign}
            label="Paid out"
            value={summary ? formatMoney(summary.totalPaid) : null}
            loading={query.isLoading}
            tone="success"
          />
        </div>

        <Card className="overflow-x-auto">
          {query.isLoading ? (
            <div className="p-4 space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : query.data && query.data.items.length === 0 ? (
            <EmptyState
              icon={LineChart}
              title="No submissions yet"
              description="Submit a post on the campaigns page to see your stats here."
              action={
                <Button asChild size="sm">
                  <Link href="/campaigns">Browse campaigns</Link>
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Posted</TableHead>
                  <TableHead className="whitespace-nowrap">Submitted</TableHead>
                  <TableHead className="whitespace-nowrap">Campaign</TableHead>
                  <TableHead className="whitespace-nowrap">Link</TableHead>
                  <TableHead className="whitespace-nowrap">Username</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Views Threshold</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Views</TableHead>
                  <TableHead className="text-right whitespace-nowrap">CPM</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Earnings</TableHead>
                  <TableHead className="text-center whitespace-nowrap">Timely</TableHead>
                  <TableHead className="whitespace-nowrap">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data!.items.map((row, i) => (
                  <TableRow key={`${row.link_submitted}-${i}`}>
                    {/* Posted */}
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {row.time_posted ? formatRelative(row.time_posted) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    {/* Submitted */}
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatRelative(row.time_submitted)}
                    </TableCell>
                    {/* Campaign */}
                    <TableCell className="font-medium max-w-[180px] truncate" title={row.campaign_name}>
                      {row.campaign_name}
                    </TableCell>
                    {/* Link */}
                    <TableCell>
                      <a
                        href={row.link_final || row.link_submitted}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs hover:underline max-w-[140px]"
                      >
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{row.link_final || row.link_submitted}</span>
                      </a>
                    </TableCell>
                    {/* Username */}
                    <TableCell className="text-xs whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <PlatformIcon platform={row.social_profile.platform} className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium">@{row.social_profile.username}</span>
                      </span>
                    </TableCell>
                    {/* Views Threshold */}
                    <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                      {formatNumber(row.threshold)}
                    </TableCell>
                    {/* Views */}
                    <TableCell className="text-right tabular-nums">
                      {row.views == null
                        ? <span className="text-muted-foreground">—</span>
                        : formatNumber(row.views)}
                    </TableCell>
                    {/* CPM */}
                    <TableCell className="text-right tabular-nums text-xs">
                      {row.cpm > 0 ? formatMoney(row.cpm) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    {/* Earnings */}
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatMoney(row.earnings)}
                    </TableCell>
                    {/* Timely */}
                    <TableCell className="text-center">
                      {row.on_time
                        ? <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" aria-label="On time" />
                        : <Clock className="h-4 w-4 text-muted-foreground mx-auto" aria-label="Late" />}
                    </TableCell>
                    {/* Status */}
                    <TableCell>
                      <Badge variant={statusVariant(row.status)} className="text-[10px] whitespace-nowrap capitalize">
                        {row.status || '—'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {query.data && query.data.items.length > 0 && (
            <div className="px-4 border-t">
              <PaginationBar
                page={query.data.pagination.page}
                totalPages={query.data.pagination.totalPages}
                total={query.data.pagination.total}
                onPageChange={setPage}
              />
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

function SummaryCard({
  icon: Icon, label, value, loading, tone = 'default',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null;
  loading?: boolean;
  tone?: 'default' | 'muted' | 'warning' | 'success';
}) {
  const valueClass = {
    default: 'text-foreground',
    muted:   'text-muted-foreground',
    warning: 'text-yellow-600 dark:text-yellow-400',
    success: 'text-green-600 dark:text-green-400',
  }[tone];

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      {loading
        ? <Skeleton className="h-8 w-24" />
        : <div className={`text-2xl font-semibold tabular-nums ${valueClass}`}>{value ?? '—'}</div>}
    </Card>
  );
}
