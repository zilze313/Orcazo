'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  Wallet, Search, ChevronDown, ChevronRight, Loader2,
  Banknote, Bitcoin, Mail, Copy, CheckCircle2, Clock, XCircle, AlertCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import { PaginationBar } from '@/components/pagination-bar';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api-client';
import { formatMoney, formatRelative } from '@/lib/utils';

type Status = 'REQUESTED' | 'IN_PROGRESS' | 'PAID' | 'REJECTED' | 'CANCELLED';

interface PayoutEntry {
  id: string;
  employeeId: string;
  method: 'BANK' | 'CRYPTO' | 'PAYPAL';
  details: Record<string, string>;
  amountAtRequest: string;
  amountPaid: string | null;
  penalty: string | null;
  adminNote: string | null;
  status: Status;
  notes: string | null;
  createdAt: string;
  inProgressAt: string | null;
  paidAt: string | null;
  rejectedAt: string | null;
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

/* ──────────────────────────────────────────────
   Modal state types
────────────────────────────────────────────── */
type ApproveModal = { open: true; id: string; amountAtRequest: number; amountPaid: string; adminNote: string };
type RejectModal  = { open: true; id: string; adminNote: string };

export default function AdminPayoutsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();

  const search = params.get('search') ?? '';
  const status = (params.get('status') as Status | 'all') ?? 'REQUESTED';
  const page   = Math.max(1, parseInt(params.get('page') || '1', 10));
  const [searchInput, setSearchInput] = React.useState(search);

  // Approve modal state
  const [approveModal, setApproveModal] = React.useState<ApproveModal | { open: false }>({ open: false });
  // Reject modal state
  const [rejectModal, setRejectModal]   = React.useState<RejectModal  | { open: false }>({ open: false });

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

  /* ── Approve mutation ── */
  const approveMut = useMutation({
    mutationFn: ({ id, amountPaid, adminNote }: { id: string; amountPaid: number; adminNote?: string }) =>
      fetch(`/api/admin/payouts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', amountPaid, adminNote }),
      }).then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || 'Failed');
        return json;
      }),
    onSuccess: () => {
      toast.success('Payout marked as paid');
      setApproveModal({ open: false });
      qc.invalidateQueries({ queryKey: ['admin', 'payouts'] });
    },
    onError: (err: unknown) => toast.error((err as Error)?.message || 'Could not approve'),
  });

  /* ── Reject mutation ── */
  const rejectMut = useMutation({
    mutationFn: ({ id, adminNote }: { id: string; adminNote: string }) =>
      fetch(`/api/admin/payouts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', adminNote }),
      }).then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || 'Failed');
        return json;
      }),
    onSuccess: () => {
      toast.success('Payout rejected');
      setRejectModal({ open: false });
      qc.invalidateQueries({ queryKey: ['admin', 'payouts'] });
    },
    onError: (err: unknown) => toast.error((err as Error)?.message || 'Could not reject'),
  });

  /* ── Cancel mutation ── */
  const cancelMut = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/admin/payouts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      }).then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || 'Failed');
        return json;
      }),
    onSuccess: () => {
      toast.success('Payout cancelled');
      qc.invalidateQueries({ queryKey: ['admin', 'payouts'] });
    },
    onError: (err: unknown) => toast.error((err as Error)?.message || 'Could not cancel'),
  });

  return (
    <>
      <PageHeader
        title="Payouts"
        description="Review and process creator withdrawal requests."
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
                  <SelectItem value="REJECTED">Rejected</SelectItem>
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
                  onApprove={() => setApproveModal({
                    open: true,
                    id: p.id,
                    amountAtRequest: parseFloat(p.amountAtRequest),
                    amountPaid: p.amountAtRequest,
                    adminNote: '',
                  })}
                  onReject={() => setRejectModal({ open: true, id: p.id, adminNote: '' })}
                  onCancel={() => {
                    if (confirm('Cancel this payout request?')) cancelMut.mutate(p.id);
                  }}
                  cancelling={cancelMut.isPending && cancelMut.variables === p.id}
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

      {/* ── Approve modal ── */}
      {approveModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div>
              <h2 className="font-semibold text-base flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" /> Approve payout
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Creator requested {formatMoney(approveModal.amountAtRequest)}. Enter the amount you actually paid.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Amount paid ($)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={approveModal.amountPaid}
                onChange={(e) => setApproveModal((m) => m.open ? { ...m, amountPaid: e.target.value } : m)}
                autoFocus
              />
              {(() => {
                const paid = parseFloat(approveModal.amountPaid);
                const req  = approveModal.amountAtRequest;
                if (Number.isFinite(paid) && paid < req) {
                  const penalty = req - paid;
                  return (
                    <p className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Penalty of {formatMoney(penalty)} will be recorded (requested − paid).
                    </p>
                  );
                }
                return null;
              })()}
            </div>

            <div className="space-y-1.5">
              <Label>Admin note (optional)</Label>
              <Input
                placeholder="e.g. Wire ref #123"
                value={approveModal.adminNote}
                onChange={(e) => setApproveModal((m) => m.open ? { ...m, adminNote: e.target.value } : m)}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setApproveModal({ open: false })} disabled={approveMut.isPending}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!approveModal.open) return;
                  const paid = parseFloat(approveModal.amountPaid);
                  if (!Number.isFinite(paid) || paid < 0) { toast.error('Enter a valid amount'); return; }
                  approveMut.mutate({ id: approveModal.id, amountPaid: paid, adminNote: approveModal.adminNote || undefined });
                }}
                disabled={approveMut.isPending}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {approveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Confirm payment
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ── Reject modal ── */}
      {rejectModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div>
              <h2 className="font-semibold text-base flex items-center gap-2">
                <XCircle className="h-4 w-4 text-destructive" /> Reject payout
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Provide a reason for rejection — the creator will see this.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Reason for rejection <span className="text-destructive">*</span></Label>
              <textarea
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                placeholder="e.g. Wallet address is invalid. Please resubmit with a correct address."
                value={rejectModal.adminNote}
                onChange={(e) => setRejectModal((m) => m.open ? { ...m, adminNote: e.target.value } : m)}
                autoFocus
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground text-right">{rejectModal.adminNote.length}/500</p>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setRejectModal({ open: false })} disabled={rejectMut.isPending}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (!rejectModal.open) return;
                  if (!rejectModal.adminNote.trim()) { toast.error('Reason is required'); return; }
                  rejectMut.mutate({ id: rejectModal.id, adminNote: rejectModal.adminNote.trim() });
                }}
                disabled={rejectMut.isPending}
              >
                {rejectMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                Reject payout
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

function PayoutRow({
  entry, onApprove, onReject, onCancel, cancelling,
}: {
  entry: PayoutEntry;
  onApprove: () => void;
  onReject: () => void;
  onCancel: () => void;
  cancelling: boolean;
}) {
  const [open, setOpen] = React.useState(entry.status === 'REQUESTED' || entry.status === 'IN_PROGRESS');
  const amountPaid  = entry.amountPaid  ? parseFloat(entry.amountPaid)  : null;
  const amountReq   = parseFloat(entry.amountAtRequest);
  const penalty     = entry.penalty     ? parseFloat(entry.penalty)     : null;

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
              <span className="text-xs text-muted-foreground">
                ({entry.employee.firstName}{entry.employee.lastName ? ' ' + entry.employee.lastName : ''})
              </span>
            )}
            <StatusBadge status={entry.status} />
          </div>

          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1">
              {entry.method === 'BANK' ? <Banknote className="h-3 w-3" /> : entry.method === 'CRYPTO' ? <Bitcoin className="h-3 w-3" /> : <Mail className="h-3 w-3" />}
              {entry.method === 'BANK' ? 'Bank transfer' : entry.method === 'CRYPTO' ? 'Crypto' : 'PayPal'}
            </span>
            <span>·</span>
            <span className="font-medium text-foreground">{formatMoney(amountReq)} requested</span>
            {amountPaid !== null && (
              <>
                <span>·</span>
                <span className="text-green-600 dark:text-green-400 font-medium">{formatMoney(amountPaid)} paid</span>
              </>
            )}
            {penalty !== null && penalty > 0 && (
              <>
                <span>·</span>
                <span className="text-orange-600 dark:text-orange-400">{formatMoney(penalty)} penalty</span>
              </>
            )}
            <span>·</span>
            <span>requested {formatRelative(entry.createdAt)}</span>
          </div>

          {entry.adminNote && (
            <p className="text-xs text-muted-foreground mt-1 italic">Admin note: {entry.adminNote}</p>
          )}

          {open && (
            <div className="mt-3 rounded-md border bg-muted/20 p-3 space-y-2">
              {Object.entries(entry.details).map(([k, v]) => (
                <DetailRow key={k} label={prettyLabel(k)} value={v} />
              ))}
              {entry.notes && <DetailRow label="Creator notes" value={entry.notes} />}
              {entry.employee.bioVerificationCode && (
                <DetailRow label="Bio code" value={entry.employee.bioVerificationCode} mono />
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {(entry.status === 'REQUESTED' || entry.status === 'IN_PROGRESS') && (
            <>
              <Button size="sm" onClick={onApprove} className="bg-green-600 hover:bg-green-700 text-white">
                <CheckCircle2 className="h-3.5 w-3.5" /> Approve
              </Button>
              <Button size="sm" variant="destructive" onClick={onReject}>
                <XCircle className="h-3.5 w-3.5" /> Reject
              </Button>
              <Button size="sm" variant="outline" onClick={onCancel} disabled={cancelling}>
                {cancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Cancel'}
              </Button>
            </>
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
  if (status === 'PAID')        return <Badge variant="success"     className="gap-1"><CheckCircle2 className="h-2.5 w-2.5" /> Paid</Badge>;
  if (status === 'REJECTED')    return <Badge variant="destructive" className="gap-1"><XCircle className="h-2.5 w-2.5" /> Rejected</Badge>;
  if (status === 'CANCELLED')   return <Badge variant="destructive" className="gap-1"><XCircle className="h-2.5 w-2.5" /> Cancelled</Badge>;
  if (status === 'IN_PROGRESS') return <Badge variant="warning"     className="gap-1"><Clock className="h-2.5 w-2.5" /> In progress</Badge>;
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
