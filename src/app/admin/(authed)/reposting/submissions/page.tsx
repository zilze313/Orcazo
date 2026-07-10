'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { ListChecks, CheckCircle2, Clock, Loader2, ExternalLink } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import { PaginationBar } from '@/components/pagination-bar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlatformIcon } from '@/components/platform-icon';
import { api } from '@/lib/api-client';
import { formatRelative } from '@/lib/utils';

interface SubmissionRow {
  id: string;
  repostUrl: string;
  reportedViews: number | null;
  status: 'PENDING' | 'REVIEWED';
  adminNote: string | null;
  createdAt: string;
  employee: { id: string; email: string; firstName: string | null; lastName: string | null };
  post: { postUrl: string; account: { platform: string; label: string } };
}
interface ListResp {
  items: SubmissionRow[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export default function RepostSubmissionsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const status = (params.get('status') as 'all' | 'PENDING' | 'REVIEWED') ?? 'PENDING';
  const page = Math.max(1, parseInt(params.get('page') || '1', 10));

  const list = useQuery<ListResp>({
    queryKey: ['admin', 'repost-submissions', status, page],
    queryFn: () => api.get(`/api/admin/repost/submissions?status=${status}&page=${page}&pageSize=25`),
    staleTime: 5_000,
  });

  const setUrlParam = (key: string, value: string) => {
    const u = new URLSearchParams(params);
    u.set(key, value);
    if (key !== 'page') u.set('page', '1');
    router.replace(`/admin/reposting/submissions?${u.toString()}`, { scroll: false });
  };

  const [reviewingId, setReviewingId] = React.useState<string | null>(null);

  async function markReviewed(id: string, adminNote: string) {
    setReviewingId(id);
    try {
      await api.patch(`/api/admin/repost/submissions/${id}`, { adminNote: adminNote || null });
      toast.success('Marked reviewed');
      qc.invalidateQueries({ queryKey: ['admin', 'repost-submissions'] });
    } catch (e) {
      toast.error((e as Error)?.message || 'Failed');
    } finally {
      setReviewingId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Repost Submissions"
        description="Creators' proof of reposting. Reviewing doesn't move money — issue a credit separately once you've judged the account."
        actions={
          <div className="w-40">
            <Select value={status} onValueChange={(v) => setUrlParam('status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="REVIEWED">Reviewed</SelectItem>
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
          <EmptyState icon={ListChecks} title="Nothing to review" description="Creator repost submissions will show up here." />
        ) : (
          <div className="space-y-2">
            {list.data!.items.map((s) => (
              <SubmissionCard key={s.id} row={s} onReview={markReviewed} reviewing={reviewingId === s.id} />
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

function SubmissionCard({
  row, onReview, reviewing,
}: {
  row: SubmissionRow;
  onReview: (id: string, note: string) => void;
  reviewing: boolean;
}) {
  const [note, setNote] = React.useState(row.adminNote ?? '');
  const name = row.employee.firstName || row.employee.email.split('@')[0];

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3 flex-wrap">
        <PlatformIcon platform={row.post.account.platform} className="h-5 w-5 flex-shrink-0 text-muted-foreground mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{name}</span>
            <span className="text-xs text-muted-foreground">{row.employee.email}</span>
            {row.status === 'REVIEWED'
              ? <Badge variant="success" className="gap-1 text-[10px]"><CheckCircle2 className="h-2.5 w-2.5" /> Reviewed</Badge>
              : <Badge variant="warning" className="gap-1 text-[10px]"><Clock className="h-2.5 w-2.5" /> Pending</Badge>}
          </div>
          <div className="text-xs text-muted-foreground mt-1">{row.post.account.label} · {formatRelative(row.createdAt)}</div>
          <div className="mt-2 space-y-1">
            <a href={row.post.postUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1 break-all">
              <ExternalLink className="h-3 w-3 flex-shrink-0" /> Original post: {row.post.postUrl}
            </a>
            <a href={row.repostUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1 break-all">
              <ExternalLink className="h-3 w-3 flex-shrink-0" /> Their repost: {row.repostUrl}
            </a>
          </div>
          {row.reportedViews != null && (
            <div className="text-xs text-muted-foreground mt-1">Self-reported views: {row.reportedViews.toLocaleString()}</div>
          )}
        </div>
      </div>

      {row.status === 'PENDING' && (
        <div className="mt-3 flex items-center gap-2">
          <input
            className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Optional note (visible to you only)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button size="sm" onClick={() => onReview(row.id, note)} disabled={reviewing}>
            {reviewing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            Mark reviewed
          </Button>
        </div>
      )}
      {row.status === 'REVIEWED' && row.adminNote && (
        <p className="mt-2 text-xs text-muted-foreground italic">{row.adminNote}</p>
      )}
    </Card>
  );
}
