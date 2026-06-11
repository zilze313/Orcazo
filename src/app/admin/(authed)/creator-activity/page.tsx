'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Activity, Search, Loader2, AlertTriangle, DollarSign, Mailbox,
  Unplug, CheckCircle2, Clock, Ban,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api-client';
import { formatMoney, formatRelative } from '@/lib/utils';

type Status = 'earning' | 'never_logged_in' | 'at_risk' | 'idle' | 'recent' | 'no_proxy';

interface Row {
  email: string;
  displayName: string | null;
  proxyEmail: string | null;
  proxyConnectedAt: string | null;
  lastLoginAt: string | null;
  earnings: number;
  idleDays: number | null;
  status: Status;
  reclaimable: boolean;
  warningSentAt: string | null;
  hasAccount: boolean;
}

interface Resp {
  pool: { owned: number; connected: number; free: number; reclaimable: number };
  rows: Row[];
  protectEarnings: number;
  reclaimEnabled: boolean;
}

type Tab = 'all' | 'earning' | 'never_logged_in' | 'at_risk' | 'idle';

const STATUS_META: Record<Status, { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary' }> = {
  earning:         { label: 'Earning',        variant: 'success' },
  recent:          { label: 'Recent',         variant: 'secondary' },
  idle:            { label: 'Idle',           variant: 'warning' },
  at_risk:         { label: 'At risk',        variant: 'destructive' },
  never_logged_in: { label: 'Never logged in', variant: 'destructive' },
  no_proxy:        { label: 'No proxy',       variant: 'secondary' },
};

export default function CreatorActivityPage() {
  const qc = useQueryClient();
  const [tab, setTab] = React.useState<Tab>('all');
  const [search, setSearch] = React.useState('');

  const query = useQuery<Resp>({
    queryKey: ['admin', 'creator-activity'],
    queryFn: () => api.get<Resp>('/api/admin/creator-activity'),
    staleTime: 0,
    refetchInterval: 15_000,
  });

  const reclaimMut = useMutation({
    mutationFn: (email: string) =>
      api.post<{ ok: true; freedProxy: string }>('/api/admin/creator-activity', { action: 'reclaim', email }),
    onSuccess: (d) => {
      toast.success(`Proxy ${d.freedProxy} freed back to the pool.`);
      qc.invalidateQueries({ queryKey: ['admin', 'creator-activity'] });
    },
    onError: (err: unknown) => toast.error((err as Error)?.message || 'Could not reclaim'),
  });

  const rows = query.data?.rows ?? [];
  const counts = React.useMemo(() => {
    const c = { all: rows.length, earning: 0, never_logged_in: 0, at_risk: 0, idle: 0 };
    for (const r of rows) {
      if (r.status === 'earning') c.earning++;
      else if (r.status === 'never_logged_in') c.never_logged_in++;
      else if (r.status === 'at_risk') c.at_risk++;
      else if (r.status === 'idle') c.idle++;
    }
    return c;
  }, [rows]);

  const filtered = rows
    .filter((r) => tab === 'all' || r.status === tab)
    .filter((r) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        r.email.toLowerCase().includes(q) ||
        (r.displayName?.toLowerCase().includes(q) ?? false) ||
        (r.proxyEmail?.toLowerCase().includes(q) ?? false)
      );
    });

  const pool = query.data?.pool;

  return (
    <>
      <PageHeader
        title="Creator Activity"
        description="See who's active, who's idle, and reclaim proxy emails from ghosts."
      />

      <div className="container max-w-6xl py-6 space-y-6">
        {/* Proxy inventory */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <PoolCard icon={Mailbox} label="Proxies owned" value={pool?.owned} loading={query.isLoading} />
          <PoolCard icon={CheckCircle2} label="Connected" value={pool?.connected} loading={query.isLoading} tone="default" />
          <PoolCard icon={DollarSign} label="Free to assign" value={pool?.free} loading={query.isLoading} tone={(pool?.free ?? 0) === 0 ? 'warning' : 'success'} />
          <PoolCard icon={Unplug} label="Reclaimable" value={pool?.reclaimable} loading={query.isLoading} tone={(pool?.reclaimable ?? 0) > 0 ? 'warning' : 'muted'} />
        </div>

        {/* Idle-proxy nudge */}
        {query.data && (pool?.reclaimable ?? 0) > 0 && (
          <Card className="p-4 border-yellow-500/40 bg-yellow-500/5 flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <span className="font-medium">Idle proxies sitting unused.</span>{' '}
              <span className="text-muted-foreground">
                {pool?.reclaimable} prox{pool?.reclaimable === 1 ? 'y is' : 'ies are'} idle and not earning.
                Reclaim any you want to reassign using the buttons below.
              </span>
            </div>
          </Card>
        )}

        {/* Tabs + search */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            <TabBtn active={tab === 'all'} onClick={() => setTab('all')} label="All" count={counts.all} />
            <TabBtn active={tab === 'earning'} onClick={() => setTab('earning')} label="Earning" count={counts.earning} />
            <TabBtn active={tab === 'idle'} onClick={() => setTab('idle')} label="Idle" count={counts.idle} />
            <TabBtn active={tab === 'never_logged_in'} onClick={() => setTab('never_logged_in')} label="Never logged in" count={counts.never_logged_in} />
            <TabBtn active={tab === 'at_risk'} onClick={() => setTab('at_risk')} label="At risk" count={counts.at_risk} />
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search creator / proxy…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <Card className="overflow-x-auto">
          {query.isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={Activity} title="No creators here" description="Nothing matches this filter." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Creator</TableHead>
                  <TableHead>Proxy</TableHead>
                  <TableHead className="text-right">Earned</TableHead>
                  <TableHead>Last login</TableHead>
                  <TableHead className="text-right">Idle</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const meta = STATUS_META[r.status];
                  return (
                    <TableRow key={r.email}>
                      <TableCell className="max-w-[200px]">
                        <div className="font-medium text-sm truncate">{r.displayName ?? r.email}</div>
                        {r.displayName && <div className="text-xs text-muted-foreground truncate">{r.email}</div>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">
                        {r.proxyEmail ?? <span className="italic">—</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {r.earnings > 0
                          ? <span className="text-green-600 dark:text-green-400 font-medium">{formatMoney(r.earnings)}</span>
                          : <span className="text-muted-foreground">$0</span>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {r.lastLoginAt
                          ? formatRelative(r.lastLoginAt)
                          : <span className="italic">Never</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                        {r.idleDays == null ? '—' : `${r.idleDays}d`}
                      </TableCell>
                      <TableCell>
                        <Badge variant={meta.variant} className="text-[10px] whitespace-nowrap gap-1">
                          {r.status === 'earning' && <DollarSign className="h-2.5 w-2.5" />}
                          {r.status === 'at_risk' && <AlertTriangle className="h-2.5 w-2.5" />}
                          {r.status === 'idle' && <Clock className="h-2.5 w-2.5" />}
                          {meta.label}
                        </Badge>
                        {r.status === 'at_risk' && r.warningSentAt && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            warned {formatRelative(r.warningSentAt)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.proxyEmail ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
                            disabled={reclaimMut.isPending && reclaimMut.variables === r.email}
                            onClick={() => {
                              if (confirm(`Free the proxy ${r.proxyEmail} and log out ${r.email}?\n\nTheir data is kept — you can reconnect a proxy later.`)) {
                                reclaimMut.mutate(r.email);
                              }
                            }}
                            title="Free this proxy back to the pool"
                          >
                            {reclaimMut.isPending && reclaimMut.variables === r.email
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <Unplug className="h-3.5 w-3.5" />}
                            Reclaim
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                            <Ban className="h-3 w-3" /> freed
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}

function PoolCard({
  icon: Icon, label, value, loading, tone = 'default',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | undefined;
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
        ? <Skeleton className="h-8 w-12" />
        : <div className={`text-2xl font-semibold tabular-nums ${valueClass}`}>{value ?? 0}</div>}
    </Card>
  );
}

function TabBtn({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${
        active ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:bg-accent'
      }`}
    >
      {label} <span className="opacity-60">{count}</span>
    </button>
  );
}
