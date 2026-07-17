'use client';

// Bounty tiers: follower floor → repost/collab bounty. The applicable tier
// for a creator is the highest floor they clear, e.g. with tiers at 50k ($20)
// and 100k ($30), a 70k-follower creator earns $20 per approved repost.

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layers, Plus, Trash2, Save, Eye, EyeOff, X } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api-client';
import { formatMoney, formatNumber } from '@/lib/utils';

interface Tier {
  id: string;
  minFollowers: number;
  repostBounty: string | number;
  collabBounty: string | number;
  active: boolean;
}

interface ListResp { tiers: Tier[] }

function num(v: string | number): number {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

export default function RepostTiersPage() {
  const qc = useQueryClient();
  const [showNew, setShowNew] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);

  const { data, isLoading } = useQuery<ListResp>({
    queryKey: ['admin', 'repost-tiers'],
    queryFn: () => api.get<ListResp>('/api/admin/repost/tiers'),
    staleTime: 10_000,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin', 'repost-tiers'] });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.del(`/api/admin/repost/tiers/${id}`),
    onSuccess: () => { toast.success('Tier deleted.'); refresh(); },
    onError: () => toast.error('Could not delete.'),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.patch(`/api/admin/repost/tiers/${id}`, { active }),
    onSuccess: refresh,
    onError: () => toast.error('Could not update.'),
  });

  return (
    <>
      <PageHeader
        title="Bounty Tiers"
        description="Follower-based bounties. A creator earns the bounty of the highest tier their follower count clears; below the lowest tier the bounty defaults to $0 (you can still set a custom amount at approval)."
        actions={
          <Button size="sm" onClick={() => setShowNew(true)} disabled={showNew}>
            <Plus className="h-4 w-4" /> New tier
          </Button>
        }
      />

      <div className="container max-w-3xl py-6 space-y-3">
        {showNew && (
          <TierEditor
            tier={null}
            onSaved={() => { setShowNew(false); refresh(); }}
            onCancel={() => setShowNew(false)}
          />
        )}

        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : (data?.tiers.length ?? 0) === 0 && !showNew ? (
          <EmptyState
            icon={Layers}
            title="No tiers yet"
            description="Add your first tier, e.g. 50,000 followers → $20 per repost / $20 per collab."
            action={<Button onClick={() => setShowNew(true)}><Plus className="h-4 w-4" /> New tier</Button>}
          />
        ) : (
          data?.tiers.map((t) =>
            editingId === t.id ? (
              <TierEditor
                key={t.id}
                tier={t}
                onSaved={() => { setEditingId(null); refresh(); }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <Card key={t.id} className="p-4 flex items-center gap-4">
                <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                  <Layers className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm tabular-nums">{formatNumber(t.minFollowers)}+ followers</span>
                    {t.active
                      ? <Badge variant="success" className="text-[10px]">Active</Badge>
                      : <Badge variant="secondary" className="text-[10px]">Off</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Repost <span className="font-semibold text-foreground tabular-nums">{formatMoney(num(t.repostBounty))}</span>
                    {' · '}
                    Collab <span className="font-semibold text-foreground tabular-nums">{formatMoney(num(t.collabBounty))}</span>
                  </div>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <Button
                    size="sm" variant="outline"
                    onClick={() => toggleMut.mutate({ id: t.id, active: !t.active })}
                    disabled={toggleMut.isPending}
                    title={t.active ? 'Disable' : 'Enable'}
                  >
                    {t.active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingId(t.id)}>Edit</Button>
                  <Button
                    size="sm" variant="destructive"
                    onClick={() => { if (confirm(`Delete the ${formatNumber(t.minFollowers)}+ tier?`)) deleteMut.mutate(t.id); }}
                    disabled={deleteMut.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            )
          )
        )}
      </div>
    </>
  );
}

function TierEditor({
  tier, onSaved, onCancel,
}: {
  tier: Tier | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [minFollowers, setMinFollowers] = React.useState(tier ? String(tier.minFollowers) : '');
  const [repostBounty, setRepostBounty] = React.useState(tier ? String(num(tier.repostBounty)) : '');
  const [collabBounty, setCollabBounty] = React.useState(tier ? String(num(tier.collabBounty)) : '');
  const [active, setActive] = React.useState(tier?.active ?? true);

  const saveMut = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      tier
        ? api.patch(`/api/admin/repost/tiers/${tier.id}`, body)
        : api.post('/api/admin/repost/tiers', body),
    onSuccess: () => { toast.success('Saved.'); onSaved(); },
    onError: (err: unknown) => toast.error((err as Error)?.message || 'Could not save.'),
  });

  function handleSave() {
    const followers = parseInt(minFollowers, 10);
    const rb = parseFloat(repostBounty);
    const cb = parseFloat(collabBounty);
    if (!Number.isFinite(followers) || followers < 0) { toast.error('Enter a valid follower floor.'); return; }
    if (!Number.isFinite(rb) || rb < 0 || !Number.isFinite(cb) || cb < 0) { toast.error('Enter valid bounty amounts.'); return; }
    saveMut.mutate({ minFollowers: followers, repostBounty: rb, collabBounty: cb, active });
  }

  return (
    <Card className="p-5 border-primary/40 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{tier ? 'Edit tier' : 'New tier'}</h3>
        <Button variant="ghost" size="icon" onClick={onCancel}><X className="h-4 w-4" /></Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Min followers</Label>
          <Input type="number" min="0" placeholder="50000" value={minFollowers} onChange={(e) => setMinFollowers(e.target.value)} disabled={saveMut.isPending} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Repost bounty ($)</Label>
          <Input type="number" min="0" step="0.01" placeholder="20" value={repostBounty} onChange={(e) => setRepostBounty(e.target.value)} disabled={saveMut.isPending} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Collab bounty ($)</Label>
          <Input type="number" min="0" step="0.01" placeholder="20" value={collabBounty} onChange={(e) => setCollabBounty(e.target.value)} disabled={saveMut.isPending} />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} disabled={saveMut.isPending} className="h-4 w-4 accent-primary" />
          Active
        </label>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={saveMut.isPending}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saveMut.isPending}>
            <Save className="h-4 w-4" /> Save
          </Button>
        </div>
      </div>
    </Card>
  );
}
