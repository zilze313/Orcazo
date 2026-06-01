'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  Mail, Search, ChevronDown, ChevronRight, Loader2,
  CheckCircle2, XCircle, RotateCcw, Trash2, Copy, ExternalLink,
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
import { formatRelative } from '@/lib/utils';

type Status = 'NEW' | 'RESOLVED' | 'DISMISSED';

interface Entry {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  employeeId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  status: Status;
  adminNote: string | null;
  resolvedAt: string | null;
  dismissedAt: string | null;
  createdAt: string;
}

interface ListResp {
  entries: Entry[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export default function ContactMessagesPage() {
  const router = useRouter();
  const params = useSearchParams();
  const qc     = useQueryClient();

  const search = params.get('search') ?? '';
  const status = (params.get('status') as Status | 'all') ?? 'NEW';
  const page   = Math.max(1, parseInt(params.get('page') || '1', 10));
  const [searchInput, setSearchInput] = React.useState(search);

  React.useEffect(() => {
    const t = setTimeout(() => {
      const u = new URLSearchParams(params);
      if (searchInput) u.set('search', searchInput); else u.delete('search');
      u.set('page', '1');
      router.replace(`/admin/contact-messages?${u.toString()}`, { scroll: false });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const list = useQuery<ListResp>({
    queryKey: ['admin', 'contact-messages', search, status, page],
    queryFn: () => {
      const u = new URLSearchParams({ page: String(page), pageSize: '25', status });
      if (search) u.set('search', search);
      return api.get<ListResp>(`/api/admin/contact-messages?${u.toString()}`);
    },
    staleTime: 0,
    refetchInterval: 7_000,
  });

  const setUrlParam = (key: string, value: string) => {
    const u = new URLSearchParams(params);
    u.set(key, value);
    if (key !== 'page') u.set('page', '1');
    router.replace(`/admin/contact-messages?${u.toString()}`, { scroll: false });
  };

  const actionMut = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'resolve' | 'dismiss' | 'reopen' }) =>
      fetch(`/api/admin/contact-messages/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      }).then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || 'Failed');
        return json;
      }),
    onSuccess: (_d, vars) => {
      toast.success(
        vars.action === 'resolve' ? 'Marked as resolved'
          : vars.action === 'dismiss' ? 'Dismissed'
          : 'Reopened',
      );
      qc.invalidateQueries({ queryKey: ['admin', 'contact-messages'] });
    },
    onError: (err: unknown) => toast.error((err as Error)?.message || 'Could not update'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/admin/contact-messages/${id}`, { method: 'DELETE' }).then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || 'Failed');
        return json;
      }),
    onSuccess: () => {
      toast.success('Message deleted');
      qc.invalidateQueries({ queryKey: ['admin', 'contact-messages'] });
    },
    onError: (err: unknown) => toast.error((err as Error)?.message || 'Could not delete'),
  });

  return (
    <>
      <PageHeader
        title="Contact messages"
        description="Submissions from the public /contact form."
        actions={
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search name, email, subject…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="w-36">
              <Select value={status} onValueChange={(v) => setUrlParam('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NEW">New</SelectItem>
                  <SelectItem value="RESOLVED">Resolved</SelectItem>
                  <SelectItem value="DISMISSED">Dismissed</SelectItem>
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
              icon={Mail}
              title="No messages"
              description={search ? 'Try a different search term.' : 'Public contact-form submissions show up here.'}
            />
          ) : (
            <ul className="divide-y">
              {list.data!.entries.map((e) => (
                <Row
                  key={e.id}
                  entry={e}
                  onResolve={() => actionMut.mutate({ id: e.id, action: 'resolve' })}
                  onDismiss={() => actionMut.mutate({ id: e.id, action: 'dismiss' })}
                  onReopen={()  => actionMut.mutate({ id: e.id, action: 'reopen'  })}
                  onDelete={() => {
                    if (confirm('Permanently delete this message?')) deleteMut.mutate(e.id);
                  }}
                  pending={
                    (actionMut.isPending && actionMut.variables?.id === e.id) ||
                    (deleteMut.isPending && deleteMut.variables === e.id)
                  }
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

function Row({
  entry, onResolve, onDismiss, onReopen, onDelete, pending,
}: {
  entry: Entry;
  onResolve: () => void;
  onDismiss: () => void;
  onReopen: () => void;
  onDelete: () => void;
  pending: boolean;
}) {
  const [open, setOpen] = React.useState(entry.status === 'NEW');
  const [copied, setCopied] = React.useState(false);

  const replyMailto = `mailto:${entry.email}?subject=${encodeURIComponent('Re: ' + entry.subject)}`;

  function copyEmail() {
    navigator.clipboard.writeText(entry.email).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  }

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
            <span className="font-medium text-sm">{entry.name}</span>
            <span className="text-xs text-muted-foreground">{entry.email}</span>
            <StatusBadge status={entry.status} />
            {entry.employeeId && (
              <Badge variant="secondary" className="text-[10px]">Creator</Badge>
            )}
          </div>

          <div className="text-sm mt-1.5 font-medium">{entry.subject}</div>

          <div className="text-xs text-muted-foreground mt-1">
            received {formatRelative(entry.createdAt)}
            {entry.resolvedAt && <> · resolved {formatRelative(entry.resolvedAt)}</>}
            {entry.dismissedAt && <> · dismissed {formatRelative(entry.dismissedAt)}</>}
          </div>

          {entry.adminNote && (
            <p className="text-xs text-muted-foreground mt-1 italic">Note: {entry.adminNote}</p>
          )}

          {open && (
            <div className="mt-3 rounded-md border bg-muted/20 p-3 text-sm whitespace-pre-wrap break-words">
              {entry.message}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <Button size="sm" variant="outline" asChild>
            <a href={replyMailto} target="_blank" rel="noopener noreferrer" title="Reply by email">
              <ExternalLink className="h-3.5 w-3.5" /> Reply
            </a>
          </Button>
          <Button size="sm" variant="ghost" onClick={copyEmail} title="Copy email">
            {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
          {entry.status === 'NEW' && (
            <>
              <Button size="sm" onClick={onResolve} disabled={pending} className="bg-green-600 hover:bg-green-700 text-white">
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Resolve
              </Button>
              <Button size="sm" variant="outline" onClick={onDismiss} disabled={pending} title="Dismiss (spam / no reply needed)">
                <XCircle className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          {entry.status !== 'NEW' && (
            <Button size="sm" variant="outline" onClick={onReopen} disabled={pending} title="Reopen">
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onDelete} disabled={pending} className="text-destructive hover:text-destructive" title="Delete permanently">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </li>
  );
}

function StatusBadge({ status }: { status: Status }) {
  if (status === 'RESOLVED')  return <Badge variant="success"     className="gap-1"><CheckCircle2 className="h-2.5 w-2.5" /> Resolved</Badge>;
  if (status === 'DISMISSED') return <Badge variant="destructive" className="gap-1"><XCircle className="h-2.5 w-2.5" /> Dismissed</Badge>;
  return <Badge variant="secondary" className="gap-1">New</Badge>;
}
