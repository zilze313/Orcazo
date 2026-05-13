'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Users, ShieldCheck, FileText, Activity, Sparkles, AlertTriangle, Clock, DollarSign,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api-client';
import { formatRelative } from '@/lib/utils';

interface StatsResp {
  employeeCount: number;
  allowlistCount: number;
  submissionCount: number;
  submissions24h: number;
  submissions7d: number;
  submissionsFailed7d: number;
  activeSessions: number;
  totalEarnings: number;
  totalEarningsBreakdown: {
    paid: number;
    awaitingPayment: number;
    awaitingReview: number;
  };
  recentSubmissions: Array<{
    id: string;
    campaignName: string;
    upstreamStatus: number;
    upstreamSuccess: boolean;
    upstreamMessage: string | null;
    createdAt: string;
    employee: { email: string; firstName: string | null };
  }>;
}

export default function AdminDashboardPage() {
  const stats = useQuery<StatsResp>({
    queryKey: ['admin', 'stats'],
    queryFn:  () => api.get<StatsResp>('/api/admin/stats'),
    staleTime: 0,
    refetchInterval: 7_000,
  });

  return (
    <>
      <PageHeader title="Admin Dashboard" description="Live overview of the platform." />

      <div className="container max-w-7xl py-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Users}        label="Employees"          value={stats.data?.employeeCount} loading={stats.isLoading} />
          <StatCard icon={ShieldCheck}  label="Allowlisted"        value={stats.data?.allowlistCount} loading={stats.isLoading} />
          <StatCard icon={Sparkles}     label="Active sessions"    value={stats.data?.activeSessions} loading={stats.isLoading} />
          <StatCard icon={FileText}     label="Total submissions"  value={stats.data?.submissionCount} loading={stats.isLoading} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <StatCard icon={Clock}          label="Submissions (24h)" value={stats.data?.submissions24h} loading={stats.isLoading} tone="muted" />
          <StatCard icon={Activity}       label="Submissions (7d)"  value={stats.data?.submissions7d}  loading={stats.isLoading} tone="muted" />
          <StatCard icon={AlertTriangle}  label="Failed (7d)"       value={stats.data?.submissionsFailed7d} loading={stats.isLoading} tone={(stats.data?.submissionsFailed7d ?? 0) > 0 ? 'warning' : 'muted'} />
        </div>

        {/* Earnings breakdown */}
        <Card className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-3">
            <DollarSign className="h-4 w-4" />
            Total creator earnings (all users, all time)
          </div>
          {stats.isLoading ? (
            <div className="flex gap-6">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-24" />
            </div>
          ) : (
            <div className="flex flex-wrap gap-6">
              <div>
                <div className="text-2xl font-semibold tabular-nums">
                  ${(stats.data?.totalEarnings ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">Total combined</div>
              </div>
              <div className="w-px bg-border self-stretch hidden sm:block" />
              <div>
                <div className="text-lg font-semibold tabular-nums text-green-600 dark:text-green-400">
                  ${(stats.data?.totalEarningsBreakdown.paid ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">Paid out</div>
              </div>
              <div>
                <div className="text-lg font-semibold tabular-nums text-blue-600 dark:text-blue-400">
                  ${(stats.data?.totalEarningsBreakdown.awaitingPayment ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">Awaiting payment</div>
              </div>
              <div>
                <div className="text-lg font-semibold tabular-nums text-yellow-600 dark:text-yellow-400">
                  ${(stats.data?.totalEarningsBreakdown.awaitingReview ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">Awaiting review</div>
              </div>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Recent submissions
          </h2>
          {stats.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : (stats.data?.recentSubmissions.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No submissions yet.</p>
          ) : (
            <ul className="divide-y">
              {stats.data!.recentSubmissions.map((s) => (
                <li key={s.id} className="py-2.5 flex items-center justify-between gap-4 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{s.campaignName}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {s.employee.firstName ? `${s.employee.firstName} · ` : ''}{s.employee.email}
                    </div>
                  </div>
                  <div className={`text-xs flex-shrink-0 ${s.upstreamSuccess ? 'text-green-600' : 'text-red-600'}`}>
                    {s.upstreamSuccess ? 'OK' : `Failed (${s.upstreamStatus})`}
                  </div>
                  <div className="text-xs text-muted-foreground flex-shrink-0 whitespace-nowrap">
                    {formatRelative(s.createdAt)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function StatCard({
  icon: Icon, label, value, loading, tone = 'default',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | undefined;
  loading?: boolean;
  tone?: 'default' | 'muted' | 'warning';
}) {
  const valueClass = {
    default: 'text-foreground',
    muted:   'text-muted-foreground',
    warning: 'text-yellow-600 dark:text-yellow-400',
  }[tone];

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      {loading
        ? <Skeleton className="h-8 w-16" />
        : <div className={`text-2xl font-semibold tabular-nums ${valueClass}`}>{value ?? 0}</div>}
    </Card>
  );
}
