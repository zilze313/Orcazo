'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, Gift, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api-client';

interface Referral {
  id: string;
  name: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  date: string;
  code: string;
}

interface ReferralsResp {
  code: string | null;
  totalReferred: number;
  referrals: Referral[];
}

const STATUS_META: Record<string, { variant: 'success' | 'warning' | 'destructive'; label: string; icon: React.ComponentType<{ className?: string }> }> = {
  APPROVED: { variant: 'success', label: 'Approved', icon: CheckCircle2 },
  PENDING:  { variant: 'warning', label: 'Pending',  icon: Clock },
  REJECTED: { variant: 'destructive', label: 'Rejected', icon: XCircle },
};

export default function ReferralsPage() {
  const query = useQuery<ReferralsResp>({
    queryKey: ['referrals'],
    queryFn: () => api.get<ReferralsResp>('/api/referrals'),
    staleTime: 60_000,
  });

  return (
    <>
      <PageHeader
        title="Referrals"
        description="Track signups from your referral code."
      />
      <div className="container max-w-4xl py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="p-5">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
              <Gift className="h-4 w-4" /> Your referral code
            </div>
            {query.isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-lg font-semibold font-mono">
                {query.data?.code ?? <span className="text-muted-foreground text-sm font-sans">No code assigned</span>}
              </div>
            )}
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
              <Users className="h-4 w-4" /> Total referred
            </div>
            {query.isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-semibold tabular-nums">
                {query.data?.totalReferred ?? 0}
              </div>
            )}
          </Card>
        </div>

        {/* Table */}
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
                  <TableHead>Code used</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.referrals.map((r) => {
                  const meta = STATUS_META[r.status] ?? STATUS_META.PENDING;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">{r.code}</TableCell>
                      <TableCell>
                        <Badge variant={meta.variant} className="text-[10px]">
                          {meta.label}
                        </Badge>
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
