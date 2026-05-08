'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, ShieldCheck, Search } from 'lucide-react';

import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import { PaginationBar } from '@/components/pagination-bar';
import { api } from '@/lib/api-client';
import { formatRelative } from '@/lib/utils';

interface AllowlistEntry {
  id: string;
  email: string;
  note: string | null;
  createdAt: string;
}
interface ListResp {
  entries: AllowlistEntry[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

const schema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  note:  z.string().max(500).optional(),
});
type Form = z.infer<typeof schema>;

export default function AdminAllowlistPage() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();

  const search = params.get('search') ?? '';
  const page = Math.max(1, parseInt(params.get('page') || '1', 10));

  const [searchInput, setSearchInput] = React.useState(search);

  React.useEffect(() => {
    const t = setTimeout(() => {
      const u = new URLSearchParams(params);
      if (searchInput) u.set('search', searchInput);
      else             u.delete('search');
      u.set('page', '1');
      router.replace(`/admin/allowlist?${u.toString()}`, { scroll: false });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const list = useQuery<ListResp>({
    queryKey: ['admin', 'allowlist', search, page],
    queryFn: () => {
      const u = new URLSearchParams({ page: String(page), pageSize: '50' });
      if (search) u.set('search', search);
      return api.get<ListResp>(`/api/admin/allowlist?${u.toString()}`);
    },
    staleTime: 10_000,
  });

  const setPage = (p: number) => {
    const u = new URLSearchParams(params);
    u.set('page', String(p));
    router.replace(`/admin/allowlist?${u.toString()}`, { scroll: false });
  };

  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', note: '' },
  });

  const addMut = useMutation({
    mutationFn: (values: Form) =>
      api.post<{ entry: AllowlistEntry; alreadyExisted: boolean }>('/api/admin/allowlist', values),
    onSuccess: (data) => {
      if (data.alreadyExisted) {
        toast.info('That email is already on the allowlist');
      } else {
        toast.success('Added to allowlist');
      }
      form.reset({ email: '', note: '' });
      qc.invalidateQueries({ queryKey: ['admin', 'allowlist'] });
    },
    onError: (err: unknown) => toast.error((err as Error)?.message || 'Could not add'),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => api.del<{ ok: true }>(`/api/admin/allowlist/${id}`),
    onSuccess: () => {
      toast.success('Removed from allowlist');
      qc.invalidateQueries({ queryKey: ['admin', 'allowlist'] });
    },
    onError: (err: unknown) => toast.error((err as Error)?.message || 'Could not remove'),
  });

  return (
    <>
      <PageHeader
        title="Allowlist"
        description="Emails that are allowed to log in to Orcazo. Anyone not on this list will be blocked before any verification email is sent."
        actions={
          <div className="relative w-full sm:w-72">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search email or note…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>
        }
      />

      <div className="container max-w-4xl py-6 space-y-6">
        {/* Add form */}
        <Card className="p-5">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add an email
          </h2>
          <form
            onSubmit={form.handleSubmit((v) => addMut.mutate(v))}
            className="grid grid-cols-1 sm:grid-cols-[2fr_2fr_auto] gap-3 items-end"
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                disabled={addMut.isPending}
                {...form.register('email')}
              />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">Note (optional)</Label>
              <Input
                id="note"
                placeholder="e.g. New hire — content team"
                disabled={addMut.isPending}
                {...form.register('note')}
              />
            </div>
            <Button type="submit" disabled={addMut.isPending}>
              {addMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add
            </Button>
          </form>
        </Card>

        {/* List */}
        <Card>
          {list.isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : (list.data?.entries.length ?? 0) === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title={search ? 'No matches' : 'Allowlist is empty'}
              description={search ? 'Try a different search term.' : 'Add the first email above. Without an allowlist entry, no one can log in.'}
            />
          ) : (
            <ul className="divide-y">
              {list.data!.entries.map((e) => (
                <li key={e.id} className="p-4 flex items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">{e.email}</div>
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2">
                      {e.note && <span>{e.note}</span>}
                      {e.note && <span>·</span>}
                      <span>added {formatRelative(e.createdAt)}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={removeMut.isPending}
                    onClick={() => {
                      if (confirm(`Remove ${e.email} from the allowlist?`)) {
                        removeMut.mutate(e.id);
                      }
                    }}
                    title="Remove"
                  >
                    {removeMut.isPending && removeMut.variables === e.id
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
                onPageChange={setPage}
              />
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
