"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LayoutGrid, Eye, EyeOff, Search, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { api } from "@/lib/api-client";

interface CampaignRow {
  publicId: string;
  name: string;
  icon: string | null;
  hidden: boolean;
}

interface ListResp {
  campaigns: CampaignRow[];
}

interface OverrideRow {
  campaignPublicId: string;
  displayName: string | null;
  displayCpm: string | number | null;
  displayBase: string | number | null;
  displayCap: string | number | null;
}

interface OverridesResp {
  overrides: OverrideRow[];
}

export default function AdminCampaignsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = React.useState("");
  // Track which publicIds have a pending toggle so we can show per-row loaders
  const [pending, setPending] = React.useState<Set<string>>(new Set());
  const [editTarget, setEditTarget] = React.useState<CampaignRow | null>(null);

  const { data, isLoading } = useQuery<ListResp>({
    queryKey: ["admin", "campaigns"],
    queryFn: () => api.get<ListResp>("/api/admin/campaigns"),
    staleTime: 30_000,
  });

  const { data: overridesData } = useQuery<OverridesResp>({
    queryKey: ["admin", "campaign-overrides"],
    queryFn: () => api.get<OverridesResp>("/api/admin/campaign-overrides"),
    staleTime: 30_000,
  });

  const overridesMap = React.useMemo(() => {
    const m = new Map<string, OverrideRow>();
    for (const o of overridesData?.overrides ?? []) m.set(o.campaignPublicId, o);
    return m;
  }, [overridesData]);

  const toggleMut = useMutation({
    mutationFn: ({
      publicId,
      hidden,
      name,
    }: {
      publicId: string;
      hidden: boolean;
      name: string;
    }) =>
      api.patch(`/api/admin/campaigns/${publicId}`, {
        hidden,
        campaignName: name,
      }),
    onMutate: ({ publicId }) => {
      setPending((s) => new Set(s).add(publicId));
    },
    onSuccess: (_data, { publicId, hidden }) => {
      toast.success(hidden ? "Campaign hidden from creators." : "Campaign visible to creators.");
      qc.invalidateQueries({ queryKey: ["admin", "campaigns"] });
      setPending((s) => { const n = new Set(s); n.delete(publicId); return n; });
    },
    onError: (_err, { publicId }) => {
      toast.error("Could not update campaign visibility.");
      setPending((s) => { const n = new Set(s); n.delete(publicId); return n; });
    },
  });

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data?.campaigns ?? [];
    return (data?.campaigns ?? []).filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.publicId.toLowerCase().includes(q),
    );
  }, [data, search]);

  const visibleCount = (data?.campaigns ?? []).filter((c) => !c.hidden).length;
  const hiddenCount  = (data?.campaigns ?? []).filter((c) => c.hidden).length;

  return (
    <>
      <PageHeader
        title="Campaigns"
        description="Show or hide campaigns from creators. Hidden campaigns won't appear in their Explore tab."
      />

      <div className="container max-w-4xl py-6 space-y-4">
        {/* Stats row */}
        {!isLoading && data && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>
              <strong className="text-foreground">{visibleCount}</strong> visible
            </span>
            <span>
              <strong className="text-foreground">{hiddenCount}</strong> hidden
            </span>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search campaigns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={LayoutGrid}
            title={
              search
                ? "No campaigns match your search"
                : "No campaigns found"
            }
            description={
              search
                ? "Try a different search term."
                : "No employees are connected yet -- campaigns are loaded from the upstream API using a creator's credentials."
            }
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((c) => {
              const busy = pending.has(c.publicId);
              const hasOverride = overridesMap.has(c.publicId);
              return (
                <Card
                  key={c.publicId}
                  className={`flex items-center gap-3 px-4 py-3 transition-opacity ${
                    c.hidden ? "opacity-60" : ""
                  }`}
                >
                  {/* Icon */}
                  {c.icon ? (
                    <img
                      src={c.icon}
                      alt=""
                      className="h-8 w-8 rounded object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded bg-muted flex-shrink-0" />
                  )}

                  {/* Name + ID */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">
                        {c.name}
                      </span>
                      {c.hidden && (
                        <Badge variant="secondary" className="text-[10px] gap-1">
                          <EyeOff className="h-2.5 w-2.5" /> Hidden
                        </Badge>
                      )}
                      {hasOverride && (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          Overridden
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {c.publicId}
                    </div>
                  </div>

                  {/* Edit button */}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditTarget(c)}
                    className="flex-shrink-0 gap-1.5"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>

                  {/* Toggle button */}
                  <Button
                    size="sm"
                    variant={c.hidden ? "outline" : "secondary"}
                    disabled={busy}
                    onClick={() =>
                      toggleMut.mutate({
                        publicId: c.publicId,
                        hidden: !c.hidden,
                        name: c.name,
                      })
                    }
                    className="flex-shrink-0 gap-1.5"
                  >
                    {busy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : c.hidden ? (
                      <Eye className="h-3.5 w-3.5" />
                    ) : (
                      <EyeOff className="h-3.5 w-3.5" />
                    )}
                    {c.hidden ? "Show" : "Hide"}
                  </Button>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {editTarget && (
        <OverrideDialog
          campaign={editTarget}
          existing={overridesMap.get(editTarget.publicId) ?? null}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["admin", "campaign-overrides"] });
            setEditTarget(null);
          }}
        />
      )}
    </>
  );
}

// -------------------------------------------------------------------
// Override dialog
// -------------------------------------------------------------------

function OverrideDialog({
  campaign,
  existing,
  onClose,
  onSaved,
}: {
  campaign: CampaignRow;
  existing: OverrideRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [displayName, setDisplayName] = React.useState(existing?.displayName ?? "");
  const [displayCpm, setDisplayCpm] = React.useState(existing?.displayCpm != null ? String(existing.displayCpm) : "");
  const [displayBase, setDisplayBase] = React.useState(existing?.displayBase != null ? String(existing.displayBase) : "");
  const [displayCap, setDisplayCap] = React.useState(existing?.displayCap != null ? String(existing.displayCap) : "");
  const [saving, setSaving] = React.useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await api.post("/api/admin/campaign-overrides", {
        campaignPublicId: campaign.publicId,
        displayName: displayName.trim() || null,
        displayCpm: displayCpm.trim() ? parseFloat(displayCpm) : null,
        displayBase: displayBase.trim() ? parseFloat(displayBase) : null,
        displayCap: displayCap.trim() ? parseFloat(displayCap) : null,
      });
      toast.success("Campaign override saved.");
      onSaved();
    } catch {
      toast.error("Failed to save override.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Campaign Override</DialogTitle>
          <DialogDescription>
            Override the display name and rates for &ldquo;{campaign.name}&rdquo;. Leave fields
            blank to use the upstream value. These overrides are visible to creators.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="override-name">Display Name</Label>
            <Input
              id="override-name"
              placeholder={campaign.name}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="override-cpm">CPM ($)</Label>
              <Input
                id="override-cpm"
                type="number"
                step="0.0001"
                min="0"
                placeholder="--"
                value={displayCpm}
                onChange={(e) => setDisplayCpm(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="override-base">Base ($)</Label>
              <Input
                id="override-base"
                type="number"
                step="0.0001"
                min="0"
                placeholder="--"
                value={displayBase}
                onChange={(e) => setDisplayBase(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="override-cap">Cap ($)</Label>
              <Input
                id="override-cap"
                type="number"
                step="0.0001"
                min="0"
                placeholder="--"
                value={displayCap}
                onChange={(e) => setDisplayCap(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
