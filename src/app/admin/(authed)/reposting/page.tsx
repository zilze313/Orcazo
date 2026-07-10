'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Loader2, ToggleLeft, ToggleRight, X, Repeat, Users } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import { api } from '@/lib/api-client';

interface ListItem {
  id: string;
  publicId: string;
  name: string;
  iconUrl: string | null;
  active: boolean;
  ordering: number;
  accountCount: number;
  subscriberCount: number;
  createdAt: string;
}

interface Detail {
  id: string;
  name: string;
  iconUrl: string | null;
  description: string | null;
  rulesHtml: string | null;
  active: boolean;
  ordering: number;
}

export default function RepostCampaignsPage() {
  const qc = useQueryClient();
  const [creating, setCreating] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);

  const list = useQuery<{ items: ListItem[] }>({
    queryKey: ['admin', 'repost-campaigns'],
    queryFn: () => api.get('/api/admin/repost/campaigns'),
    staleTime: 5_000,
  });

  return (
    <>
      <PageHeader
        title="Reposting Campaigns"
        description="Programs shown as a 'Subscribe' card in the creator feed. Each has its own roster of admin-owned source accounts."
        actions={
          <Button onClick={() => { setEditingId(null); setCreating(true); }}>
            <Plus className="h-4 w-4" /> New program
          </Button>
        }
      />

      <div className="container max-w-6xl py-6 space-y-4">
        {creating && (
          <EditForm
            key="new"
            onClose={() => setCreating(false)}
            onSaved={() => { setCreating(false); qc.invalidateQueries({ queryKey: ['admin', 'repost-campaigns'] }); }}
          />
        )}

        {list.isLoading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
        ) : (list.data?.items.length ?? 0) === 0 ? (
          <EmptyState
            icon={Repeat}
            title="No reposting programs yet"
            description="Create one, then add the admin-owned accounts creators can subscribe to."
            action={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New program</Button>}
          />
        ) : (
          <div className="space-y-2">
            {list.data!.items.map((row) => (
              <React.Fragment key={row.id}>
                <Card className="p-4 flex items-center gap-4">
                  <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden bg-secondary rounded-lg">
                    {row.iconUrl
                      ? <Image src={row.iconUrl} alt="" fill sizes="48px" className="object-cover" unoptimized />
                      : <div className="h-full w-full grid place-items-center text-muted-foreground"><Repeat className="h-5 w-5" /></div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold truncate">{row.name}</span>
                      {row.active
                        ? <Badge variant="success" className="text-[10px]">Active</Badge>
                        : <Badge variant="secondary" className="text-[10px]">Paused</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                      <span className="font-mono">{row.publicId}</span>
                      <span>· {row.accountCount} account{row.accountCount === 1 ? '' : 's'}</span>
                      <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {row.subscriberCount} subscriber{row.subscriberCount === 1 ? '' : 's'}</span>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/admin/reposting/${row.id}`}>Manage accounts</Link>
                  </Button>
                  <ToggleActive id={row.id} active={row.active} />
                  <Button
                    variant="ghost" size="icon"
                    onClick={() => { setCreating(false); setEditingId(editingId === row.id ? null : row.id); }}
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <DeleteButton id={row.id} name={row.name} />
                </Card>
                {editingId === row.id && (
                  <EditForm
                    id={row.id}
                    onClose={() => setEditingId(null)}
                    onSaved={() => { setEditingId(null); qc.invalidateQueries({ queryKey: ['admin', 'repost-campaigns'] }); }}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function ToggleActive({ id, active }: { id: string; active: boolean }) {
  const qc = useQueryClient();
  const [pending, setPending] = React.useState(false);
  return (
    <Button
      variant="ghost" size="icon" title={active ? 'Pause' : 'Activate'}
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          await api.patch(`/api/admin/repost/campaigns/${id}`, { active: !active });
          qc.invalidateQueries({ queryKey: ['admin', 'repost-campaigns'] });
        } catch (e) {
          toast.error((e as Error)?.message || 'Failed');
        } finally { setPending(false); }
      }}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> :
        active ? <ToggleRight className="h-5 w-5 text-foreground" /> : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
    </Button>
  );
}

function DeleteButton({ id, name }: { id: string; name: string }) {
  const qc = useQueryClient();
  const [pending, setPending] = React.useState(false);
  return (
    <Button
      variant="ghost" size="icon" title="Delete"
      disabled={pending}
      onClick={async () => {
        if (!confirm(`Delete "${name}"? This also removes all its source accounts and subscriptions.`)) return;
        setPending(true);
        try {
          await api.del(`/api/admin/repost/campaigns/${id}`);
          qc.invalidateQueries({ queryKey: ['admin', 'repost-campaigns'] });
          toast.success('Deleted');
        } catch (e) {
          toast.error((e as Error)?.message || 'Failed');
        } finally { setPending(false); }
      }}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
    </Button>
  );
}

const EMPTY_FORM = {
  name: '',
  iconUrl: '' as string,
  description: '',
  rulesHtml: '',
  active: true,
  ordering: 0,
};
type FormState = typeof EMPTY_FORM;

function EditForm({ id, onClose, onSaved }: { id?: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [loaded, setLoaded] = React.useState(!id);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!id) return;
    api.get<Detail>(`/api/admin/repost/campaigns/${id}`).then((d) => {
      setForm({
        name: d.name,
        iconUrl: d.iconUrl ?? '',
        description: d.description ?? '',
        rulesHtml: d.rulesHtml ?? '',
        active: d.active,
        ordering: d.ordering,
      });
      setLoaded(true);
    }).catch((e) => toast.error((e as Error)?.message || 'Failed to load'));
  }, [id]);

  function update<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    if (form.name.trim().length < 2) { toast.error('Name is required'); return; }

    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        iconUrl: form.iconUrl.trim() || null,
        description: form.description.trim() || null,
        rulesHtml: form.rulesHtml.trim() || null,
        active: form.active,
        ordering: Number(form.ordering),
      };

      if (id) await api.patch(`/api/admin/repost/campaigns/${id}`, body);
      else    await api.post('/api/admin/repost/campaigns', body);
      toast.success(id ? 'Updated' : 'Created');
      onSaved();
    } catch (err) {
      toast.error((err as Error)?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) {
    return <Card className="p-6"><Skeleton className="h-32" /></Card>;
  }

  return (
    <Card className="p-5 space-y-4 border-2 border-foreground">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold uppercase tracking-wide">{id ? 'Edit program' : 'New program'}</h3>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Name *</Label>
          <Input value={form.name} onChange={(e) => update('name', e.target.value)} maxLength={200} />
        </div>
        <div className="space-y-2">
          <Label>Sort order</Label>
          <Input type="number" value={form.ordering} onChange={(e) => update('ordering', Number(e.target.value))} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Icon URL</Label>
        <Input placeholder="https://…" value={form.iconUrl} onChange={(e) => update('iconUrl', e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label>Description (shown to creators)</Label>
        <textarea
          className="flex w-full min-h-[60px] rounded-none border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-foreground focus-visible:ring-0"
          value={form.description} onChange={(e) => update('description', e.target.value)} maxLength={4000}
        />
      </div>

      <div className="space-y-2">
        <Label>Rules / brief (HTML — shown to creators)</Label>
        <textarea
          className="flex w-full min-h-[100px] rounded-none border border-input bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-foreground focus-visible:ring-0"
          value={form.rulesHtml} onChange={(e) => update('rulesHtml', e.target.value)} maxLength={20_000}
          placeholder="<p>Repost within 24 hours of the original post…</p>"
        />
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.active} onChange={(e) => update('active', e.target.checked)} />
          Active (shown to creators)
        </label>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {id ? 'Save changes' : 'Create program'}
        </Button>
      </div>
    </Card>
  );
}
