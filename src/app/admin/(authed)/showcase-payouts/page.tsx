"use client";

// Admin CRUD for the homepage "payout wall" marquee cards. Cards are fully
// curated here — they are NOT linked to real payouts, so the admin decides
// exactly what the public sees.

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trophy, Plus, Trash2, Save, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PlatformIcon } from "@/components/platform-icon";
import { api } from "@/lib/api-client";
import { formatMoney } from "@/lib/utils";

interface ShowcaseCard {
  id: string;
  displayName: string;
  handle: string | null;
  platform: string | null;
  amount: string | number;
  note: string | null;
  paidLabel: string | null;
  active: boolean;
  ordering: number;
  createdAt: string;
}

interface ListResp { cards: ShowcaseCard[] }

const PLATFORMS = ["tiktok", "instagram", "youtube", "snapchat", "twitter"] as const;

function amountNum(v: string | number): number {
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

export default function ShowcasePayoutsPage() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [showNew, setShowNew] = React.useState(false);

  const { data, isLoading } = useQuery<ListResp>({
    queryKey: ["admin", "showcase-payouts"],
    queryFn: () => api.get<ListResp>("/api/admin/showcase-payouts"),
    staleTime: 15_000,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "showcase-payouts"] });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.del(`/api/admin/showcase-payouts/${id}`),
    onSuccess: () => { toast.success("Card deleted."); refresh(); },
    onError: () => toast.error("Could not delete."),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.patch(`/api/admin/showcase-payouts/${id}`, { active }),
    onSuccess: refresh,
    onError: () => toast.error("Could not update."),
  });

  return (
    <>
      <PageHeader
        title="Payout Wall"
        description="Curated payout cards shown in the homepage marquee. Only active cards are public."
        actions={
          <Button size="sm" onClick={() => setShowNew(true)} disabled={showNew}>
            <Plus className="h-4 w-4" /> New card
          </Button>
        }
      />

      <div className="container max-w-4xl py-6 space-y-4">
        {showNew && (
          <CardEditor
            entry={null}
            onSaved={() => { setShowNew(false); refresh(); }}
            onCancel={() => setShowNew(false)}
          />
        )}

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : (data?.cards.length ?? 0) === 0 && !showNew ? (
          <EmptyState
            icon={Trophy}
            title="No payout cards yet"
            description='Click "New card" to add the first payout to the homepage wall.'
          />
        ) : (
          data?.cards.map((entry) =>
            editingId === entry.id ? (
              <CardEditor
                key={entry.id}
                entry={entry}
                onSaved={() => { setEditingId(null); refresh(); }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <Card key={entry.id} className="p-4 flex items-center gap-4">
                <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-green-500/10 text-green-600 dark:text-green-400 font-bold text-sm tabular-nums">
                  $
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{entry.displayName}</span>
                    {entry.handle && (
                      <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                        {entry.platform && <PlatformIcon platform={entry.platform} className="h-3 w-3" />}
                        @{entry.handle.replace(/^@/, "")}
                      </span>
                    )}
                    {entry.active
                      ? <Badge variant="success" className="text-[10px]">Live</Badge>
                      : <Badge variant="secondary" className="text-[10px]">Hidden</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-green-600 dark:text-green-400 tabular-nums">
                      {formatMoney(amountNum(entry.amount))}
                    </span>
                    {entry.paidLabel && <span>· {entry.paidLabel}</span>}
                    {entry.note && <span className="truncate">· {entry.note}</span>}
                    <span>· order {entry.ordering}</span>
                  </div>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <Button
                    size="sm" variant="outline"
                    onClick={() => toggleMut.mutate({ id: entry.id, active: !entry.active })}
                    disabled={toggleMut.isPending}
                    title={entry.active ? "Hide from homepage" : "Show on homepage"}
                  >
                    {entry.active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingId(entry.id)}>Edit</Button>
                  <Button
                    size="sm" variant="destructive"
                    onClick={() => { if (confirm(`Delete the card for "${entry.displayName}"?`)) deleteMut.mutate(entry.id); }}
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

function CardEditor({
  entry, onSaved, onCancel,
}: {
  entry: ShowcaseCard | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [displayName, setDisplayName] = React.useState(entry?.displayName ?? "");
  const [handle, setHandle] = React.useState(entry?.handle ?? "");
  const [platform, setPlatform] = React.useState(entry?.platform ?? "tiktok");
  const [amount, setAmount] = React.useState(entry ? String(amountNum(entry.amount)) : "");
  const [note, setNote] = React.useState(entry?.note ?? "");
  const [paidLabel, setPaidLabel] = React.useState(entry?.paidLabel ?? "");
  const [ordering, setOrdering] = React.useState(String(entry?.ordering ?? 0));
  const [active, setActive] = React.useState(entry?.active ?? true);

  const saveMut = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      entry
        ? api.patch(`/api/admin/showcase-payouts/${entry.id}`, body)
        : api.post("/api/admin/showcase-payouts", body),
    onSuccess: () => { toast.success("Saved."); onSaved(); },
    onError: (err: unknown) => toast.error((err as Error)?.message || "Could not save."),
  });

  function handleSave() {
    const amt = parseFloat(amount);
    if (!displayName.trim()) { toast.error("Name is required."); return; }
    if (!Number.isFinite(amt) || amt <= 0) { toast.error("Enter a valid amount."); return; }
    saveMut.mutate({
      displayName: displayName.trim(),
      handle: handle.trim() ? handle.trim().replace(/^@/, "") : null,
      platform: platform || null,
      amount: amt,
      note: note.trim() || null,
      paidLabel: paidLabel.trim() || null,
      ordering: parseInt(ordering, 10) || 0,
      active,
    });
  }

  return (
    <Card className="p-5 border-primary/40">
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Display name</Label>
            <Input placeholder="e.g. Sarah M." value={displayName} onChange={(e) => setDisplayName(e.target.value)} disabled={saveMut.isPending} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Amount (USD)</Label>
            <Input type="number" min="0" step="0.01" placeholder="450.00" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={saveMut.isPending} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Handle (optional)</Label>
            <Input placeholder="@sarahclips" value={handle} onChange={(e) => setHandle(e.target.value)} disabled={saveMut.isPending} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Platform</Label>
            <Select value={platform} onValueChange={setPlatform} disabled={saveMut.isPending}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((p) => (
                  <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Note (optional, shown on the card)</Label>
            <Input placeholder='e.g. "3 weeks of posting"' value={note} onChange={(e) => setNote(e.target.value)} disabled={saveMut.isPending} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Paid label (optional)</Label>
            <Input placeholder="e.g. July 2026" value={paidLabel} onChange={(e) => setPaidLabel(e.target.value)} disabled={saveMut.isPending} />
          </div>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="space-y-1.5 w-28">
            <Label className="text-xs">Order</Label>
            <Input type="number" min="0" value={ordering} onChange={(e) => setOrdering(e.target.value)} disabled={saveMut.isPending} />
          </div>
          <label className="flex items-center gap-2 pt-5 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              disabled={saveMut.isPending}
              className="h-4 w-4 accent-primary"
            />
            Visible on the homepage
          </label>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={saveMut.isPending}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saveMut.isPending}>
            <Save className="h-4 w-4" /> Save
          </Button>
        </div>
      </div>
    </Card>
  );
}
