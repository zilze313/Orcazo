'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Database, Mail, Server, RefreshCw, Cloud } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api-client';

interface ServiceStatus {
  ok: boolean;
  latencyMs: number;
  configured?: boolean;
  bucket?: string;
}

interface HealthResp {
  uptime: number;
  cache: { hits: number; misses: number; entries: number };
  services: {
    database: ServiceStatus;
    storage: ServiceStatus & { bucket: string };
    resend: ServiceStatus & { configured: boolean };
  };
  stats: {
    employees: number;
    admins: number;
    unreadMessages: number;
    pendingSignups: number;
    pendingPayouts: number;
  };
  env: {
    nodeEnv: string;
    appUrl: string;
  };
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span className={`inline-block h-2.5 w-2.5 rounded-full flex-shrink-0 ${ok ? 'bg-green-500' : 'bg-red-500'}`} />
  );
}

function ServiceCard({
  icon: Icon,
  name,
  status,
  extra,
}: {
  icon: React.ComponentType<{ className?: string }>;
  name: string;
  status: ServiceStatus | undefined;
  extra?: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {status ? <StatusDot ok={status.ok} /> : <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30 inline-block" />}
            <span className="font-medium text-sm">{name}</span>
          </div>
          {status && (
            <p className={`text-xs mt-0.5 ${status.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {status.ok ? `Healthy · ${status.latencyMs}ms` : 'Unreachable'}
            </p>
          )}
        </div>
      </div>
      {extra}
    </Card>
  );
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium tabular-nums">{value}</span>
    </div>
  );
}

function formatUptime(seconds: number) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function HealthPage() {
  const { data, isLoading, dataUpdatedAt, refetch } = useQuery<HealthResp>({
    queryKey: ['admin', 'health'],
    queryFn: () => api.get<HealthResp>('/api/admin/health'),
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  return (
    <>
      <PageHeader
        title="Health"
        description="Service status, resource usage, and platform statistics."
        actions={
          <div className="flex items-center gap-3">
            {dataUpdatedAt > 0 && (
              <span className="text-xs text-muted-foreground">
                Updated {new Date(dataUpdatedAt).toLocaleTimeString()}
              </span>
            )}
            <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isLoading} className="gap-1.5">
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        }
      />

      <div className="container max-w-5xl py-6 space-y-6">
        {/* Services */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Services</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)
            ) : (
              <>
                <ServiceCard
                  icon={Database}
                  name="Database"
                  status={data?.services.database}
                />
                <ServiceCard
                  icon={Cloud}
                  name="R2 Storage"
                  status={data?.services.storage}
                  extra={data?.services.storage && (
                    <p className="text-xs text-muted-foreground">Bucket: <span className="font-mono">{data.services.storage.bucket}</span></p>
                  )}
                />
                <ServiceCard
                  icon={Mail}
                  name="Resend Email"
                  status={data?.services.resend}
                  extra={data?.services.resend && !data.services.resend.configured && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">RESEND_API_KEY not configured</p>
                  )}
                />
              </>
            )}
          </div>
        </section>

        {/* Server */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Server</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {isLoading ? (
              <Skeleton className="h-28 sm:col-span-2" />
            ) : (
              <>
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Server className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">Runtime</span>
                  </div>
                  <StatRow label="Uptime" value={data ? formatUptime(data.uptime) : '—'} />
                  <StatRow label="Environment" value={data?.env.nodeEnv ?? '—'} />
                  <StatRow label="App URL" value={data?.env.appUrl ?? '—'} />
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">In-memory cache</span>
                  </div>
                  <StatRow label="Cache hits" value={data?.cache.hits ?? '—'} />
                  <StatRow label="Cache misses" value={data?.cache.misses ?? '—'} />
                  <StatRow label="Cached entries" value={data?.cache.entries ?? '—'} />
                </Card>
              </>
            )}
          </div>
        </section>

        {/* Platform stats */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Platform</h2>
          {isLoading ? (
            <Skeleton className="h-36" />
          ) : (
            <Card className="p-4 max-w-sm">
              <StatRow label="Total creators" value={data?.stats.employees ?? '—'} />
              <StatRow label="Total admins" value={data?.stats.admins ?? '—'} />
              <StatRow label="Unread messages" value={data?.stats.unreadMessages ?? '—'} />
              <StatRow label="Pending signups" value={data?.stats.pendingSignups ?? '—'} />
              <StatRow label="Pending payouts" value={data?.stats.pendingPayouts ?? '—'} />
            </Card>
          )}
        </section>
      </div>
    </>
  );
}
