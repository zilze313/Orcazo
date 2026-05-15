"use client";

import * as React from "react";
import Link from "next/link";
import { Megaphone, X } from "lucide-react";
import { api } from "@/lib/api-client";

interface Announcement {
  id: string;
  title: string;
  contentHtml: string;
  createdAt: string;
}

interface ListResp {
  announcements: Announcement[];
}

const DISMISSED_KEY = "dismissed-announcements";

function getDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function setDismissed(ids: Set<string>) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
  } catch {}
}

export function AnnouncementBanner() {
  const [announcement, setAnnouncement] = React.useState<Announcement | null>(null);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    api
      .get<ListResp>("/api/updates")
      .then((data) => {
        if (!data.announcements?.length) return;
        const dismissed = getDismissed();
        const latest = data.announcements.find((a) => !dismissed.has(a.id));
        if (latest) {
          setAnnouncement(latest);
          setVisible(true);
        }
      })
      .catch(() => {});
  }, []);

  const dismiss = () => {
    if (!announcement) return;
    const dismissed = getDismissed();
    dismissed.add(announcement.id);
    setDismissed(dismissed);
    setVisible(false);
  };

  if (!visible || !announcement) return null;

  return (
    <div className="bg-primary/10 border-b border-primary/20 px-4 py-2.5">
      <div className="flex items-center gap-3 max-w-5xl mx-auto">
        <Megaphone className="h-4 w-4 text-primary flex-shrink-0" />
        <p className="text-sm flex-1 min-w-0 truncate">
          <span className="font-medium">{announcement.title}</span>
        </p>
        <Link
          href="/updates"
          className="text-xs font-medium text-primary hover:underline flex-shrink-0"
        >
          Read more
        </Link>
        <button
          onClick={dismiss}
          className="p-1 rounded-md text-muted-foreground hover:bg-background/50 flex-shrink-0"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
