'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Wallet, Plus, Loader2, Search, X, CheckCircle2 } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import { PaginationBar } from '@/components/pagination-bar';
import { api } from '@/lib/api-client';
import { formatMoney } from '@/lib/utils';

interface CreditRow {
  id: string;
  amount: number;
  note: string;
  createdAt: string;
  employee: { email: string; firstName: string | null; lastName: string | null };
}
interface ListResp {
  items: CreditRow[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export default function RepostCreditsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const search = params.get('search') ?? '';
  const page = Math.max(1, parseInt(params.get('page') || '1', 10));
  const [searchInput, setSearchInput] = React.useState(search);
  const [issueOpen, setIssueOpen] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => {
      const u = new URLSearchParams(params);
      if (searchInput) u.set('search', searchInput); else u.delete('search');
      u.set('page', '1');
      router.replace(`/admin/reposting/credits?${u.toString()}`, { scroll: false });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const list = useQuery<ListResp>({
    queryKey: ['admin', 'repost-credits', search, page],
    queryFn: () => {
      const u = new URLSearchParams({ page: String(page), pageSize: '25' });
      if (search) u.set('search', search);
      return api.get(`/api/admin/repost/credits?${u.toString()}`);
    },
    staleTime: 5_000,
  });

  return (
    <>
      <PageHeader
        title="Repost Wallet Credits"
        description="The only way money enters a creator's repost wallet — a judgment call on their account size, growth, and repost consistency."
        actions={
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search creator…" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className="pl-9" />
            </div>
            <Button onClick={() => setIssueOpen(true)}><Plus className="h-4 w-4" /> Issue credit</Button>
          </div>
        }
      />

      <div className="container max-w-4xl py-6">
        <Card className="overflow-x-auto">
          {list.isLoading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : (list.data?.items.length ?? 0) === 0 ? (
            <EmptyState icon={Wallet} title="No credits issued yet" description="Issue your first credit to a creator's repost wallet." />
          ) : (
            <ul className="divide-y">
              {list.data!.items.map((c) => (
                <li key={c.id} className="p-4 flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{c.employee.firstName || c.employee.email.split('@')[0]}</span>
                      <span className="text-xs text-muted-foreground">{c.employee.email}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 italic">{c.note}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-semibold text-green-600 dark:text-green-400 tabular-nums">{formatMoney(c.amount)}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{new Date(c.createdAt).toLocaleDateString()}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        {list.data && list.data.items.length > 0 && (
          <div className="mt-4">
            <PaginationBar
              page={list.data.pagination.page}
              totalPages={list.data.pagination.totalPages}
              total={list.data.pagination.total}
              onPageChange={(p) => { const u = new URLSearchParams(params); u.set('page', String(p)); router.replace(`/admin/reposting/credits?${u.toString()}`, { scroll: false }); }}
            />
          </div>
        )}
      </div>

      {issueOpen && (
        <IssueCreditDialog
          onClose={() => setIssueOpen(false)}
          onIssued={() => { setIssueOpen(false); qc.invalidateQueries({ queryKey: ['admin', 'repost-credits'] }); }}
        />
      )}
    </>
  );
}

interface EmployeeHit { id: string; email: string; firstName: string | null; lastName: string | null }

function IssueCreditDialog({ onClose, onIssued }: { onClose: () => void; onIssued: () => void }) {
  const [query, setQuery] = React.useState('');
  const [selected, setSelected] = React.useState<EmployeeHit | null>(null);
  const [amount, setAmount] = React.useState('');
  const [note, setNote] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const search = useQuery<{ employees: EmployeeHit[] }>({
    queryKey: ['admin', 'employee-search', query],
    queryFn: () => api.get(`/api/admin/employees?search=${encodeURIComponent(query)}&pageSize=8`),
    enabled: query.trim().length >= 2 && !selected,
    staleTime: 10_000,
  });

  async function submit() {
    if (!selected) { toast.error('Pick a creator first'); return; }
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) { toast.error('Enter a valid amount'); return; }
    if (!note.trim()) { toast.error('A note is required — why is this creator being paid?'); return; }

    setSaving(true);
    try {
      await api.post('/api/admin/repost/credits', { employeeId: selected.id, amount: amt, note: note.trim() });
      toast.success('Credit issued');
      onIssued();
    } catch (err) {
      toast.error((err as Error)?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <Card className="w-full max-w-md p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-base">Issue repost credit</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>

        {!selected ? (
          <div className="space-y-2">
            <Label>Find creator</Label>
            <Input autoFocus placeholder="Search by name or email…" value={query} onChange={(e) => setQuery(e.target.value)} />
            {query.trim().length >= 2 && (
              <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
                {search.isLoading ? (
                  <div className="p-3 text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…</div>
                ) : (search.data?.employees.length ?? 0) === 0 ? (
                  <div className="p-3 text-xs text-muted-foreground">No matches</div>
                ) : (
                  search.data!.employees.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      className="w-full text-left p-3 text-sm hover:bg-secondary transition-colors"
                      onClick={() => setSelected(e)}
                    >
                      <div className="font-medium">{e.firstName || e.email.split('@')[0]}</div>
                      <div className="text-xs text-muted-foreground">{e.email}</div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
            <div>
              <div className="text-sm font-medium">{selected.firstName || selected.email.split('@')[0]}</div>
              <div className="text-xs text-muted-foreground">{selected.email}</div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>Change</Button>
          </div>
        )}

        <div className="space-y-1.5">
          <Label>Amount ($)</Label>
          <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={saving} />
        </div>
        <div className="space-y-1.5">
          <Label>Note — why are they being paid this?</Label>
          <textarea
            className="flex w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="e.g. Grew to 40K followers, consistent reposts across 6 posts this month"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={saving}
            maxLength={1000}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !selected}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Issue credit
          </Button>
        </div>
      </Card>
    </div>
  );
}
