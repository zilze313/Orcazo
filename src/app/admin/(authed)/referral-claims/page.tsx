'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Gift, CheckCircle2, XCircle, Loader2, Clock, AlertCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api-client';
import { formatMoney, formatRelative } from '@/lib/utils';

type ClaimStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface Claim {
  id: string;
  status: ClaimStatus;
  referralCount: number;
  threshold: number;
  rewardAmount: number;
  adminNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
  employee: {
    email: string;
    displayName: string;
  };
}

interface ClaimsResp {
  claims: Claim[];
}

type ResolveModal =
  | { open: false }
  | { open: true; id: string; action: 'approve'; adminNote: string }
  | { open: true; id: string; action: 'reject';  adminNote: string };

export default function AdminReferralClaimsPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = React.useState<ClaimStatus | 'all'>('PENDING');
  const [modal, setModal] = React.useState<ResolveModal>({ open: false });

  const query = useQuery<ClaimsResp>({
    queryKey: ['admin', 'referral-claims', statusFilter],
    queryFn: () => {
      const u = new URLSearchParams({ status: statusFilter });
      return api.get<ClaimsResp>(`/api/admin/referral-claims?${u.toString()}`);
    },
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  const resolveMut = useMutation({
    mutationFn: ({ id, action, adminNote }: { id: string; action: 'approve' | 'reject'; adminNote?: string }) =>
      fetch(`/api/admin/referral-claims/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, adminNote }),
      }).then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || 'Failed');
        return json;
      }),
    onSuccess: (_data, vars) => {
      toast.success(vars.action === 'approve' ? 'Claim approved' : 'Claim rejected');
      setModal({ open: false });
      qc.invalidateQueries({ queryKey: ['admin', 'referral-claims'] });
    },
    onError: (err: unknown) => toast.error((err as Error)?.message || 'Could not update claim'),
  });

  const pendingCount = query.data?.claims.filter((c) => c.status === 'PENDING').length ?? 0;

  return (
    <>
      <PageHeader
        title="Referral Claims"
        description="Review creator referral reward requests."
        actions={
          <div className="w-40">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ClaimStatus | 'all')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      <div className="container max-w-4xl py-6">
        {statusFilter === 'PENDING' && pendingCount > 0 && (
          <div className="mb-4 flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-md px-4 py-2.5">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {pendingCount} pending {pendingCount === 1 ? 'claim' : 'claims'} awaiting review
          </div>
        )}

        <Card>
          {query.isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
            </div>
          ) : (query.data?.claims.length ?? 0) === 0 ? (
            <EmptyState
              icon={Gift}
              title="No referral claims"
              description={statusFilter === 'PENDING' ? 'No pending claims to review.' : 'No claims match this filter.'}
            />
          ) : (
            <ul className="divide-y">
              {query.data!.claims.map((claim) => (
                <ClaimRow
                  key={claim.id}
                  claim={claim}
                  onApprove={() => setModal({ open: true, id: claim.id, action: 'approve', adminNote: '' })}
                  onReject={() => setModal({ open: true, id: claim.id, action: 'reject',  adminNote: '' })}
                />
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* ── Resolve Modal ── */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md p-6 space-y-5 shadow-2xl">
            {modal.action === 'approve' ? (
              <>
                <div>
                  <h2 className="font-semibold text-base flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" /> Approve claim
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Confirm the referral reward. The creator will see the claim as approved.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>Admin note (optional)</Label>
                  <input
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    placeholder="e.g. Payment sent via PayPal"
                    value={modal.adminNote}
                    onChange={(e) => setModal((m) => m.open ? { ...m, adminNote: e.target.value } : m)}
                    autoFocus
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setModal({ open: false })} disabled={resolveMut.isPending}>
                    Cancel
                  </Button>
                  <Button
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => {
                      if (!modal.open) return;
                      resolveMut.mutate({ id: modal.id, action: 'approve', adminNote: modal.adminNote || undefined });
                    }}
                    disabled={resolveMut.isPending}
                  >
                    {resolveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Approve
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <h2 className="font-semibold text-base flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-destructive" /> Reject claim
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Provide a reason — the creator will see this.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>Reason <span className="text-destructive">*</span></Label>
                  <textarea
                    className="flex min-h-[90px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                    placeholder="e.g. Referrals were not verified."
                    value={modal.adminNote}
                    onChange={(e) => setModal((m) => m.open ? { ...m, adminNote: e.target.value } : m)}
                    autoFocus
                    maxLength={500}
                  />
                  <p className="text-xs text-muted-foreground text-right">{modal.adminNote.length}/500</p>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setModal({ open: false })} disabled={resolveMut.isPending}>
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      if (!modal.open) return;
                      if (!modal.adminNote.trim()) { toast.error('Reason is required'); return; }
                      resolveMut.mutate({ id: modal.id, action: 'reject', adminNote: modal.adminNote.trim() });
                    }}
                    disabled={resolveMut.isPending}
                  >
                    {resolveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                    Reject
                  </Button>
                </div>
              </>
            )}
          </Card>
        </div>
      )}
    </>
  );
}

function ClaimRow({ claim, onApprove, onReject }: { claim: Claim; onApprove: () => void; onReject: () => void }) {
  return (
    <li className="p-4">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{claim.employee.displayName}</span>
            {claim.employee.displayName !== claim.employee.email && (
              <span className="text-xs text-muted-foreground">{claim.employee.email}</span>
            )}
            <ClaimBadge status={claim.status} />
          </div>

          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
            <span>
              {claim.referralCount}/{claim.threshold} qualified referrals
            </span>
            <span>·</span>
            <span className="font-medium text-foreground">{formatMoney(claim.rewardAmount)} reward</span>
            <span>·</span>
            <span>submitted {formatRelative(claim.createdAt)}</span>
            {claim.resolvedAt && (
              <>
                <span>·</span>
                <span>resolved {formatRelative(claim.resolvedAt)}</span>
              </>
            )}
          </div>

          {claim.adminNote && (
            <p className="text-xs text-muted-foreground mt-1.5 italic">
              Note: {claim.adminNote}
            </p>
          )}
        </div>

        {claim.status === 'PENDING' && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={onApprove}>
              <CheckCircle2 className="h-3.5 w-3.5" /> Approve
            </Button>
            <Button size="sm" variant="destructive" onClick={onReject}>
              <XCircle className="h-3.5 w-3.5" /> Reject
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}

function ClaimBadge({ status }: { status: ClaimStatus }) {
  if (status === 'APPROVED') return <Badge variant="success"     className="gap-1"><CheckCircle2 className="h-2.5 w-2.5" /> Approved</Badge>;
  if (status === 'REJECTED') return <Badge variant="destructive" className="gap-1"><XCircle className="h-2.5 w-2.5" /> Rejected</Badge>;
  return <Badge variant="warning" className="gap-1"><Clock className="h-2.5 w-2.5" /> Pending</Badge>;
}
