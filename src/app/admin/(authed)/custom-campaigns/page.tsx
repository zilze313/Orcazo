'use client';

import * as React from 'react';
import Image from 'next/image';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Plus, Pencil, Trash2, Upload, Loader2, ToggleLeft, ToggleRight, X,
  Sparkles,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import { api } from '@/lib/api-client';

const PLATFORMS = ['instagram', 'tiktok', 'youtube', 'snapchat', 'x', 'facebook'] as const;
type Platform = typeof PLATFORMS[number];

interface ListItem {
  id: string;
  publicId: string;
  name: string;
  iconUrl: string | null;
  rpm: number;
  cap: number;
  platforms: string[];
  active: boolean;
  ordering: number;
  applicationCount: number;
  createdAt: string;
}

interface Detail extends ListItem {
  description: string | null;
  rulesHtml: string | null;
  base: number;
  threshold: number;
  thresholdType: string;
  languages: string[];
  examplesJson: Array<{ url: string }>;
  totalBudget: number | null;
  budgetRemaining: number | null;
  approvalRate: number | null;
  dateEnd: string | null;
  inviteOnly: boolean;
  autoRejectDelayHours: number;
}

export default function CustomCampaignsPage() {
  const qc = useQueryClient();
  const [creating, setCreating] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);

  const list = useQuery<{ items: ListItem[] }>({
    queryKey: ['admin', 'custom-campaigns'],
    queryFn: () => api.get('/api/admin/custom-campaigns'),
    staleTime: 5_000,
  });

  return (
    <>
      <PageHeader
        title="Custom Campaigns"
        description='"House" campaigns mixed into the creator feed. Applications stay pending for the configured delay, then the daily cron auto-rejects them with the global rejection reason set in Settings.'
        actions={
          <Button onClick={() => { setEditingId(null); setCreating(true); }}>
            <Plus className="h-4 w-4" /> New campaign
          </Button>
        }
      />

      <div className="container max-w-6xl py-6 space-y-4">
        {creating && (
          <EditForm
            key="new"
            onClose={() => setCreating(false)}
            onSaved={() => { setCreating(false); qc.invalidateQueries({ queryKey: ['admin', 'custom-campaigns'] }); }}
          />
        )}

        {list.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : (list.data?.items.length ?? 0) === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="No custom campaigns yet"
            description="Create one to populate the creator feed alongside real campaigns."
            action={<Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> New campaign</Button>}
          />
        ) : (
          <div className="space-y-2">
            {list.data!.items.map((row) => (
              <React.Fragment key={row.id}>
                <Card className="p-4 flex items-center gap-4">
                  <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden bg-secondary">
                    {row.iconUrl
                      ? <Image src={row.iconUrl} alt="" fill sizes="48px" className="object-cover" unoptimized />
                      : <div className="h-full w-full grid place-items-center text-muted-foreground text-xs">—</div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold truncate">{row.name}</span>
                      {row.active
                        ? <Badge variant="success" className="text-[10px]">Active</Badge>
                        : <Badge variant="secondary" className="text-[10px]">Paused</Badge>}
                      <span className="text-xs text-muted-foreground tabular-nums">{row.applicationCount} applications</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                      <span className="font-mono">{row.publicId}</span>
                      <span>· ${row.rpm}/1k · cap ${row.cap}</span>
                      <span>· {row.platforms.length ? row.platforms.join(', ') : 'no platforms'}</span>
                    </div>
                  </div>
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
                    onSaved={() => { setEditingId(null); qc.invalidateQueries({ queryKey: ['admin', 'custom-campaigns'] }); }}
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

// ─── Toggle active ──────────────────────────────────────────────────────────

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
          await api.patch(`/api/admin/custom-campaigns/${id}`, { active: !active });
          qc.invalidateQueries({ queryKey: ['admin', 'custom-campaigns'] });
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

// ─── Delete button ──────────────────────────────────────────────────────────

function DeleteButton({ id, name }: { id: string; name: string }) {
  const qc = useQueryClient();
  const [pending, setPending] = React.useState(false);
  return (
    <Button
      variant="ghost" size="icon" title="Delete"
      disabled={pending}
      onClick={async () => {
        if (!confirm(`Delete "${name}"? This also removes all pending applications for it.`)) return;
        setPending(true);
        try {
          await api.del(`/api/admin/custom-campaigns/${id}`);
          qc.invalidateQueries({ queryKey: ['admin', 'custom-campaigns'] });
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

// ─── Create / edit form ─────────────────────────────────────────────────────

const EMPTY_FORM = {
  name: '',
  iconUrl: '' as string,
  description: '',
  rulesHtml: '',
  rpm: 1,
  base: 0,
  cap: 100,
  threshold: 1000,
  thresholdType: 'views',
  platforms: [] as Platform[],
  languages: ['English'] as string[],
  totalBudget: '',
  approvalRate: '',
  dateEnd: '',
  inviteOnly: false,
  active: true,
  ordering: 0,
  autoRejectDelayHours: 48,
  examples: [] as string[],
};
type FormState = typeof EMPTY_FORM;

function EditForm({ id, onClose, onSaved }: { id?: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [loaded, setLoaded] = React.useState(!id);
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  // Preload existing campaign when editing
  React.useEffect(() => {
    if (!id) return;
    api.get<Detail>(`/api/admin/custom-campaigns/${id}`).then((d) => {
      setForm({
        name: d.name,
        iconUrl: d.iconUrl ?? '',
        description: d.description ?? '',
        rulesHtml: d.rulesHtml ?? '',
        rpm: d.rpm,
        base: d.base,
        cap: d.cap,
        threshold: d.threshold,
        thresholdType: d.thresholdType,
        platforms: d.platforms as Platform[],
        languages: d.languages.length ? d.languages : ['English'],
        totalBudget: d.totalBudget != null ? String(d.totalBudget) : '',
        approvalRate: d.approvalRate != null ? String(d.approvalRate) : '',
        dateEnd: d.dateEnd ? d.dateEnd.slice(0, 10) : '',
        inviteOnly: d.inviteOnly,
        active: d.active,
        ordering: d.ordering,
        autoRejectDelayHours: d.autoRejectDelayHours,
        examples: (d.examplesJson ?? []).map((e) => e.url),
      });
      setLoaded(true);
    }).catch((e) => toast.error((e as Error)?.message || 'Failed to load'));
  }, [id]);

  function update<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function togglePlatform(p: Platform) {
    setForm((f) => ({
      ...f,
      platforms: f.platforms.includes(p) ? f.platforms.filter((x) => x !== p) : [...f.platforms, p],
    }));
  }

  async function handleIconUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setUploading(true);
    try {
      const sign = await fetch('/api/admin/custom-campaigns/sign-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: file.type }),
      }).then((r) => r.json());
      if (!sign.uploadUrl) {
        toast.error(sign.error || 'Could not start upload'); return;
      }
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.addEventListener('load', () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`)));
        xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
        xhr.open('PUT', sign.uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });
      update('iconUrl', sign.publicUrl);
      toast.success('Icon uploaded');
    } catch (err) {
      toast.error((err as Error)?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (form.name.trim().length < 2) { toast.error('Name is required'); return; }
    if (form.platforms.length === 0) { toast.error('Pick at least one platform'); return; }
    if (form.cap < form.base) { toast.error('Cap must be ≥ base'); return; }

    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        iconUrl: form.iconUrl.trim() || null,
        description: form.description.trim() || null,
        rulesHtml: form.rulesHtml.trim() || null,
        rpm: Number(form.rpm),
        base: Number(form.base),
        cap: Number(form.cap),
        threshold: Number(form.threshold),
        thresholdType: form.thresholdType,
        platforms: form.platforms,
        languages: form.languages,
        examples: form.examples.filter((u) => u.trim()).map((url) => ({ url: url.trim() })),
        totalBudget: form.totalBudget ? Number(form.totalBudget) : null,
        budgetRemaining: form.totalBudget ? Number(form.totalBudget) : null,
        approvalRate: form.approvalRate ? Number(form.approvalRate) : null,
        dateEnd: form.dateEnd ? new Date(form.dateEnd + 'T00:00:00Z').toISOString() : null,
        inviteOnly: form.inviteOnly,
        active: form.active,
        ordering: Number(form.ordering),
        autoRejectDelayHours: Number(form.autoRejectDelayHours),
      };

      if (id) await api.patch(`/api/admin/custom-campaigns/${id}`, body);
      else    await api.post('/api/admin/custom-campaigns', body);
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
        <h3 className="text-sm font-bold uppercase tracking-wide">{id ? 'Edit campaign' : 'New campaign'}</h3>
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
        <Label>Icon</Label>
        <div className="flex items-center gap-3">
          {form.iconUrl ? (
            <Image src={form.iconUrl} alt="" width={56} height={56} className="object-cover border bg-secondary" unoptimized />
          ) : (
            <div className="h-14 w-14 grid place-items-center border bg-secondary text-muted-foreground text-xs">—</div>
          )}
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={handleIconUpload} />
          <Button variant="outline" size="sm" type="button" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {uploading ? 'Uploading…' : 'Upload'}
          </Button>
          {form.iconUrl && (
            <Button variant="ghost" size="sm" type="button" onClick={() => update('iconUrl', '')}>Clear</Button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Description (admin reference, not shown to creators)</Label>
        <textarea
          className="flex w-full min-h-[60px] rounded-none border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-foreground focus-visible:ring-0"
          value={form.description} onChange={(e) => update('description', e.target.value)} maxLength={4000}
        />
      </div>

      <div className="space-y-2">
        <Label>Rules / brief (HTML — shown to creators on the brief detail)</Label>
        <textarea
          className="flex w-full min-h-[100px] rounded-none border border-input bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-foreground focus-visible:ring-0"
          value={form.rulesHtml} onChange={(e) => update('rulesHtml', e.target.value)} maxLength={20_000}
          placeholder="<p>Post a clip following these guidelines…</p>"
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="space-y-2">
          <Label>RPM ($)</Label>
          <Input type="number" step="0.01" value={form.rpm} onChange={(e) => update('rpm', Number(e.target.value))} />
        </div>
        <div className="space-y-2">
          <Label>Base ($)</Label>
          <Input type="number" step="0.01" value={form.base} onChange={(e) => update('base', Number(e.target.value))} />
        </div>
        <div className="space-y-2">
          <Label>Cap ($)</Label>
          <Input type="number" step="0.01" value={form.cap} onChange={(e) => update('cap', Number(e.target.value))} />
        </div>
        <div className="space-y-2">
          <Label>Min views</Label>
          <Input type="number" value={form.threshold} onChange={(e) => update('threshold', Number(e.target.value))} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Platforms *</Label>
        <div className="flex gap-1.5 flex-wrap">
          {PLATFORMS.map((p) => {
            const on = form.platforms.includes(p);
            return (
              <Button
                key={p} type="button" size="sm"
                variant={on ? 'default' : 'outline'}
                onClick={() => togglePlatform(p)}
                className="capitalize"
              >
                {p}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Languages (comma-separated)</Label>
        <Input
          value={form.languages.join(', ')}
          onChange={(e) => update('languages', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label>Total budget ($, optional)</Label>
          <Input type="number" value={form.totalBudget} onChange={(e) => update('totalBudget', e.target.value)} placeholder="e.g. 5000" />
        </div>
        <div className="space-y-2">
          <Label>Displayed approval rate %</Label>
          <Input type="number" min="0" max="100" value={form.approvalRate} onChange={(e) => update('approvalRate', e.target.value)} placeholder="e.g. 35" />
        </div>
        <div className="space-y-2">
          <Label>Auto-reject after (hours)</Label>
          <Input type="number" min="1" max="720" value={form.autoRejectDelayHours} onChange={(e) => update('autoRejectDelayHours', Number(e.target.value))} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Example post URLs</Label>
        {form.examples.map((u, i) => (
          <div key={i} className="flex gap-2">
            <Input
              value={u}
              placeholder="https://www.tiktok.com/@…/video/…"
              onChange={(e) => {
                const next = [...form.examples];
                next[i] = e.target.value;
                update('examples', next);
              }}
            />
            <Button type="button" variant="ghost" size="icon" onClick={() => update('examples', form.examples.filter((_, j) => j !== i))}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        {form.examples.length < 20 && (
          <Button type="button" variant="outline" size="sm" onClick={() => update('examples', [...form.examples, ''])}>
            <Plus className="h-3.5 w-3.5" /> Add example
          </Button>
        )}
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.active} onChange={(e) => update('active', e.target.checked)} />
          Active (shown to creators)
        </label>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.inviteOnly} onChange={(e) => update('inviteOnly', e.target.checked)} />
          Invite-only badge
        </label>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {id ? 'Save changes' : 'Create campaign'}
        </Button>
      </div>
    </Card>
  );
}
