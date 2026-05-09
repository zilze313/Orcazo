'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tag, Plus, Trash2, Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';
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

interface ReferralCodeEntry {
  id: string;
  code: string;
  note: string | null;
  createdAt: string;
  usageCount: number;
}

interface ListResp { codes: ReferralCodeEntry[] }

export default function ReferralCodesPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = React.useState(false);
  const [codeInput, setCodeInput] = React.useState('');
  const [noteInput, setNoteInput] = React.useState('');

  const { data, isLoading } = useQuery<ListResp>({
    queryKey: ['admin', 'referral-codes'],
    queryFn:  () => api.get<ListResp>('/api/admin/referral-codes'),
    staleTime: 15_000,
  });

  const createMut = useMutation({
    mutationFn: () => api.post<ReferralCodeEntry>('/api/admin/referral-codes', {
      code: codeInput.trim(),
      note: noteInput.trim() || undefined,
    }),
    onSuccess: () => {
      toast.success('Referral code created.');
      setCodeInput('');
      setNoteInput('');
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ['admin', 'referral-codes'] });
    },
    onError: (err: unknown) => toast.error((err as Error)?.message || 'Could not create code.'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.del(`/api/admin/referral-codes/${id}`),
    onSuccess: () => {
      toast.success('Referral code deleted.');
      qc.invalidateQueries({ queryKey: ['admin', 'referral-codes'] });
    },
    onError: () => toast.error('Could not delete code.'),
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!codeInput.trim()) { toast.error('Code is required.'); return; }
    createMut.mutate();
  }

  return (
    <>
      <PageHeader
        title="Referral Codes"
        description="Create codes that creators can enter at signup. Track which creator joined with which code."
        actions={
          <Button size="sm" onClick={() => setShowForm((v) => !v)} disabled={showForm}>
            <Plus className="h-4 w-4" /> New code
          </Button>
        }
      />

      <div className="container max-w-3xl py-6 space-y-4">
        {showForm && (
          <Card className="p-5 border-primary/40">
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="code">
                    Code <span className="text-muted-foreground font-normal text-xs">(letters, numbers, - and _ only)</span>
                  </Label>
                  <Input
                    id="code"
                    placeholder="e.g. sam123"
                    value={codeInput}
                    onChange={(e) => setCodeInput(e.target.value.toLowerCase())}
                    disabled={createMut.isPending}
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="note">
                    Note <span className="text-muted-foreground font-normal text-xs">(optional)</span>
                  </Label>
                  <Input
                    id="note"
                    placeholder="e.g. Sam's Instagram outreach"
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    disabled={createMut.isPending}
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="ghost" size="sm" onClick={() => { setShowForm(false); setCodeInput(''); setNoteInput(''); }} disabled={createMut.isPending}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={createMut.isPending || !codeInput.trim()}>
                  {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Create code
                </Button>
              </div>
            </form>
          </Card>
        )}

        <Card>
          {isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
            </div>
          ) : (data?.codes.length ?? 0) === 0 ? (
            <EmptyState
              icon={Tag}
              title="No referral codes yet"
              description='Click "New code" to create your first referral code.'
            />
          ) : (
            <ul className="divide-y">
              {data!.codes.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    <Tag className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-semibold text-sm">{c.code}</span>
                      {c.note && (
                        <span className="text-xs text-muted-foreground truncate">— {c.note}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      <span>created {formatRelative(c.createdAt)}</span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        <Badge variant={c.usageCount > 0 ? 'secondary' : 'outline'} className="text-[10px] px-1.5 py-0">
                          {c.usageCount} signup{c.usageCount === 1 ? '' : 's'}
                        </Badge>
                      </span>
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="flex-shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      if (confirm(`Delete referral code "${c.code}"? Existing signups that used this code will still show it, but no new signups can use it.`)) {
                        deleteMut.mutate(c.id);
                      }
                    }}
                    disabled={deleteMut.isPending && deleteMut.variables === c.id}
                    title="Delete code"
                  >
                    {deleteMut.isPending && deleteMut.variables === c.id
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
