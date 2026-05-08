"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Plus, Trash2, Save, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { RichTextEditor } from "@/components/rich-text-editor";
import { api } from "@/lib/api-client";

interface CampaignRulesEntry {
  id: string;
  campaignPublicId: string;
  campaignName: string;
  rulesHtml: string;
  updatedAt: string;
}

interface ListResp {
  campaignRules: CampaignRulesEntry[];
}

interface SaveResp {
  campaignRules: CampaignRulesEntry;
}

export default function CampaignRulesPage() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [showNewForm, setShowNewForm] = React.useState(false);

  const { data, isLoading } = useQuery<ListResp>({
    queryKey: ["admin", "campaign-rules"],
    queryFn: () => api.get<ListResp>("/api/admin/campaign-rules"),
    staleTime: 15_000,
  });

  const deleteMut = useMutation({
    mutationFn: (campaignPublicId: string) =>
      api.del(`/api/admin/campaign-rules/${campaignPublicId}`),
    onSuccess: () => {
      toast.success("Rules deleted.");
      qc.invalidateQueries({ queryKey: ["admin", "campaign-rules"] });
    },
    onError: () => toast.error("Could not delete rules."),
  });

  return (
    <>
      <PageHeader
        title="Campaign Rules"
        description="Write custom rules for each campaign using the rich text editor. These replace any external links."
        actions={
          <Button size="sm" onClick={() => setShowNewForm(true)} disabled={showNewForm}>
            <Plus className="h-4 w-4" /> Add campaign
          </Button>
        }
      />

      <div className="container max-w-4xl py-6 space-y-4">
        {showNewForm && (
          <RulesEditor
            entry={null}
            onSaved={() => {
              setShowNewForm(false);
              qc.invalidateQueries({ queryKey: ["admin", "campaign-rules"] });
            }}
            onCancel={() => setShowNewForm(false)}
          />
        )}

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : (data?.campaignRules.length ?? 0) === 0 && !showNewForm ? (
          <EmptyState
            icon={BookOpen}
            title="No campaign rules yet"
            description='Click "Add campaign" to write the first set of rules.'
          />
        ) : (
          data?.campaignRules.map((entry) =>
            editingId === entry.campaignPublicId ? (
              <RulesEditor
                key={entry.campaignPublicId}
                entry={entry}
                onSaved={() => {
                  setEditingId(null);
                  qc.invalidateQueries({ queryKey: ["admin", "campaign-rules"] });
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <RulesCard
                key={entry.campaignPublicId}
                entry={entry}
                onEdit={() => setEditingId(entry.campaignPublicId)}
                onDelete={() => {
                  if (confirm(`Delete rules for "${entry.campaignName}"?`)) {
                    deleteMut.mutate(entry.campaignPublicId);
                  }
                }}
                deleteLoading={deleteMut.isPending}
              />
            )
          )
        )}
      </div>
    </>
  );
}

function RulesCard({
  entry,
  onEdit,
  onDelete,
  deleteLoading,
}: {
  entry: CampaignRulesEntry;
  onEdit: () => void;
  onDelete: () => void;
  deleteLoading: boolean;
}) {
  const [showPreview, setShowPreview] = React.useState(false);

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm">{entry.campaignName}</div>
          <div className="text-xs text-muted-foreground font-mono mt-0.5">
            {entry.campaignPublicId}
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowPreview((v) => !v)}
            title={showPreview ? "Hide preview" : "Show preview"}
          >
            {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
          <Button size="sm" variant="outline" onClick={onEdit}>
            Edit
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={onDelete}
            disabled={deleteLoading}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {showPreview && (
        <div
          className="mt-3 pt-3 border-t prose prose-sm dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: entry.rulesHtml }}
        />
      )}
    </Card>
  );
}

function RulesEditor({
  entry,
  onSaved,
  onCancel,
}: {
  entry: CampaignRulesEntry | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [campaignPublicId, setCampaignPublicId] = React.useState(
    entry?.campaignPublicId ?? ""
  );
  const [campaignName, setCampaignName] = React.useState(entry?.campaignName ?? "");
  const [rulesHtml, setRulesHtml] = React.useState(entry?.rulesHtml ?? "");

  const saveMut = useMutation({
    mutationFn: (body: {
      campaignPublicId: string;
      campaignName: string;
      rulesHtml: string;
    }) => api.post<SaveResp>("/api/admin/campaign-rules", body),
    onSuccess: () => {
      toast.success("Rules saved.");
      onSaved();
    },
    onError: (err: unknown) =>
      toast.error((err as Error)?.message || "Could not save rules."),
  });

  function handleSave() {
    if (!campaignPublicId.trim()) {
      toast.error("Campaign public ID is required.");
      return;
    }
    if (!campaignName.trim()) {
      toast.error("Campaign name is required.");
      return;
    }
    // TipTap returns "<p></p>" for empty content — treat as empty
    const isEmpty = !rulesHtml || rulesHtml === "<p></p>" || rulesHtml.replace(/<[^>]*>/g, "").trim().length === 0;
    if (isEmpty) {
      toast.error("Please write at least one rule.");
      return;
    }
    saveMut.mutate({
      campaignPublicId: campaignPublicId.trim(),
      campaignName: campaignName.trim(),
      rulesHtml,
    });
  }

  return (
    <Card className="p-5 border-primary/30">
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Campaign public ID</Label>
            <Input
              placeholder="e.g. abc123xyz"
              value={campaignPublicId}
              onChange={(e) => setCampaignPublicId(e.target.value)}
              disabled={!!entry || saveMut.isPending}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Campaign name</Label>
            <Input
              placeholder="e.g. Nike Summer 2025"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              disabled={saveMut.isPending}
            />
          </div>
        </div>

        <Separator />

        <div className="space-y-1.5">
          <Label className="text-xs">Rules (rich text)</Label>
          <RichTextEditor
            content={rulesHtml}
            onChange={setRulesHtml}
            disabled={saveMut.isPending}
            placeholder="Write campaign rules here..."
          />
          <p className="text-[11px] text-muted-foreground">
            Use the toolbar to add bold text, bullet points, and numbered lists.
          </p>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={saveMut.isPending}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saveMut.isPending}>
            <Save className="h-4 w-4" /> Save rules
          </Button>
        </div>
      </div>
    </Card>
  );
}
