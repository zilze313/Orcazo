'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { AtSign, Plus, Trash2, Loader2, Link2, Unlink } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import { api } from '@/lib/api-client';
import { formatRelative } from '@/lib/utils';

interface ManagedEntry {
  id: string;
  email: string;
  note: string | null;
  createdAt: string;
  connectedTo: string | null;
}

interface ListResp { entries: ManagedEntry[] }

const schema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  note:  z.string().max(500).optional(),
});
type Form = z.infer<typeof schema>;

export default function ManagedEmailsPage() {
  const qc = useQueryClient();

  const list = useQuery<ListResp>({
    queryKey: ['admin', 'managed-emails'],
    queryFn:  () => api.get<ListResp>('/api/admin/managed-emails'),
    staleTime: 10_000,
  });

  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', note: '' },
  });

  const addMut = useMutation({
    mutationFn: (values: Form) => api.post<{ entry: ManagedEntry; alreadyExisted: boolean }>('/api/admin/managed-emails', values),
    onSuccess: (data) => {
      toast.success(data.alreadyExisted ? 'Already in pool' : 'Email added');
      form.reset({ email: '', note: '' });
      qc.invalidateQueries({ queryKey: ['admin', 'managed-emails'] });
      qc.invalidateQueries({ queryKey: ['admin', 'managed-emails-available'] });
    },
    onError: (err: unknown) => toast.error((err as Error)?.message || 'Could not add'),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => api.del<{ ok: true }>(`/api/admin/managed-emails/${id}`),
    onSuccess: () => {
      toast.success('Removed from pool');
      qc.invalidateQueries({ queryKey: ['admin', 'managed-emails'] });
      qc.invalidateQueries({ queryKey: ['admin', 'managed-emails-available'] });
    },
    onError: (err: unknown) => toast.error((err as Error)?.message || 'Could not remove'),
  });

  const total = list.data?.entries.length ?? 0;
  const available = list.data?.entries.filter((e) => !e.connectedTo).length ?? 0;

  return (
    <>
      <PageHeader
        title="Managed emails"
        description="Pool of AffiliateNetwork emails you control. When approving a creator signup, you pick one of these to connect."
      />

      <div className="container max-w-4xl py-6 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <StatCard label="Total in pool" value={total} loading={list.isLoading} />
          <StatCard label="Available to assign" value={available} loading={list.isLoading} tone={available === 0 ? 'warning' : 'default'} />
        </div>

        <Card className="p-5">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add an email to the pool
          </h2>
          <form
            onSubmit={form.handleSubmit((v) => addMut.mutate(v))}
            className="grid grid-cols-1 sm:grid-cols-[2fr_2fr_auto] gap-3 items-end"
          >
            <div className="space-y-2">
              <Label htmlFor="email">AffiliateNetwork email</Label>
              <Input id="email" type="email" placeholder="proxy123@yourdomain.com" disabled={addMut.isPending} {...form.register('email')} />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">Note (optional)</Label>
              <Input id="note" placeholder="e.g. Pool A, batch 12" disabled={addMut.isPending} {...form.register('note')} />
            </div>
            <Button type="submit" disabled={addMut.isPending}>
              {addMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add
            </Button>
          </form>
        </Card>

        <Card>
          {list.isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : total === 0 ? (
            <EmptyState
              icon={AtSign}
              title="Pool is empty"
              description="Add your first AffiliateNetwork email above. You'll need at least one in the pool before you can approve creators."
            />
          ) : (
            <ul className="divide-y">
              {list.data!.entries.map((e) => (
                <li key={e.id} className="p-4 flex items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">{e.email}</div>
                    <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2 mt-0.5">
                      {e.connectedTo ? (
                        <Badge variant="secondary" className="gap-1">
                          <Link2 className="h-2.5 w-2.5" /> {e.connectedTo}
                        </Badge>
                      ) : (
                        <Badge variant="warning" className="gap-1">
                          <Unlink className="h-2.5 w-2.5" /> Available
                        </Badge>
                      )}
                      {e.note && <span>· {e.note}</span>}
                      <span>· added {formatRelative(e.createdAt)}</span>
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`Remove ${e.email} from the pool? This is only allowed if it's not currently connected to a creator.`)) {
                        removeMut.mutate(e.id);
                      }
                    }}
                    disabled={removeMut.isPending}
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
        </Card>
      </div>
    </>
  );
}

function StatCard({
  label, value, loading, tone = 'default',
}: { label: string; value: number; loading?: boolean; tone?: 'default' | 'warning' }) {
  const valueClass = tone === 'warning'
    ? 'text-yellow-600 dark:text-yellow-400'
    : 'text-foreground';
  return (
    <Card className="p-5">
      <div className="text-sm text-muted-foreground mb-2">{label}</div>
      {loading
        ? <Skeleton className="h-8 w-16" />
        : <div className={`text-2xl font-semibold tabular-nums ${valueClass}`}>{value}</div>}
    </Card>
  );
}
