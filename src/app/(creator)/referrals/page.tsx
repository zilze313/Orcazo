'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Users, CheckCircle2, Clock, XCircle, Copy, Check,
  Lock, Unlock, Gift, Loader2, AlertCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api-client';
import { formatMoney } from '@/lib/utils';

interface Referral {
  id: string;
  name: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  date: string;
  code: string;
  earnings: number;
  qualified: boolean;
}

interface LatestClaim {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rewardAmount: number;
  adminNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

interface ReferralsResp {
  code: string | null;
  totalReferred: number;
  qualifiedReferrals: number;
  referrals: Referral[];
  reward: {
    threshold: number;
    amount: number;
    qualifyEarnings: number;
    thresholdMet: boolean;
    canClaim: boolean;
    latestClaim: LatestClaim | null;
  };
}

const STATUS_META: Record<string, { variant: 'success' | 'warning' | 'destructive'; label: string; icon: React.ComponentType<{ className?: string }> }> = {
  APPROVED: { variant: 'success',     label: 'Approved', icon: CheckCircle2 },
  PENDING:  { variant: 'warning',     label: 'Pending',  icon: Clock },
  REJECTED: { variant: 'destructive', label: 'Rejected', icon: XCircle },
};

export default function ReferralsPage() {
  const qc = useQueryClient();
  const query = useQuery<ReferralsResp>({
    queryKey: ['referrals'],
    queryFn: () => api.get<ReferralsResp>('/api/referrals'),
    staleTime: 60_000,
  });
  const [copied, setCopied] = React.useState(false);

  const claimMut = useMutation({
    mutationFn: () => api.post<{ ok: true }>('/api/referrals/claim', {}),
    onSuccess: () => {
      toast.success('Claim request submitted! Our team will review it soon.');
      qc.invalidateQueries({ queryKey: ['referrals'] });
    },
    onError: (err: unknown) => toast.error((err as Error)?.message || 'Could not submit claim'),
  });

  const copyCode = () => {
    if (!query.data?.code) return;
    navigator.clipboard.writeText(query.data.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const reward     = query.data?.reward;
  const total      = query.data?.totalReferred ?? 0;
  const qualified  = query.data?.qualifiedReferrals ?? 0;
  const threshold  = reward?.threshold ?? 3;
  const qualifyEarnings = reward?.qualifyEarnings ?? 100;
  const progress   = Math.min(100, Math.round((qualified / threshold) * 100));
  const unlocked   = reward?.thresholdMet ?? false;
  const canClaim   = reward?.canClaim ?? false;
  const claim      = reward?.latestClaim ?? null;

  return (
    <>
      <PageHeader
        title="Referrals"
        description="Share your code — every approved signup brings you closer to a reward."
      />
      <div className="container max-w-4xl py-6 space-y-6">

        {/* ── Referral code card ── */}
        <Card className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-3">
            <Gift className="h-4 w-4" /> Your referral code
          </div>
          {query.isLoading ? (
            <Skeleton className="h-10 w-40" />
          ) : (
            <div className="flex items-center gap-2">
              <code className="text-base font-semibold font-mono bg-secondary px-3 py-1.5 rounded-md tracking-wide">
                {query.data?.code ?? '—'}
              </code>
              <button
                onClick={copyCode}
                disabled={!query.data?.code}
                className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-40"
                title="Copy code"
              >
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          )}
        </Card>

        {/* ── Treasure / reward card ── */}
        <Card className={`p-6 border-2 transition-colors ${unlocked ? 'border-yellow-400 dark:border-yellow-500 bg-yellow-50/50 dark:bg-yellow-950/20' : 'border-dashed'}`}>
          {query.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-3 w-full" />
            </div>
          ) : (
            <>
              {/* Treasure icon + headline */}
              <div className="flex items-center gap-3 mb-4">
                <div className={`text-4xl select-none transition-all ${unlocked ? 'grayscale-0' : 'grayscale opacity-50'}`}>
                  {unlocked ? '🎁' : '🔒'}
                </div>
                <div>
                  <h3 className="font-bold text-lg leading-tight">
                    {unlocked ? 'Reward unlocked!' : `Unlock your ${formatMoney(reward?.amount ?? 100)} reward`}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {unlocked
                      ? `${qualified} of your referrals have each earned ${formatMoney(qualifyEarnings)}+ — the reward is yours to claim.`
                      : `Refer ${threshold - qualified} more creator${threshold - qualified === 1 ? '' : 's'} who each earn ${formatMoney(qualifyEarnings)}+ to unlock ${formatMoney(reward?.amount ?? 100)}.`
                    }
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                  <span>{qualified} / {threshold} qualified referrals</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-3 rounded-full bg-secondary overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${unlocked ? 'bg-yellow-400 dark:bg-yellow-500' : 'bg-primary'}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground mb-4">
                A referral counts only after they've earned {formatMoney(qualifyEarnings)} or more on the platform.
                {total > qualified && (
                  <> You currently have {total} signup{total === 1 ? '' : 's'} — {total - qualified} still need to reach the earnings threshold.</>
                )}
              </p>

              {/* Claim state */}
              {!unlocked && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Lock className="h-4 w-4" />
                  {threshold - qualified} more qualified referral{threshold - qualified === 1 ? '' : 's'} to unlock
                </div>
              )}

              {unlocked && canClaim && (
                <Button
                  onClick={() => claimMut.mutate()}
                  disabled={claimMut.isPending}
                  className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold gap-2"
                >
                  {claimMut.isPending
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Unlock className="h-4 w-4" />
                  }
                  Submit claim request
                </Button>
              )}

              {unlocked && !canClaim && claim && (
                <ClaimStatusBanner claim={claim} />
              )}
            </>
          )}
        </Card>

        {/* ── Referral list ── */}
        <Card className="overflow-x-auto">
          {query.isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : !query.data || query.data.referrals.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No referrals yet"
              description="Share your referral code with other creators to start earning referral rewards."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Earned</TableHead>
                  <TableHead>Qualified</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.referrals.map((r) => {
                  const meta = STATUS_META[r.status] ?? STATUS_META.PENDING;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>
                        <Badge variant={meta.variant} className="text-[10px]">
                          {meta.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {formatMoney(r.earnings)}
                        <span className="text-muted-foreground"> / {formatMoney(qualifyEarnings)}</span>
                      </TableCell>
                      <TableCell>
                        {r.qualified ? (
                          <Badge variant="success" className="text-[10px] gap-1">
                            <CheckCircle2 className="h-2.5 w-2.5" /> Qualified
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">Not yet</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(r.date).toLocaleDateString()}
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

function ClaimStatusBanner({ claim }: { claim: LatestClaim }) {
  if (claim.status === 'PENDING') {
    return (
      <div className="flex items-start gap-2 rounded-md bg-yellow-100 dark:bg-yellow-950/40 border border-yellow-300 dark:border-yellow-700 px-4 py-3 text-sm">
        <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-medium">Claim under review</span>
          <p className="text-xs text-muted-foreground mt-0.5">
            We received your claim request and our team is reviewing it. You'll be notified once it's processed.
          </p>
        </div>
      </div>
    );
  }
  if (claim.status === 'APPROVED') {
    return (
      <div className="flex items-start gap-2 rounded-md bg-green-50 dark:bg-green-950/30 border border-green-300 dark:border-green-700 px-4 py-3 text-sm">
        <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-medium text-green-700 dark:text-green-400">
            Claim approved — {formatMoney(claim.rewardAmount)} paid
          </span>
          {claim.adminNote && (
            <p className="text-xs text-muted-foreground mt-0.5">{claim.adminNote}</p>
          )}
        </div>
      </div>
    );
  }
  // REJECTED — can resubmit
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-700 px-4 py-3 text-sm">
        <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-medium text-red-700 dark:text-red-400">Claim rejected</span>
          {claim.adminNote && (
            <p className="text-xs text-muted-foreground mt-0.5">{claim.adminNote}</p>
          )}
        </div>
      </div>
    </div>
  );
}
