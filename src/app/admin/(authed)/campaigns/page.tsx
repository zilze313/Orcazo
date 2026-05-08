"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LayoutGrid, Eye, EyeOff, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
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

export default function AdminCampaignsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = React.useState("");
  // Track which publicIds have a pending toggle so we can show per-row loaders
  const [pending, setPending] = React.useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery<ListResp>({
    queryKey: ["admin", "campaigns"],
    queryFn: () => api.get<ListResp>("/api/admin/campaigns"),
    staleTime: 30_000,
  });

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
            placeholder="Search campaigns…"
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
                : "No employees are connected yet — campaigns are loaded from the upstream API using a creator's credentials."
            }
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((c) => {
              const busy = pending.has(c.publicId);
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
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {c.publicId}
                    </div>
                  </div>

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
    </>
  );
}
