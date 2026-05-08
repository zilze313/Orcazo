"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Megaphone, Plus, Trash2, Save, Eye, EyeOff, Globe, GlobeLock } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { RichTextEditor } from "@/components/rich-text-editor";
import { api } from "@/lib/api-client";
import { formatRelative } from "@/lib/utils";

interface AnnouncementEntry {
  id: string;
  title: string;
  contentHtml: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ListResp { announcements: AnnouncementEntry[] }

export default function AnnouncementsPage() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [showNew, setShowNew] = React.useState(false);

  const { data, isLoading } = useQuery<ListResp>({
    queryKey: ["admin", "announcements"],
    queryFn: () => api.get<ListResp>("/api/admin/announcements"),
    staleTime: 15_000,
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.del(`/api/admin/announcements/${id}`),
    onSuccess: () => {
      toast.success("Announcement deleted.");
      qc.invalidateQueries({ queryKey: ["admin", "announcements"] });
    },
    onError: () => toast.error("Could not delete."),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, published }: { id: string; published: boolean }) =>
      api.patch(`/api/admin/announcements/${id}`, { published }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "announcements"] }),
    onError: () => toast.error("Could not update status."),
  });

  return (
    <>
      <PageHeader
        title="Announcements"
        description="Post updates and news that creators see on their Updates tab."
        actions={
          <Button size="sm" onClick={() => setShowNew(true)} disabled={showNew}>
            <Plus className="h-4 w-4" /> New announcement
          </Button>
        }
      />

      <div className="container max-w-4xl py-6 space-y-4">
        {showNew && (
          <AnnouncementEditor
            entry={null}
            onSaved={() => {
              setShowNew(false);
              qc.invalidateQueries({ queryKey: ["admin", "announcements"] });
            }}
            onCancel={() => setShowNew(false)}
          />
        )}

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : (data?.announcements.length ?? 0) === 0 && !showNew ? (
          <EmptyState
            icon={Megaphone}
            title="No announcements yet"
            description='Click "New announcement" to post your first update to creators.'
          />
        ) : (
          data?.announcements.map((entry) =>
            editingId === entry.id ? (
              <AnnouncementEditor
                key={entry.id}
                entry={entry}
                onSaved={() => {
                  setEditingId(null);
                  qc.invalidateQueries({ queryKey: ["admin", "announcements"] });
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <AnnouncementCard
                key={entry.id}
                entry={entry}
                onEdit={() => setEditingId(entry.id)}
                onDelete={() => {
                  if (confirm(`Delete "${entry.title}"?`)) deleteMut.mutate(entry.id);
                }}
                onTogglePublish={() =>
                  toggleMut.mutate({ id: entry.id, published: !entry.published })
                }
                busy={deleteMut.isPending || toggleMut.isPending}
              />
            )
          )
        )}
      </div>
    </>
  );
}

function AnnouncementCard({
  entry, onEdit, onDelete, onTogglePublish, busy,
}: {
  entry: AnnouncementEntry;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePublish: () => void;
  busy: boolean;
}) {
  const [preview, setPreview] = React.useState(false);

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{entry.title}</span>
            {entry.published ? (
              <Badge variant="success" className="gap-1 text-[10px]">
                <Globe className="h-2.5 w-2.5" /> Published
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1 text-[10px]">
                <GlobeLock className="h-2.5 w-2.5" /> Draft
              </Badge>
            )}
            <span className="text-xs text-muted-foreground ml-auto">
              {formatRelative(entry.createdAt)}
            </span>
          </div>
        </div>
        <div className="flex gap-1.5 flex-shrink-0">
          <Button size="sm" variant="ghost" onClick={() => setPreview(v => !v)} title="Preview">
            {preview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onTogglePublish}
            disabled={busy}
            title={entry.published ? "Unpublish" : "Publish"}
          >
            {entry.published ? <GlobeLock className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
          </Button>
          <Button size="sm" variant="outline" onClick={onEdit}>Edit</Button>
          <Button size="sm" variant="destructive" onClick={onDelete} disabled={busy}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {preview && (
        <div
          className="mt-3 pt-3 border-t prose prose-sm dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: entry.contentHtml }}
        />
      )}
    </Card>
  );
}

function AnnouncementEditor({
  entry, onSaved, onCancel,
}: {
  entry: AnnouncementEntry | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = React.useState(entry?.title ?? "");
  const [contentHtml, setContentHtml] = React.useState(entry?.contentHtml ?? "");
  const [published, setPublished] = React.useState(entry?.published ?? false);

  const saveMut = useMutation({
    mutationFn: (body: { title: string; contentHtml: string; published: boolean }) =>
      entry
        ? api.patch(`/api/admin/announcements/${entry.id}`, body)
        : api.post("/api/admin/announcements", body),
    onSuccess: () => { toast.success("Saved."); onSaved(); },
    onError: (err: unknown) => toast.error((err as Error)?.message || "Could not save."),
  });

  function handleSave() {
    if (!title.trim()) { toast.error("Title is required."); return; }
    const empty = !contentHtml || contentHtml.replace(/<[^>]*>/g, "").trim().length === 0;
    if (empty) { toast.error("Content cannot be empty."); return; }
    saveMut.mutate({ title: title.trim(), contentHtml, published });
  }

  return (
    <Card className="p-5 border-primary/40">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Title</Label>
          <Input
            placeholder="e.g. New campaign launched 🎉"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={saveMut.isPending}
          />
        </div>

        <Separator />

        <div className="space-y-1.5">
          <Label className="text-xs">Content</Label>
          <RichTextEditor
            content={contentHtml}
            onChange={setContentHtml}
            disabled={saveMut.isPending}
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            id="pub-toggle"
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
            disabled={saveMut.isPending}
            className="h-4 w-4 accent-primary"
          />
          <Label htmlFor="pub-toggle" className="text-sm cursor-pointer">
            Publish immediately (visible to creators)
          </Label>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={saveMut.isPending}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saveMut.isPending}>
            <Save className="h-4 w-4" /> Save
          </Button>
        </div>
      </div>
    </Card>
  );
}
