'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  Wallet, Search, ChevronDown, ChevronRight, Loader2, Trash2,
  Banknote, Bitcoin, Copy, CheckCircle2, Clock, XCircle, PlayCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import { PaginationBar } from '@/components/pagination-bar';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api-client';
import { formatMoney, formatRelative } from '@/lib/utils';

type Status = 'REQUESTED' | 'IN_PROGRESS' | 'PAID' | 'CANCELLED';

interface PayoutEntry {
  id: string;
  employeeId: string;
  method: 'BANK' | 'CRYPTO';
  details: Record<string, string>;
  amountAtRequest: string;
  status: Status;
  notes: string | null;
  createdAt: string;
  inProgressAt: string | null;
  paidAt: string | null;
  cancelledAt: string | null;
  employee: {
    email: string;
    firstName: string | null;
    lastName: string | null;
    bioVerificationCode: string | null;
  };
}

interface ListResp {
  entries: PayoutEntry[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export default function AdminPayoutsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();

  const search = params.get('search') ?? '';
  const status = (params.get('status') as Status | 'all') ?? 'REQUESTED';
  const page   = Math.max(1, parseInt(params.get('page') || '1', 10));
  const [searchInput, setSearchInput] = React.useState(search);

  React.useEffect(() => {
    const t = setTimeout(() => {
      const u = new URLSearchParams(params);
      if (searchInput) u.set('search', searchInput); else u.delete('search');
      u.set('page', '1');
      router.replace(`/admin/payouts?${u.toString()}`, { scroll: false });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const list = useQuery<ListResp>({
    queryKey: ['admin', 'payouts', search, status, page],
    queryFn: () => {
      const u = new URLSearchParams({ page: String(page), pageSize: '25', status });
      if (search) u.set('search', search);
      return api.get<ListResp>(`/api/admin/payouts?${u.toString()}`);
    },
    staleTime: 0,
    refetchInterval: 7_000,
  });

  const setUrlParam = (key: string, value: string) => {
    const u = new URLSearchParams(params);
    u.set(key, value);
    if (key !== 'page') u.set('page', '1');
    router.replace(`/admin/payouts?${u.toString()}`, { scroll: false });
  };

  const updateMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Status }) =>
      fetch(`/api/admin/payouts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }).then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || 'Failed');
        return json;
      }),
    onSuccess: (_data, vars) => {
      toast.success(`Marked as ${vars.status.toLowerCase().replace('_', ' ')}`);
      qc.invalidateQueries({ queryKey: ['admin', 'payouts'] });
    },
    onError: (err: unknown) => toast.error((err as Error)?.message || 'Could not update'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.del<{ ok: true }>(`/api/admin/payouts/${id}`),
    onSuccess: () => {
      toast.success('Deleted');
      qc.invalidateQueries({ queryKey: ['admin', 'payouts'] });
    },
    onError: (err: unknown) => toast.error((err as Error)?.message || 'Could not delete'),
  });

  return (
    <>
      <PageHeader
        title="Payouts"
        description="Creator payout requests. Workflow: Requested → In progress → Paid. (Or cancelled.)"
        actions={
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search creator…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="w-36">
              <Select value={status} onValueChange={(v) => setUrlParam('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="REQUESTED">Requested</SelectItem>
                  <SelectItem value="IN_PROGRESS">In progress</SelectItem>
                  <SelectItem value="PAID">Paid</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        }
      />

      <div className="container max-w-6xl py-6">
        <Card>
          {list.isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
            </div>
          ) : (list.data?.entries.length ?? 0) === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No payout requests"
              description={search ? 'Try a different search term.' : 'When creators request payouts, they show up here.'}
            />
          ) : (
            <ul className="divide-y">
              {list.data!.entries.map((p) => (
                <PayoutRow
                  key={p.id}
                  entry={p}
                  onTransition={(status) => updateMut.mutate({ id: p.id, status })}
                  onDelete={() => {
                    if (confirm(`Delete this payout request from ${p.employee.email}? This cannot be undone.`)) {
                      deleteMut.mutate(p.id);
                    }
                  }}
                  pendingStatus={updateMut.isPending && updateMut.variables?.id === p.id ? updateMut.variables?.status : null}
                  deleting={deleteMut.isPending && deleteMut.variables === p.id}
                />
              ))}
            </ul>
          )}
          {list.data && list.data.entries.length > 0 && (
            <div className="px-4 border-t">
              <PaginationBar
                page={list.data.pagination.page}
                totalPages={list.data.pagination.totalPages}
                total={list.data.pagination.total}
                onPageChange={(p) => setUrlParam('page', String(p))}
              />
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

function PayoutRow({
  entry, onTransition, onDelete, pendingStatus, deleting,
}: {
  entry: PayoutEntry;
  onTransition: (status: Status) => void;
  onDelete: () => void;
  pendingStatus: Status | null | undefined;
  deleting: boolean;
}) {
  const [open, setOpen] = React.useState(entry.status === 'REQUESTED' || entry.status === 'IN_PROGRESS');
  return (
    <li className="p-4">
      <div className="flex items-start gap-3">
        <button
          onClick={() => setOpen((v) => !v)}
          className="mt-0.5 text-muted-foreground hover:text-foreground"
          aria-label={open ? 'Collapse' : 'Expand'}
        >
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{entry.employee.email}</span>
            {entry.employee.firstName && (
              <span className="text-xs text-muted-foreground">({entry.employee.firstName} {entry.employee.lastName})</span>
            )}
            <StatusBadge status={entry.status} />
          </div>
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1">
              {entry.method === 'BANK' ? <Banknote className="h-3 w-3" /> : <Bitcoin className="h-3 w-3" />}
              {entry.method === 'BANK' ? 'Bank transfer' : 'Crypto'}
            </span>
            <span>·</span>
            <span className="font-medium text-foreground">{formatMoney(parseFloat(entry.amountAtRequest))}</span>
            <span>·</span>
            <span>requested {formatRelative(entry.createdAt)}</span>
          </div>

          {open && (
            <div className="mt-3 rounded-md border bg-muted/20 p-3 space-y-2">
              {Object.entries(entry.details).map(([k, v]) => (
                <DetailRow key={k} label={prettyLabel(k)} value={v} />
              ))}
              {entry.notes && (
                <DetailRow label="Creator notes" value={entry.notes} />
              )}
              {entry.employee.bioVerificationCode && (
                <DetailRow label="Bio code" value={entry.employee.bioVerificationCode} mono />
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {entry.status === 'REQUESTED' && (
            <>
              <Button size="sm" onClick={() => onTransition('IN_PROGRESS')} disabled={!!pendingStatus}>
                {pendingStatus === 'IN_PROGRESS' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
                Start
              </Button>
              <Button size="sm" variant="outline" onClick={() => onTransition('CANCELLED')} disabled={!!pendingStatus}>
                <XCircle className="h-3.5 w-3.5" /> Cancel
              </Button>
            </>
          )}
          {entry.status === 'IN_PROGRESS' && (
            <>
              <Button size="sm" onClick={() => onTransition('PAID')} disabled={!!pendingStatus}>
                {pendingStatus === 'PAID' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Mark paid
              </Button>
              <Button size="sm" variant="outline" onClick={() => onTransition('CANCELLED')} disabled={!!pendingStatus}>
                <XCircle className="h-3.5 w-3.5" /> Cancel
              </Button>
            </>
          )}
          {(entry.status === 'PAID' || entry.status === 'CANCELLED') && (
            <Button
              size="icon"
              variant="ghost"
              onClick={onDelete}
              disabled={deleting}
              title="Delete this row"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = React.useState(false);
  function copy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  }
  return (
    <div className="flex items-center gap-3 text-xs">
      <div className="w-32 flex-shrink-0 text-muted-foreground">{label}</div>
      <div className={`flex-1 break-all ${mono ? 'font-mono' : ''}`}>{value}</div>
      <button onClick={copy} className="text-muted-foreground hover:text-foreground" title="Copy">
        {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  if (status === 'PAID')        return <Badge variant="success" className="gap-1"><CheckCircle2 className="h-2.5 w-2.5" /> Paid</Badge>;
  if (status === 'CANCELLED')   return <Badge variant="destructive" className="gap-1"><XCircle className="h-2.5 w-2.5" /> Cancelled</Badge>;
  if (status === 'IN_PROGRESS') return <Badge variant="warning" className="gap-1"><PlayCircle className="h-2.5 w-2.5" /> In progress</Badge>;
  return <Badge variant="secondary" className="gap-1"><Clock className="h-2.5 w-2.5" /> Requested</Badge>;
}

function prettyLabel(k: string): string {
  const map: Record<string, string> = {
    holderName: 'Holder name',
    bankName:   'Bank',
    iban:       'IBAN',
    swift:      'SWIFT',
    network:    'Network',
    address:    'Wallet',
  };
  return map[k] ?? k;
}
