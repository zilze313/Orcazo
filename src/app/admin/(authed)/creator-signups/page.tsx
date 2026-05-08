'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  UserPlus, Search, CheckCircle2, XCircle, Clock, Loader2, ChevronDown, ChevronRight,
  Trash2, Mail, MessageCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import { PaginationBar } from '@/components/pagination-bar';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { PlatformIcon, PLATFORM_LABELS } from '@/components/platform-icon';
import { api } from '@/lib/api-client';
import { formatRelative } from '@/lib/utils';

type Status = 'PENDING' | 'APPROVED' | 'REJECTED';

interface SocialAccount { platform: string; handle: string }

interface SignupEntry {
  id: string;
  publicEmail: string;
  fullName: string;
  whatsapp: string;
  socialAccounts: SocialAccount[];
  status: Status;
  rejectionReason: string | null;
  connectedProxyEmail: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

interface ListResp {
  entries: SignupEntry[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

interface ManagedEntry { id: string; email: string; note: string | null }

export default function CreatorSignupsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();

  const search = params.get('search') ?? '';
  const status = (params.get('status') as Status | 'all') ?? 'PENDING';
  const page   = Math.max(1, parseInt(params.get('page') || '1', 10));
  const [searchInput, setSearchInput] = React.useState(search);

  React.useEffect(() => {
    const t = setTimeout(() => {
      const u = new URLSearchParams(params);
      if (searchInput) u.set('search', searchInput); else u.delete('search');
      u.set('page', '1');
      router.replace(`/admin/creator-signups?${u.toString()}`, { scroll: false });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const list = useQuery<ListResp>({
    queryKey: ['admin', 'creator-signups', search, status, page],
    queryFn: () => {
      const u = new URLSearchParams({ page: String(page), pageSize: '25', status });
      if (search) u.set('search', search);
      return api.get<ListResp>(`/api/admin/creator-signups?${u.toString()}`);
    },
    staleTime: 0,
    refetchInterval: 7_000,
  });

  const setUrlParam = (key: string, value: string) => {
    const u = new URLSearchParams(params);
    u.set(key, value);
    if (key !== 'page') u.set('page', '1');
    router.replace(`/admin/creator-signups?${u.toString()}`, { scroll: false });
  };

  const [approveTarget, setApproveTarget] = React.useState<SignupEntry | null>(null);
  const [rejectTarget,  setRejectTarget]  = React.useState<SignupEntry | null>(null);

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.del<{ ok: true }>(`/api/admin/creator-signups/${id}`),
    onSuccess: () => {
      toast.success('Application deleted');
      qc.invalidateQueries({ queryKey: ['admin', 'creator-signups'] });
    },
    onError: (err: unknown) => toast.error((err as Error)?.message || 'Could not delete'),
  });

  return (
    <>
      <PageHeader
        title="Creator signups"
        description="Review applications from creators who applied via the public site."
        actions={
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search email, name…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="w-32">
              <Select value={status} onValueChange={(v) => setUrlParam('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
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
              icon={UserPlus}
              title="No signup requests"
              description={search ? 'Try a different search term.' : 'Applications from creators will show up here.'}
            />
          ) : (
            <ul className="divide-y">
              {list.data!.entries.map((e) => (
                <SignupRow
                  key={e.id}
                  entry={e}
                  onApprove={() => setApproveTarget(e)}
                  onReject={() => setRejectTarget(e)}
                  onDelete={() => {
                    if (confirm(`Delete application from ${e.publicEmail}? This cannot be undone.`)) {
                      deleteMut.mutate(e.id);
                    }
                  }}
                  deleting={deleteMut.isPending && deleteMut.variables === e.id}
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

      <ApproveDialog
        entry={approveTarget}
        onClose={() => setApproveTarget(null)}
        onSuccess={() => {
          setApproveTarget(null);
          qc.invalidateQueries({ queryKey: ['admin', 'creator-signups'] });
          qc.invalidateQueries({ queryKey: ['admin', 'allowlist'] });
          qc.invalidateQueries({ queryKey: ['admin', 'managed-emails'] });
        }}
      />
      <RejectDialog
        entry={rejectTarget}
        onClose={() => setRejectTarget(null)}
        onSuccess={() => {
          setRejectTarget(null);
          qc.invalidateQueries({ queryKey: ['admin', 'creator-signups'] });
        }}
      />
    </>
  );
}

function SignupRow({
  entry, onApprove, onReject, onDelete, deleting,
}: {
  entry: SignupEntry;
  onApprove: () => void;
  onReject:  () => void;
  onDelete:  () => void;
  deleting: boolean;
}) {
  const [open, setOpen] = React.useState(false);

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
            <span className="font-medium text-sm">{entry.fullName}</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground truncate">{entry.publicEmail}</span>
            <StatusBadge status={entry.status} />
          </div>
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
            <MessageCircle className="h-3 w-3" /> {entry.whatsapp}
            <span>·</span>
            <span>applied {formatRelative(entry.createdAt)}</span>
            <span>·</span>
            <span>{entry.socialAccounts.length} social{entry.socialAccounts.length === 1 ? '' : 's'}</span>
          </div>
          {open && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {entry.socialAccounts.map((s, i) => (
                <a
                  key={i}
                  href={socialUrl(s.platform, s.handle)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm border rounded-md px-3 py-2 hover:bg-muted/30"
                >
                  <PlatformIcon platform={s.platform} className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">@{s.handle}</span>
                  <span className="text-xs text-muted-foreground ml-auto capitalize">{PLATFORM_LABELS[s.platform] ?? s.platform}</span>
                </a>
              ))}
              {entry.connectedProxyEmail && (
                <div className="sm:col-span-2 text-xs text-muted-foreground">
                  Connected proxy: <code className="font-mono">{entry.connectedProxyEmail}</code>
                </div>
              )}
              {entry.rejectionReason && (
                <div className="sm:col-span-2 text-xs">
                  <span className="text-muted-foreground">Reason: </span>
                  <span>{entry.rejectionReason}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {entry.status === 'PENDING' ? (
            <>
              <Button size="sm" onClick={onApprove}>
                <CheckCircle2 className="h-3.5 w-3.5" /> Approve
              </Button>
              <Button size="sm" variant="outline" onClick={onReject}>
                <XCircle className="h-3.5 w-3.5" /> Reject
              </Button>
            </>
          ) : (
            <Button
              size="icon"
              variant="ghost"
              onClick={onDelete}
              disabled={deleting}
              title="Delete this application"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

function StatusBadge({ status }: { status: Status }) {
  if (status === 'APPROVED') return <Badge variant="success" className="gap-1"><CheckCircle2 className="h-2.5 w-2.5" /> Approved</Badge>;
  if (status === 'REJECTED') return <Badge variant="destructive" className="gap-1"><XCircle className="h-2.5 w-2.5" /> Rejected</Badge>;
  return <Badge variant="warning" className="gap-1"><Clock className="h-2.5 w-2.5" /> Pending</Badge>;
}

function socialUrl(platform: string, handle: string): string {
  const h = handle.replace(/^@/, '');
  switch (platform) {
    case 'instagram': return `https://www.instagram.com/${h}`;
    case 'tiktok':    return `https://www.tiktok.com/@${h}`;
    case 'youtube':   return `https://www.youtube.com/@${h}`;
    case 'snapchat':  return `https://www.snapchat.com/add/${h}`;
    case 'x':         return `https://x.com/${h}`;
    case 'facebook':  return `https://www.facebook.com/${h}`;
    default:          return `#${h}`;
  }
}

function ApproveDialog({
  entry, onClose, onSuccess,
}: {
  entry: SignupEntry | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const open = !!entry;
  const [proxyEmail, setProxyEmail] = React.useState<string>('');

  // Available proxy emails (managed pool, minus already-connected)
  const available = useQuery<{ entries: ManagedEntry[] }>({
    queryKey: ['admin', 'managed-emails-available'],
    queryFn:  () => api.get<{ entries: ManagedEntry[] }>('/api/admin/managed-emails?available=true'),
    enabled:  open,
    staleTime: 5_000,
  });

  React.useEffect(() => {
    if (!open) setProxyEmail('');
  }, [open]);

  const mut = useMutation({
    mutationFn: (id: string) =>
      api.post<{ ok: true }>(`/api/admin/creator-signups/${id}?action=approve`, { proxyEmail }),
    onSuccess: () => {
      toast.success('Creator approved and connected');
      onSuccess();
    },
    onError: (err: unknown) => toast.error((err as Error)?.message || 'Could not approve'),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Approve creator</DialogTitle>
          <DialogDescription>
            {entry && <>Connect <strong>{entry.publicEmail}</strong> to one of your AffiliateNetwork emails. The creator will see only their own email in the UI.</>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Proxy email (the AffiliateNetwork email to use behind the scenes)</Label>
            {available.isLoading ? (
              <Skeleton className="h-10" />
            ) : (available.data?.entries.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">
                No available proxy emails. Add one on the{' '}
                <a className="underline" href="/admin/managed-emails">Managed Emails</a> page first.
              </p>
            ) : (
              <Select value={proxyEmail} onValueChange={setProxyEmail}>
                <SelectTrigger><SelectValue placeholder="Pick a managed email" /></SelectTrigger>
                <SelectContent>
                  {available.data!.entries.map((m) => (
                    <SelectItem key={m.id} value={m.email}>{m.email}{m.note ? ` — ${m.note}` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mut.isPending}>Cancel</Button>
          <Button
            disabled={!proxyEmail || mut.isPending}
            onClick={() => entry && mut.mutate(entry.id)}
          >
            {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Approve & connect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RejectDialog({
  entry, onClose, onSuccess,
}: {
  entry: SignupEntry | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const open = !!entry;
  const [reason, setReason] = React.useState('');

  React.useEffect(() => { if (!open) setReason(''); }, [open]);

  const mut = useMutation({
    mutationFn: (id: string) =>
      api.post<{ ok: true }>(`/api/admin/creator-signups/${id}?action=reject`, { reason: reason || undefined }),
    onSuccess: () => {
      toast.success('Application rejected — email sent');
      onSuccess();
    },
    onError: (err: unknown) => toast.error((err as Error)?.message || 'Could not reject'),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject application</DialogTitle>
          <DialogDescription>
            {entry && <>An automated email will be sent to <strong>{entry.publicEmail}</strong>.</>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="reason">Reason (optional, included in the email)</Label>
          <Input
            id="reason"
            placeholder="e.g. Accounts have less than 500 followers"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            <Mail className="h-3 w-3 inline mr-1" /> Leave blank to send a generic rejection.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mut.isPending}>Cancel</Button>
          <Button
            variant="destructive"
            disabled={mut.isPending}
            onClick={() => entry && mut.mutate(entry.id)}
          >
            {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
            Reject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
