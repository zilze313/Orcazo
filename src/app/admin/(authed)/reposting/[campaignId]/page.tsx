'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, ToggleLeft, ToggleRight, Send, Users, Rss, X } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlatformIcon } from '@/components/platform-icon';
import { api } from '@/lib/api-client';
import { formatRelative } from '@/lib/utils';

const PLATFORMS = ['instagram', 'tiktok', 'youtube', 'snapchat', 'x', 'facebook'] as const;
type Platform = typeof PLATFORMS[number];

interface CampaignDetail {
  id: string;
  name: string;
  accounts: Array<{
    id: string;
    platform: string;
    handle: string;
    displayName: string | null;
    profileUrl: string | null;
    avatarUrl: string | null;
    active: boolean;
    subscriberCount: number;
    postCount: number;
    createdAt: string;
  }>;
}

export default function RepostCampaignDetailPage() {
  const params = useParams<{ campaignId: string }>();
  const campaignId = params.campaignId;
  const qc = useQueryClient();
  const [addingAccount, setAddingAccount] = React.useState(false);
  const [logPostFor, setLogPostFor] = React.useState<{ id: string; label: string } | null>(null);

  const detail = useQuery<CampaignDetail>({
    queryKey: ['admin', 'repost-campaign', campaignId],
    queryFn: () => api.get(`/api/admin/repost/campaigns/${campaignId}`),
    staleTime: 5_000,
  });

  return (
    <>
      <PageHeader
        title={detail.data ? `${detail.data.name} — Source accounts` : 'Source accounts'}
        description="Accounts creators can subscribe to. Log a new post to notify every subscriber."
        actions={
          <Button onClick={() => setAddingAccount(true)}>
            <Plus className="h-4 w-4" /> Add account
          </Button>
        }
      />

      <div className="container max-w-5xl py-6 space-y-4">
        {addingAccount && (
          <AddAccountForm
            campaignId={campaignId}
            onClose={() => setAddingAccount(false)}
            onSaved={() => { setAddingAccount(false); qc.invalidateQueries({ queryKey: ['admin', 'repost-campaign', campaignId] }); }}
          />
        )}

        {detail.isLoading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
        ) : (detail.data?.accounts.length ?? 0) === 0 ? (
          <EmptyState
            icon={Users}
            title="No source accounts yet"
            description="Add the admin-owned accounts creators can subscribe to."
            action={<Button onClick={() => setAddingAccount(true)}><Plus className="h-4 w-4" /> Add account</Button>}
          />
        ) : (
          <div className="space-y-2">
            {detail.data!.accounts.map((a) => (
              <Card key={a.id} className="p-4 flex items-center gap-4">
                <PlatformIcon platform={a.platform} className="h-8 w-8 flex-shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold truncate">{a.displayName || `@${a.handle}`}</span>
                    {a.active
                      ? <Badge variant="success" className="text-[10px]">Active</Badge>
                      : <Badge variant="secondary" className="text-[10px]">Paused</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap capitalize">
                    <span>{a.platform} · @{a.handle}</span>
                    <span className="inline-flex items-center gap-1 normal-case"><Users className="h-3 w-3" /> {a.subscriberCount} subscriber{a.subscriberCount === 1 ? '' : 's'}</span>
                    <span className="inline-flex items-center gap-1 normal-case"><Rss className="h-3 w-3" /> {a.postCount} post{a.postCount === 1 ? '' : 's'} logged</span>
                  </div>
                </div>
                <Button size="sm" onClick={() => setLogPostFor({ id: a.id, label: a.displayName || `@${a.handle}` })}>
                  <Send className="h-3.5 w-3.5" /> Log new post
                </Button>
                <ToggleAccountActive campaignId={campaignId} accountId={a.id} active={a.active} />
                <DeleteAccountButton campaignId={campaignId} accountId={a.id} label={a.displayName || `@${a.handle}`} />
              </Card>
            ))}
          </div>
        )}
      </div>

      <LogPostDialog target={logPostFor} onClose={() => setLogPostFor(null)} />
    </>
  );
}

function ToggleAccountActive({ campaignId, accountId, active }: { campaignId: string; accountId: string; active: boolean }) {
  const qc = useQueryClient();
  const [pending, setPending] = React.useState(false);
  return (
    <Button
      variant="ghost" size="icon" title={active ? 'Pause' : 'Activate'}
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          await api.patch(`/api/admin/repost/accounts/${accountId}`, { active: !active });
          qc.invalidateQueries({ queryKey: ['admin', 'repost-campaign', campaignId] });
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

function DeleteAccountButton({ campaignId, accountId, label }: { campaignId: string; accountId: string; label: string }) {
  const qc = useQueryClient();
  const [pending, setPending] = React.useState(false);
  return (
    <Button
      variant="ghost" size="icon" title="Delete"
      disabled={pending}
      onClick={async () => {
        if (!confirm(`Remove ${label}? This also removes every subscriber's subscription to it.`)) return;
        setPending(true);
        try {
          await api.del(`/api/admin/repost/accounts/${accountId}`);
          qc.invalidateQueries({ queryKey: ['admin', 'repost-campaign', campaignId] });
          toast.success('Removed');
        } catch (e) {
          toast.error((e as Error)?.message || 'Failed');
        } finally { setPending(false); }
      }}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
    </Button>
  );
}

function AddAccountForm({ campaignId, onClose, onSaved }: { campaignId: string; onClose: () => void; onSaved: () => void }) {
  const [platform, setPlatform] = React.useState<Platform>('instagram');
  const [handle, setHandle] = React.useState('');
  const [displayName, setDisplayName] = React.useState('');
  const [profileUrl, setProfileUrl] = React.useState('');
  const [avatarUrl, setAvatarUrl] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  async function save() {
    if (!handle.trim()) { toast.error('Handle is required'); return; }
    setSaving(true);
    try {
      await api.post(`/api/admin/repost/campaigns/${campaignId}/accounts`, {
        platform,
        handle: handle.trim(),
        displayName: displayName.trim() || null,
        profileUrl: profileUrl.trim() || null,
        avatarUrl: avatarUrl.trim() || null,
      });
      toast.success('Account added');
      onSaved();
    } catch (err) {
      toast.error((err as Error)?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-5 space-y-4 border-2 border-foreground">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold uppercase tracking-wide">Add source account</h3>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Platform</Label>
          <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PLATFORMS.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Handle *</Label>
          <Input placeholder="fruitytalks1" value={handle} onChange={(e) => setHandle(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Display name (optional)</Label>
          <Input placeholder="Fruity Talks" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Profile URL (optional)</Label>
          <Input placeholder="https://instagram.com/fruitytalks1" value={profileUrl} onChange={(e) => setProfileUrl(e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Avatar URL (optional)</Label>
        <Input placeholder="https://…" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} />
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={save} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Add account
        </Button>
      </div>
    </Card>
  );
}

function LogPostDialog({ target, onClose }: { target: { id: string; label: string } | null; onClose: () => void }) {
  const [postUrl, setPostUrl] = React.useState('');
  const [note, setNote] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (target) { setPostUrl(''); setNote(''); }
  }, [target]);

  if (!target) return null;

  async function submit() {
    if (!postUrl.trim()) { toast.error('Post URL is required'); return; }
    setSaving(true);
    try {
      await api.post('/api/admin/repost/posts', {
        sourceAccountId: target!.id,
        postUrl: postUrl.trim(),
        note: note.trim() || null,
      });
      toast.success('Post logged — subscribers are being notified');
      onClose();
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
          <h2 className="font-semibold text-base">Log new post — {target.label}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <p className="text-xs text-muted-foreground">
          This immediately notifies every subscriber (in-app + email) that a new post is up.
        </p>
        <div className="space-y-1.5">
          <Label>Post URL</Label>
          <Input autoFocus placeholder="https://www.instagram.com/p/…" value={postUrl} onChange={(e) => setPostUrl(e.target.value)} disabled={saving} />
        </div>
        <div className="space-y-1.5">
          <Label>Note (optional)</Label>
          <Input placeholder="e.g. Repost within 24h for best results" value={note} onChange={(e) => setNote(e.target.value)} disabled={saving} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Notify subscribers
          </Button>
        </div>
      </Card>
    </div>
  );
}
