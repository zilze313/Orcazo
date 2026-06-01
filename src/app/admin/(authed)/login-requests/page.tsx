"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  KeyRound, Send, Trash2, Loader2, Clock, CheckCircle2, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { PaginationBar } from "@/components/pagination-bar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api-client";
import { formatRelative } from "@/lib/utils";

type Status = "PENDING" | "RELAYED" | "EXPIRED";

interface LoginRequestEntry {
  id: string;
  publicEmail: string;
  proxyEmail: string;
  status: Status;
  createdAt: string;
  relayedAt: string | null;
}

interface ListResp {
  requests: LoginRequestEntry[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export default function LoginRequestsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = React.useState<Status | "all">("PENDING");
  const [page, setPage] = React.useState(1);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const list = useQuery<ListResp>({
    queryKey: ["admin", "login-requests", status, page],
    queryFn: () =>
      api.get<ListResp>(
        `/api/admin/login-requests?status=${status}&page=${page}&pageSize=30`,
      ),
    staleTime: 0,
    refetchInterval: 7_000,
  });

  // Reset selection when filter/page changes or fresh data arrives
  React.useEffect(() => {
    setSelected(new Set());
  }, [status, page]);

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.del(`/api/admin/login-requests/${id}`),
    onSuccess: () => {
      toast.success("Request deleted.");
      qc.invalidateQueries({ queryKey: ["admin", "login-requests"] });
    },
    onError: () => toast.error("Could not delete."),
  });

  const bulkDeleteMut = useMutation({
    mutationFn: (ids: string[]) =>
      api.post<{ ok: true; deleted: number }>("/api/admin/login-requests/bulk-delete", { ids }),
    onSuccess: (data) => {
      toast.success(`Deleted ${data.deleted} request${data.deleted === 1 ? "" : "s"}.`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["admin", "login-requests"] });
    },
    onError: () => toast.error("Could not delete selected."),
  });

  const visibleIds  = list.data?.requests.map((r) => r.id) ?? [];
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(visibleIds));
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <>
      <PageHeader
        title="Login requests"
        description="When a creator requests a login code, it appears here. Copy the code from the proxy inbox and relay it to the creator via Orcazo email."
        actions={
          <div className="flex items-center gap-2">
            <Select value={status} onValueChange={(v) => { setStatus(v as Status | "all"); setPage(1); }}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="RELAYED">Relayed</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ["admin", "login-requests"] })}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      <div className="container max-w-4xl py-6">
        <Card>
          {list.isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
            </div>
          ) : (list.data?.requests.length ?? 0) === 0 ? (
            <EmptyState
              icon={KeyRound}
              title="No login requests"
              description="When a creator clicks 'Send code', a request will appear here."
            />
          ) : (
            <>
              {/* Bulk-action toolbar */}
              <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b bg-muted/30">
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-input"
                  />
                  {selected.size > 0
                    ? `${selected.size} selected`
                    : "Select all on this page"}
                </label>
                {selected.size > 0 && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      if (confirm(`Delete ${selected.size} login request${selected.size === 1 ? "" : "s"}?`)) {
                        bulkDeleteMut.mutate([...selected]);
                      }
                    }}
                    disabled={bulkDeleteMut.isPending}
                  >
                    {bulkDeleteMut.isPending
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Trash2 className="h-3.5 w-3.5" />}
                    Delete selected
                  </Button>
                )}
              </div>

              <ul className="divide-y">
                {list.data!.requests.map((req) => (
                  <RequestRow
                    key={req.id}
                    req={req}
                    selected={selected.has(req.id)}
                    onToggle={() => toggleOne(req.id)}
                    onDelete={() => {
                      if (confirm(`Delete login request from ${req.publicEmail}?`)) {
                        deleteMut.mutate(req.id);
                      }
                    }}
                    onRelayed={() => {
                      qc.invalidateQueries({ queryKey: ["admin", "login-requests"] });
                      qc.invalidateQueries({ queryKey: ["admin", "badges"] });
                    }}
                  />
                ))}
              </ul>
            </>
          )}
          {list.data && list.data.pagination.totalPages > 1 && (
            <div className="px-4 border-t">
              <PaginationBar
                page={list.data.pagination.page}
                totalPages={list.data.pagination.totalPages}
                total={list.data.pagination.total}
                onPageChange={setPage}
              />
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

function RequestRow({
  req,
  selected,
  onToggle,
  onDelete,
  onRelayed,
}: {
  req: LoginRequestEntry;
  selected: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onRelayed: () => void;
}) {
  const [code, setCode] = React.useState("");

  const relayMut = useMutation({
    mutationFn: () =>
      api.post(`/api/admin/login-requests/${req.id}`, { code }),
    onSuccess: () => {
      toast.success(`Code sent to ${req.publicEmail}`);
      setCode("");
      onRelayed();
    },
    onError: (err: unknown) => toast.error((err as Error)?.message || "Could not relay code"),
  });

  return (
    <li className={`p-4 ${selected ? "bg-muted/20" : ""}`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="mt-1.5 h-4 w-4 rounded border-input flex-shrink-0"
          aria-label={`Select request from ${req.publicEmail}`}
        />
        <div className="min-w-0 flex-1 space-y-2">
          {/* Header row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{req.publicEmail}</span>
            <StatusBadge status={req.status} />
            <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">
              {formatRelative(req.createdAt)}
            </span>
          </div>

          {/* Proxy email */}
          <div className="text-xs text-muted-foreground">
            Proxy inbox:{" "}
            <code className="font-mono text-foreground">{req.proxyEmail}</code>
            <span className="ml-2 text-muted-foreground">
              — check this inbox for the OTP
            </span>
          </div>

          {/* Relay form — only for pending */}
          {req.status === "PENDING" && (
            <div className="flex items-center gap-2 pt-1">
              <Input
                className="h-8 w-36 text-sm font-mono"
                placeholder="Paste OTP"
                inputMode="numeric"
                maxLength={8}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                disabled={relayMut.isPending}
              />
              <Button
                size="sm"
                disabled={relayMut.isPending || !/^\d{4,8}$/.test(code)}
                onClick={() => relayMut.mutate()}
              >
                {relayMut.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Send className="h-4 w-4" />}
                Send to creator
              </Button>
            </div>
          )}

          {req.status === "RELAYED" && req.relayedAt && (
            <p className="text-xs text-muted-foreground">
              Relayed {formatRelative(req.relayedAt)}
            </p>
          )}
        </div>

        <Button
          size="icon"
          variant="ghost"
          className="flex-shrink-0 text-muted-foreground hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </li>
  );
}

function StatusBadge({ status }: { status: Status }) {
  if (status === "RELAYED")
    return <Badge variant="success" className="gap-1"><CheckCircle2 className="h-2.5 w-2.5" /> Relayed</Badge>;
  if (status === "EXPIRED")
    return <Badge variant="secondary" className="gap-1">Expired</Badge>;
  return <Badge variant="warning" className="gap-1"><Clock className="h-2.5 w-2.5" /> Pending</Badge>;
}
