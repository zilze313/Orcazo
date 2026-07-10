"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, Wallet, XCircle, Repeat, Info } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  url: string | null;
  readAt: string | null;
  createdAt: string;
}

interface NotificationsResp {
  items: NotificationItem[];
  unread: number;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

function typeIcon(type: string) {
  if (type === "payout_approved") return <Wallet className="h-4 w-4 text-green-600" />;
  if (type === "payout_rejected") return <XCircle className="h-4 w-4 text-destructive" />;
  if (type === "repost_new_post" || type === "repost_credit") return <Repeat className="h-4 w-4 text-primary" />;
  return <Info className="h-4 w-4 text-muted-foreground" />;
}

/** Bell + dropdown in the creator sidebar. Polls every 60s. */
export function NotificationBell() {
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);

  const query = useQuery<NotificationsResp>({
    queryKey: ["notifications"],
    queryFn: () => api.get<NotificationsResp>("/api/notifications"),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const markRead = useMutation({
    mutationFn: () => api.post<{ ok: true }>("/api/notifications", { action: "mark-read" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const unread = query.data?.unread ?? 0;
  const items = query.data?.items ?? [];

  function toggle() {
    const next = !open;
    setOpen(next);
    // Opening the menu clears the badge — like every inbox users know.
    if (next && unread > 0) markRead.mutate();
  }

  return (
    <div className="relative">
      <button
        onClick={toggle}
        aria-label={unread > 0 ? `Notifications (${unread} unread)` : "Notifications"}
        aria-haspopup="menu"
        aria-expanded={open}
        className="relative p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute top-0 right-0 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold px-1">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 w-80 max-w-[90vw] rounded-md border bg-popover shadow-lg">
            <div className="px-4 py-3 border-b">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notifications</span>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-4 py-8 text-sm text-muted-foreground text-center">
                  Nothing yet — payout and repost updates land here.
                </p>
              ) : (
                items.map((n) => {
                  const inner = (
                    <div className="flex gap-3 items-start">
                      <span className="mt-0.5 flex-shrink-0">{typeIcon(n.type)}</span>
                      <span className="min-w-0">
                        <span className={cn("block text-sm leading-snug", !n.readAt && "font-semibold")}>{n.title}</span>
                        {n.body && <span className="block text-xs text-muted-foreground mt-0.5 leading-snug">{n.body}</span>}
                        <span className="block text-[10px] text-muted-foreground mt-1">{timeAgo(n.createdAt)}</span>
                      </span>
                    </div>
                  );
                  return n.url ? (
                    <Link
                      key={n.id}
                      href={n.url}
                      onClick={() => setOpen(false)}
                      className="block px-4 py-3 border-b last:border-0 hover:bg-secondary transition-colors"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div key={n.id} className="px-4 py-3 border-b last:border-0">
                      {inner}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
