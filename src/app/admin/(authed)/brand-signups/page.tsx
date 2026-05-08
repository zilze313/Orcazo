'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  Building2, Search, CheckCircle2, MailOpen, Trash2, Loader2,
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

interface BrandEntry {
  id: string;
  email: string;
  brandName: string;
  monthlyBudget: string;
  createdAt: string;
  contactedAt: string | null;
}

interface ListResp {
  entries: BrandEntry[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export default function BrandSignupsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();

  const search = params.get('search') ?? '';
  const status = (params.get('status') as 'all' | 'new' | 'contacted') ?? 'new';
  const page   = Math.max(1, parseInt(params.get('page') || '1', 10));
  const [searchInput, setSearchInput] = React.useState(search);

  React.useEffect(() => {
    const t = setTimeout(() => {
      const u = new URLSearchParams(params);
      if (searchInput) u.set('search', searchInput); else u.delete('search');
      u.set('page', '1');
      router.replace(`/admin/brand-signups?${u.toString()}`, { scroll: false });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const list = useQuery<ListResp>({
    queryKey: ['admin', 'brand-signups', search, status, page],
    queryFn: () => {
      const u = new URLSearchParams({ page: String(page), pageSize: '25', status });
      if (search) u.set('search', search);
      return api.get<ListResp>(`/api/admin/brand-signups?${u.toString()}`);
    },
    staleTime: 0,
    refetchInterval: 7_000,
  });

  const setUrlParam = (key: string, value: string) => {
    const u = new URLSearchParams(params);
    u.set(key, value);
    if (key !== 'page') u.set('page', '1');
    router.replace(`/admin/brand-signups?${u.toString()}`, { scroll: false });
  };

  const toggleMut = useMutation({
    mutationFn: ({ id, contacted }: { id: string; contacted: boolean }) =>
      fetch(`/api/admin/brand-signups/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacted }),
      }).then((r) => r.json()),
    onSuccess: () => {
      toast.success('Updated');
      qc.invalidateQueries({ queryKey: ['admin', 'brand-signups'] });
    },
    onError: (err: unknown) => toast.error((err as Error)?.message || 'Could not update'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.del<{ ok: true }>(`/api/admin/brand-signups/${id}`),
    onSuccess: () => {
      toast.success('Deleted');
      qc.invalidateQueries({ queryKey: ['admin', 'brand-signups'] });
    },
    onError: (err: unknown) => toast.error((err as Error)?.message || 'Could not delete'),
  });

  return (
    <>
      <PageHeader
        title="Brand inquiries"
        description="Brands that submitted the &quot;Sign up as a brand&quot; form on the marketing site."
        actions={
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search email or brand…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="w-32">
              <Select value={status} onValueChange={(v) => setUrlParam('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
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
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : (list.data?.entries.length ?? 0) === 0 ? (
            <EmptyState
              icon={Building2}
              title="No brand inquiries"
              description={search ? 'Try a different search term.' : 'Brand inquiries will show up here.'}
            />
          ) : (
            <ul className="divide-y">
              {list.data!.entries.map((b) => (
                <li key={b.id} className="p-4 flex items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{b.brandName}</span>
                      {b.contactedAt
                        ? <Badge variant="success" className="gap-1"><CheckCircle2 className="h-2.5 w-2.5" /> Contacted</Badge>
                        : <Badge variant="warning">New</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-2">
                      <a href={`mailto:${b.email}`} className="hover:underline">{b.email}</a>
                      <span>·</span>
                      <span>{b.monthlyBudget}</span>
                      <span>·</span>
                      <span>received {formatRelative(b.createdAt)}</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={b.contactedAt ? 'ghost' : 'outline'}
                    onClick={() => toggleMut.mutate({ id: b.id, contacted: !b.contactedAt })}
                    disabled={toggleMut.isPending}
                  >
                    <MailOpen className="h-3.5 w-3.5" />
                    {b.contactedAt ? 'Mark as new' : 'Mark contacted'}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`Delete inquiry from ${b.email}?`)) deleteMut.mutate(b.id);
                    }}
                    disabled={deleteMut.isPending}
                    title="Delete"
                  >
                    {deleteMut.isPending && deleteMut.variables === b.id
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Trash2 className="h-4 w-4" />}
                  </Button>
                </li>
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
