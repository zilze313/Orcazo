"use client";

// Admin inbox for brand "launch a campaign" requests submitted from the
// public /brands page. Workflow: NEW → CONTACTED → CLOSED.

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Briefcase, Trash2, Mail, Globe, CheckCircle2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { PlatformIcon } from "@/components/platform-icon";
import { api } from "@/lib/api-client";
import { formatRelative } from "@/lib/utils";

type Status = "NEW" | "CONTACTED" | "CLOSED";

interface BrandRequest {
  id: string;
  brandName: string;
  contactName: string;
  email: string;
  website: string | null;
  campaignName: string;
  budget: string;
  platforms: string[] | null;
  description: string | null;
  status: Status;
  adminNote: string | null;
  createdAt: string;
}

interface ListResp {
  requests: BrandRequest[];
  counts: Partial<Record<Status, number>>;
}

const BUDGET_LABELS: Record<string, string> = {
  "under-1000": "Under $1,000",
  "1000-5000": "$1,000 – $5,000",
  "5000-10000": "$5,000 – $10,000",
  "10000-25000": "$10,000 – $25,000",
  "25000-plus": "$25,000+",
};

const TABS: Array<{ key: Status | "ALL"; label: string }> = [
  { key: "NEW", label: "New" },
  { key: "CONTACTED", label: "Contacted" },
  { key: "CLOSED", label: "Closed" },
  { key: "ALL", label: "All" },
];

export default function BrandRequestsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = React.useState<Status | "ALL">("NEW");

  const { data, isLoading } = useQuery<ListResp>({
    queryKey: ["admin", "brand-requests", tab],
    queryFn: () =>
      api.get<ListResp>(`/api/admin/brand-requests${tab === "ALL" ? "" : `?status=${tab}`}`),
    staleTime: 10_000,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "brand-requests"] });

  const patchMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api.patch(`/api/admin/brand-requests/${id}`, body),
    onSuccess: refresh,
    onError: () => toast.error("Could not update."),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.del(`/api/admin/brand-requests/${id}`),
    onSuccess: () => { toast.success("Request deleted."); refresh(); },
    onError: () => toast.error("Could not delete."),
  });

  return (
    <>
      <PageHeader
        title="Brand Requests"
        description="Brands that want to launch a campaign on the platform. Reach out, then mark them contacted or closed."
      />

      <div className="container max-w-4xl py-6 space-y-4">
        <div className="flex gap-2 flex-wrap">
          {TABS.map((t) => (
            <Button
              key={t.key}
              size="sm"
              variant={tab === t.key ? "default" : "outline"}
              onClick={() => setTab(t.key)}
            >
              {t.label}
              {t.key !== "ALL" && data?.counts?.[t.key] != null && (
                <span className="ml-1 tabular-nums opacity-70">{data.counts[t.key]}</span>
              )}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
          </div>
        ) : (data?.requests.length ?? 0) === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="No brand requests here"
            description="Requests submitted from the public brands page will show up in this inbox."
          />
        ) : (
          data!.requests.map((r) => (
            <RequestCard
              key={r.id}
              request={r}
              busy={patchMut.isPending || deleteMut.isPending}
              onStatus={(status) => patchMut.mutate({ id: r.id, body: { status } })}
              onNote={(adminNote) => patchMut.mutate({ id: r.id, body: { adminNote } })}
              onDelete={() => {
                if (confirm(`Delete the request from "${r.brandName}"?`)) deleteMut.mutate(r.id);
              }}
            />
          ))
        )}
      </div>
    </>
  );
}

function statusBadge(status: Status) {
  if (status === "NEW") return <Badge variant="warning" className="text-[10px]">New</Badge>;
  if (status === "CONTACTED") return <Badge variant="success" className="text-[10px]">Contacted</Badge>;
  return <Badge variant="secondary" className="text-[10px]">Closed</Badge>;
}

function RequestCard({
  request: r, busy, onStatus, onNote, onDelete,
}: {
  request: BrandRequest;
  busy: boolean;
  onStatus: (s: Status) => void;
  onNote: (note: string) => void;
  onDelete: () => void;
}) {
  const [note, setNote] = React.useState(r.adminNote ?? "");
  const platforms = Array.isArray(r.platforms) ? r.platforms : [];

  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">{r.brandName}</span>
            {statusBadge(r.status)}
            <span className="text-xs text-muted-foreground">{formatRelative(r.createdAt)}</span>
          </div>
          <div className="text-sm mt-1">
            Campaign: <span className="font-medium">{r.campaignName}</span>
            {" · "}
            <span className="font-medium">{BUDGET_LABELS[r.budget] ?? r.budget}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
            <span>{r.contactName}</span>
            <a href={`mailto:${r.email}`} className="inline-flex items-center gap-1 hover:underline">
              <Mail className="h-3 w-3" /> {r.email}
            </a>
            {r.website && (
              <a
                href={r.website.startsWith("http") ? r.website : `https://${r.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:underline"
              >
                <Globe className="h-3 w-3" /> {r.website}
              </a>
            )}
            {platforms.length > 0 && (
              <span className="inline-flex items-center gap-1.5">
                {platforms.map((p) => (
                  <PlatformIcon key={p} platform={p} className="h-3.5 w-3.5" />
                ))}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-1.5 flex-shrink-0">
          {r.status !== "CONTACTED" && (
            <Button size="sm" variant="outline" onClick={() => onStatus("CONTACTED")} disabled={busy}>
              <CheckCircle2 className="h-4 w-4" /> Contacted
            </Button>
          )}
          {r.status !== "CLOSED" ? (
            <Button size="sm" variant="outline" onClick={() => onStatus("CLOSED")} disabled={busy}>
              Close
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => onStatus("NEW")} disabled={busy} title="Reopen">
              <Undo2 className="h-4 w-4" />
            </Button>
          )}
          <Button size="sm" variant="destructive" onClick={onDelete} disabled={busy}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {r.description && (
        <p className="text-sm text-muted-foreground whitespace-pre-wrap border-t pt-3">
          {r.description}
        </p>
      )}

      <div className="flex gap-2 border-t pt-3">
        <Input
          placeholder="Internal note…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={busy}
          className="text-sm"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => { onNote(note.trim()); toast.success("Note saved."); }}
          disabled={busy || note === (r.adminNote ?? "")}
        >
          Save note
        </Button>
      </div>
    </Card>
  );
}
