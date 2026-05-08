'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  FileText, Search, ExternalLink, ArrowUpDown, ArrowDown, ArrowUp, CheckCircle2, XCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import { PaginationBar } from '@/components/pagination-bar';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api-client';
import { formatRelative } from '@/lib/utils';

interface Submission {
  id: string;
  campaignName: string;
  campaignPublicId: string;
  linkSubmitted: string;
  upstreamStatus: number;
  upstreamSuccess: boolean;
  upstreamMessage: string | null;
  createdAt: string;
  employee: { email: string; firstName: string | null };
}

interface ListResp {
  submissions: Submission[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

type SortField = 'createdAt' | 'campaignName' | 'upstreamSuccess';
type StatusFilter = 'all' | 'success' | 'failed';

export default function AdminSubmissionsPage() {
  const router = useRouter();
  const params = useSearchParams();

  const search = params.get('search') ?? '';
  const status = (params.get('status') as StatusFilter) ?? 'all';
  const sort   = (params.get('sort') as SortField) ?? 'createdAt';
  const order  = (params.get('order') as 'asc' | 'desc') ?? 'desc';
  const page   = Math.max(1, parseInt(params.get('page') || '1', 10));

  const [searchInput, setSearchInput] = React.useState(search);

  React.useEffect(() => {
    const t = setTimeout(() => {
      const u = new URLSearchParams(params);
      if (searchInput) u.set('search', searchInput);
      else             u.delete('search');
      u.set('page', '1');
      router.replace(`/admin/submissions?${u.toString()}`, { scroll: false });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const list = useQuery<ListResp>({
    queryKey: ['admin', 'submissions', search, status, sort, order, page],
    queryFn: () => {
      const u = new URLSearchParams({ page: String(page), pageSize: '25', sort, order, status });
      if (search) u.set('search', search);
      return api.get<ListResp>(`/api/admin/submissions?${u.toString()}`);
    },
    staleTime: 0,
    refetchInterval: 7_000,
  });

  const setUrlParam = (key: string, value: string | null) => {
    const u = new URLSearchParams(params);
    if (value === null) u.delete(key); else u.set(key, value);
    if (key !== 'page') u.set('page', '1');
    router.replace(`/admin/submissions?${u.toString()}`, { scroll: false });
  };

  const setSort = (field: SortField) => {
    const u = new URLSearchParams(params);
    if (sort === field) {
      u.set('order', order === 'asc' ? 'desc' : 'asc');
    } else {
      u.set('sort', field);
      u.set('order', 'desc');
    }
    u.set('page', '1');
    router.replace(`/admin/submissions?${u.toString()}`, { scroll: false });
  };

  return (
    <>
      <PageHeader
        title="Submissions"
        description="Every video submission, with upstream status and full audit trail."
        actions={
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="w-32">
              <Select value={status} onValueChange={(v) => setUrlParam('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        }
      />

      <div className="container max-w-7xl py-6">
        <Card className="overflow-x-auto">
          {list.isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : (list.data?.submissions.length ?? 0) === 0 ? (
            <EmptyState
              icon={FileText}
              title="No submissions found"
              description={search ? 'Try a different search term or change the filter.' : 'No videos have been submitted yet.'}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <button onClick={() => setSort('createdAt')} className="inline-flex items-center gap-1 hover:text-foreground">
                      When <SortIcon active={sort === 'createdAt'} order={order} />
                    </button>
                  </TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>
                    <button onClick={() => setSort('campaignName')} className="inline-flex items-center gap-1 hover:text-foreground">
                      Campaign <SortIcon active={sort === 'campaignName'} order={order} />
                    </button>
                  </TableHead>
                  <TableHead>Link</TableHead>
                  <TableHead>
                    <button onClick={() => setSort('upstreamSuccess')} className="inline-flex items-center gap-1 hover:text-foreground">
                      Status <SortIcon active={sort === 'upstreamSuccess'} order={order} />
                    </button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data!.submissions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap" title={new Date(s.createdAt).toLocaleString()}>
                      {formatRelative(s.createdAt)}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="font-medium truncate max-w-[180px]">{s.employee.email}</div>
                      {s.employee.firstName && (
                        <div className="text-xs text-muted-foreground truncate">{s.employee.firstName}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm font-medium max-w-[200px] truncate" title={s.campaignName}>
                      {s.campaignName}
                    </TableCell>
                    <TableCell>
                      <a
                        href={s.linkSubmitted}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs hover:underline max-w-[180px]"
                      >
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{s.linkSubmitted}</span>
                      </a>
                    </TableCell>
                    <TableCell>
                      {s.upstreamSuccess ? (
                        <Badge variant="success" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Success
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1" title={s.upstreamMessage ?? undefined}>
                          <XCircle className="h-3 w-3" /> {s.upstreamStatus || 'Failed'}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {list.data && list.data.submissions.length > 0 && (
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

function SortIcon({ active, order }: { active: boolean; order: 'asc' | 'desc' }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 text-muted-foreground" />;
  return order === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
}
