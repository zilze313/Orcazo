'use client';

// Collab request queue. Flow per request:
// REQUESTED → you send the invite from the platform app → mark "Invited"
// → creator accepts on the platform and confirms → ACCEPTED
// → you verify the collaborator shows on the post → Approve (credits bounty).

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  Handshake, CheckCircle2, Clock, Loader2, ExternalLink, Send, XCircle, UserCheck,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import { PaginationBar } from '@/components/pagination-bar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlatformIcon } from '@/components/platform-icon';
import { api } from '@/lib/api-client';
import { formatMoney, formatNumber, formatRelative } from '@/lib/utils';

type Status = 'REQUESTED' | 'INVITED' | 'ACCEPTED' | 'APPROVED' | 'REJECTED';

interface CollabRow {
  id: string;
  handle: string;
  platform: string | null;
  followers: number | null;
  status: Status;
  bountyPaid: number | null;
  adminNote: string | null;
  createdAt: string;
  employee: { id: string; email: string; firstName: string | null };
  post: { id: string; postUrl: string; collabSlots: number; account: { platform: string; label: string } };
}
interface ListResp {
  items: CollabRow[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

function statusBadge(status: Status) {
  switch (status) {
    case 'REQUESTED': return <Badge variant="warning" className="gap-1 text-[10px]"><Clock className="h-2.5 w-2.5" /> Requested</Badge>;
    case 'INVITED':   return <Badge variant="secondary" className="gap-1 text-[10px]"><Send className="h-2.5 w-2.5" /> Invited</Badge>;
    case 'ACCEPTED':  return <Badge variant="warning" className="gap-1 text-[10px]"><UserCheck className="h-2.5 w-2.5" /> Accepted — verify</Badge>;
    case 'APPROVED':  return <Badge variant="success" className="gap-1 text-[10px]"><CheckCircle2 className="h-2.5 w-2.5" /> Approved</Badge>;
    case 'REJECTED':  return <Badge variant="destructive" className="gap-1 text-[10px]"><XCircle className="h-2.5 w-2.5" /> Rejected</Badge>;
  }
}

export default function RepostCollabsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const status = (params.get('status') as Status | 'all') ?? 'REQUESTED';
  const page = Math.max(1, parseInt(params.get('page') || '1', 10));

  const list = useQuery<ListResp>({
    queryKey: ['admin', 'repost-collabs', status, page],
    queryFn: () => api.get(`/api/admin/repost/collab-requests?status=${status === 'all' ? '' : status}&page=${page}&pageSize=25`),
    staleTime: 5_000,
  });

  const setUrlParam = (key: string, value: string) => {
    const u = new URLSearchParams(params);
    u.set(key, value);
    if (key !== 'page') u.set('page', '1');
    router.replace(`/admin/reposting/collabs?${u.toString()}`, { scroll: false });
  };

  const [busyId, setBusyId] = React.useState<string | null>(null);

  async function act(id: string, body: Record<string, unknown>, success: string) {
    setBusyId(id);
    try {
      await api.patch(`/api/admin/repost/collab-requests/${id}`, body);
      toast.success(success);
      qc.invalidateQueries({ queryKey: ['admin', 'repost-collabs'] });
    } catch (e) {
      toast.error((e as Error)?.message || 'Failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Collab Requests"
        description="Creators asking to be added as collaborators on your posts. Send the invite from the platform app, mark it Invited, then Approve once you see them on the post."
        actions={
          <div className="w-44">
            <Select value={status} onValueChange={(v) => setUrlParam('status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="REQUESTED">Requested</SelectItem>
                <SelectItem value="INVITED">Invited</SelectItem>
                <SelectItem value="ACCEPTED">Accepted</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      <div className="container max-w-5xl py-6">
        {list.isLoading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
        ) : (list.data?.items.length ?? 0) === 0 ? (
          <EmptyState icon={Handshake} title="No collab requests here" description="Creator collab requests will show up in this queue." />
        ) : (
          <div className="space-y-2">
            {list.data!.items.map((r) => (
              <CollabCard key={r.id} row={r} busy={busyId === r.id} onAct={act} />
            ))}
          </div>
        )}
        {list.data && list.data.items.length > 0 && (
          <div className="mt-4">
            <PaginationBar
              page={list.data.pagination.page}
              totalPages={list.data.pagination.totalPages}
              total={list.data.pagination.total}
              onPageChange={(p) => setUrlParam('page', String(p))}
            />
          </div>
        )}
      </div>
    </>
  );
}

function CollabCard({
  row, busy, onAct,
}: {
  row: CollabRow;
  busy: boolean;
  onAct: (id: string, body: Record<string, unknown>, success: string) => void;
}) {
  const [note, setNote] = React.useState(row.adminNote ?? '');
  const [bounty, setBounty] = React.useState('');
  const name = row.employee.firstName || row.employee.email.split('@')[0];

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3 flex-wrap">
        <PlatformIcon platform={row.platform || row.post.account.platform} className="h-5 w-5 flex-shrink-0 text-muted-foreground mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{name}</span>
            <span className="text-xs text-muted-foreground">{row.employee.email}</span>
            {statusBadge(row.status)}
            {row.bountyPaid != null && (
              <span className="text-xs font-semibold text-green-600 dark:text-green-400 tabular-nums">{formatMoney(row.bountyPaid)}</span>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Invite <span className="font-semibold text-foreground">@{row.handle}</span>
            {row.followers != null && <> · {formatNumber(row.followers)} followers (self-reported)</>}
            {' · '}{row.post.account.label} · {formatRelative(row.createdAt)}
          </div>
          <a href={row.post.postUrl} target="_blank" rel="noopener noreferrer" className="mt-1.5 text-xs text-primary hover:underline inline-flex items-center gap-1 break-all">
            <ExternalLink className="h-3 w-3 flex-shrink-0" /> {row.post.postUrl}
          </a>
        </div>
      </div>

      {(row.status === 'REQUESTED' || row.status === 'INVITED' || row.status === 'ACCEPTED') && (
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <Input
            className="flex-1 min-w-[180px] h-9 text-xs"
            placeholder="Optional note (shown to the creator on reject)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {row.status === 'REQUESTED' && (
            <Button size="sm" onClick={() => onAct(row.id, { action: 'invited', adminNote: note || null }, 'Marked invited — creator notified')} disabled={busy}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Invite sent
            </Button>
          )}
          {(row.status === 'INVITED' || row.status === 'ACCEPTED') && (
            <div className="flex items-center gap-2">
              <Input
                className="w-24 h-9 text-xs tabular-nums"
                type="number" min="0" step="0.01"
                placeholder="Auto $"
                title="Leave empty to use the tier bounty"
                value={bounty}
                onChange={(e) => setBounty(e.target.value)}
              />
              <Button
                size="sm"
                onClick={() => onAct(
                  row.id,
                  { action: 'approve', ...(bounty.trim() ? { bounty: parseFloat(bounty) } : {}), adminNote: note || null },
                  'Approved — bounty credited',
                )}
                disabled={busy}
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Approve
              </Button>
            </div>
          )}
          <Button size="sm" variant="destructive" onClick={() => onAct(row.id, { action: 'reject', adminNote: note || null }, 'Rejected')} disabled={busy}>
            <XCircle className="h-3.5 w-3.5" /> Reject
          </Button>
        </div>
      )}
      {row.status === 'APPROVED' && row.adminNote && (
        <p className="mt-2 text-xs text-muted-foreground italic">{row.adminNote}</p>
      )}
    </Card>
  );
}
