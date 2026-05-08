"use client";
import * as React from "react";
import Image from "next/image";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Heart,
  Send,
  UserCheck,
  BookOpen,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/utils";
import { api } from "@/lib/api-client";
import { PlatformIcon } from "@/components/platform-icon";
import { CampaignSummary } from "./types";
import { SubmitPostDialog } from "./submit-post-dialog";
import { ApplyToCampaignDialog } from "./apply-to-campaign-dialog";
import { CampaignDetailDialog } from "./campaign-detail-dialog";
import { RulesDialog } from "./rules-dialog";

function formatViews(n: number) {
  if (n >= 1_000_000)
    return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

export function CampaignCard({ campaign }: { campaign: CampaignSummary }) {
  const qc = useQueryClient();
  const [submitOpen, setSubmitOpen] = React.useState(false);
  const [applyOpen, setApplyOpen] = React.useState(false);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [rulesOpen, setRulesOpen] = React.useState(false);
  const [optimisticFav, setOptimisticFav] = React.useState<boolean | null>(
    null,
  );

  const isFav = optimisticFav ?? campaign.favorite;

  const favMutation = useMutation({
    mutationFn: (fav: boolean) =>
      api.post<{ ok: true }>("/api/campaigns/favorite", {
        campaignPublicId: campaign.publicId,
        favorite: fav,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaigns"] });
    },
    onError: (err: unknown) => {
      setOptimisticFav(null);
      toast.error((err as Error)?.message || "Could not update favorite");
    },
  });

  function toggleFavorite(e: React.MouseEvent) {
    e.stopPropagation();
    const next = !isFav;
    setOptimisticFav(next);
    favMutation.mutate(next);
  }

  // Rules are admin-managed rich-text HTML (never external URLs).
  const hasRules =
    typeof campaign.rules === "string" && campaign.rules.length > 0;

  function handleRules(e: React.MouseEvent) {
    e.stopPropagation();
    if (hasRules) setRulesOpen(true);
  }

  const standards = campaign.rates?.standards;
  const platforms = campaign.rates?.platforms ?? [];
  const languages = campaign.rates?.languages ?? [];

  // RPM = rates.range.max  (per spec; already halved server-side)
  const rpm = campaign.rates?.range?.max ?? null;

  const requiresApply = campaign.applyMode?.on === true;
  const approvedApps = campaign.applications.filter(
    (a) => a.status === "approved",
  );
  const pendingApps = campaign.applications.filter(
    (a) => a.status === "pending",
  );
  const rejectedApps = campaign.applications.filter(
    (a) => a.status === "rejected",
  );
  const hasApproved = approvedApps.length > 0;

  // applyMode.on === true → always show Apply; show Submit too when ≥1 approved
  // applyMode.on === false → only Submit
  const showApply = requiresApply;
  const showSubmit = !requiresApply || hasApproved;

  return (
    <>
      <Card
        className="flex flex-col overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => setDetailOpen(true)}
      >
        {/* Header */}
        <div className="p-4 flex items-start gap-3">
          <div className="h-11 w-11 rounded-lg bg-secondary overflow-hidden flex-shrink-0 relative">
            {campaign.icon && (
              <Image
                src={campaign.icon}
                alt=""
                fill
                sizes="44px"
                className="object-cover"
                unoptimized
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm leading-tight line-clamp-2">
              {campaign.name}
            </h3>
            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
              {platforms.map((p) => (
                <PlatformIcon
                  key={p}
                  platform={p}
                  className="h-3.5 w-3.5 text-muted-foreground"
                />
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={toggleFavorite}
            disabled={favMutation.isPending}
            aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
            className={`flex-shrink-0 p-1.5 rounded-md transition-colors hover:bg-secondary ${isFav ? "text-red-500" : "text-muted-foreground"}`}
          >
            <Heart className={`h-4 w-4 ${isFav ? "fill-current" : ""}`} />
          </button>
        </div>

        {/* Stats grid */}
        <div className="px-4 pb-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <Stat label="RPM" value={rpm != null ? formatMoney(rpm) : "—"} />
          <Stat
            label="Cap / post"
            value={standards ? formatMoney(standards.cap) : "—"}
          />
          <Stat
            label="Min views"
            value={standards ? formatViews(standards.threshold) : "—"}
          />
          <Stat
            label="Base"
            value={standards ? formatMoney(standards.base) : "—"}
          />
          {campaign.approvalRate != null && (
            <Stat
              label="Approval"
              value={`${Math.round(campaign.approvalRate)}%`}
            />
          )}
          {languages.length > 0 && (
            <Stat
              label="Languages"
              value={
                languages
                  .slice(0, 2)
                  .map((l) => l.charAt(0).toUpperCase() + l.slice(1))
                  .join(", ") + (languages.length > 2 ? "…" : "")
              }
            />
          )}
        </div>

        {/* Application status badges */}
        {/* {campaign.applications.length > 0 && (
          <div className="px-4 pb-3 flex flex-wrap gap-1">
            {approvedApps.map((a) => (
              <Badge
                key={`a-${a.social.publicId}`}
                variant="success"
                className="gap-1 text-[10px]"
              >
                <CheckCircle2 className="h-2.5 w-2.5" /> @{a.social.username}
              </Badge>
            ))}
            {pendingApps.map((a) => (
              <Badge
                key={`p-${a.social.publicId}`}
                variant="warning"
                className="gap-1 text-[10px]"
              >
                <Clock className="h-2.5 w-2.5" /> @{a.social.username}
              </Badge>
            ))}
            {rejectedApps.map((a) => (
              <Badge
                key={`r-${a.social.publicId}`}
                variant="destructive"
                className="gap-1 text-[10px]"
              >
                <XCircle className="h-2.5 w-2.5" /> @{a.social.username}
              </Badge>
            ))}
          </div>
        )} */}

        {/* Action buttons */}
        <div
          className="border-t p-3 mt-auto flex gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          {hasRules && (
            <Button
              size="sm"
              variant="outline"
              className="flex-shrink-0"
              onClick={handleRules}
            >
              <BookOpen className="h-3.5 w-3.5" /> Rules
            </Button>
          )}

          {showApply && (
            <Button
              size="sm"
              variant={hasApproved ? "outline" : "default"}
              className="flex-1"
              onClick={(e) => {
                e.stopPropagation();
                setApplyOpen(true);
              }}
            >
              <UserCheck className="h-3.5 w-3.5" /> Apply
            </Button>
          )}

          {showSubmit && (
            <Button
              size="sm"
              className="flex-1"
              onClick={(e) => {
                e.stopPropagation();
                setSubmitOpen(true);
              }}
            >
              <Send className="h-3.5 w-3.5" /> Submit Post
            </Button>
          )}
        </div>
      </Card>

      <SubmitPostDialog
        open={submitOpen}
        onOpenChange={setSubmitOpen}
        campaign={campaign}
      />
      <ApplyToCampaignDialog
        open={applyOpen}
        onOpenChange={setApplyOpen}
        campaign={campaign}
      />
      <CampaignDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        campaign={campaign}
      />
      {hasRules && (
        <RulesDialog
          open={rulesOpen}
          onOpenChange={setRulesOpen}
          campaignName={campaign.name}
          rulesHtml={campaign.rules as string}
        />
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted-foreground text-[10px] leading-none mb-0.5 uppercase tracking-wide">
        {label}
      </div>
      <div className="font-medium tabular-nums">{value}</div>
    </div>
  );
}
