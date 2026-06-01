'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Settings, Loader2, Save } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';

interface SettingsData {
  earningsMultiplier: number;
  referralThreshold: number;
  referralReward: number;
  referralQualifyEarnings: number;
}

export default function AdminSettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<SettingsData>({
    queryKey: ['admin', 'settings'],
    queryFn: () => api.get<SettingsData>('/api/admin/settings'),
    staleTime: 30_000,
  });

  const [multiplier, setMultiplier]   = React.useState('');
  const [threshold, setThreshold]     = React.useState('');
  const [reward, setReward]           = React.useState('');
  const [qualifyEarnings, setQualifyEarnings] = React.useState('');
  const [saving, setSaving]           = React.useState(false);

  React.useEffect(() => {
    if (!data) return;
    setMultiplier(String(data.earningsMultiplier));
    setThreshold(String(data.referralThreshold));
    setReward(String(data.referralReward));
    setQualifyEarnings(String(data.referralQualifyEarnings));
  }, [data]);

  async function save() {
    const m = parseFloat(multiplier);
    const t = parseInt(threshold, 10);
    const r = parseFloat(reward);
    const q = parseFloat(qualifyEarnings);
    if (!Number.isFinite(m) || m <= 0) { toast.error('Multiplier must be a positive number'); return; }
    if (!Number.isFinite(t) || t < 1)  { toast.error('Referral threshold must be ≥ 1'); return; }
    if (!Number.isFinite(r) || r < 0)  { toast.error('Reward amount must be ≥ 0'); return; }
    if (!Number.isFinite(q) || q < 0)  { toast.error('Qualify earnings must be ≥ 0'); return; }

    setSaving(true);
    try {
      await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          earningsMultiplier:      m,
          referralThreshold:       t,
          referralReward:          r,
          referralQualifyEarnings: q,
        }),
      });
      toast.success('Settings saved');
      qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
    } catch {
      toast.error('Could not save settings');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader title="Platform Settings" description="Configure earnings multiplier and referral rewards." />
      <div className="container max-w-2xl py-6 space-y-6">

        {/* Earnings multiplier */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Earnings multiplier</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Every monetary value shown to creators (campaigns, earnings, payouts) is multiplied by this factor before display.
            <br />Current: <strong>{data?.earningsMultiplier ?? '…'}×</strong>
          </p>
          <div className="flex gap-3 items-end">
            <div className="space-y-1.5 flex-1 max-w-xs">
              <Label>Multiplier</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="1"
                value={multiplier}
                onChange={(e) => setMultiplier(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>
        </Card>

        {/* Referral reward */}
        <Card className="p-5 space-y-4">
          <h3 className="font-semibold text-sm">Referral reward</h3>
          <p className="text-xs text-muted-foreground">
            Creators see a locked treasure on the Referrals page. Once they reach the threshold of
            <strong> qualified</strong> referrals, they can submit a claim request. A referral is
            qualified only after the referred creator has earned the required amount on the platform
            — this prevents smurf-account farming.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
            <div className="space-y-1.5">
              <Label>Threshold (qualified)</Label>
              <Input
                type="number"
                min="1"
                step="1"
                placeholder="3"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Reward amount ($)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="100"
                value={reward}
                onChange={(e) => setReward(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Qualify earnings ($)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="100"
                value={qualifyEarnings}
                onChange={(e) => setQualifyEarnings(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>
        </Card>

        <Button onClick={save} disabled={saving || isLoading} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save settings
        </Button>
      </div>
    </>
  );
}
