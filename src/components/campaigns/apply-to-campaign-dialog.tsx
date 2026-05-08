"use client";
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, UserCheck, CheckCircle2, Clock, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlatformIcon } from "@/components/platform-icon";
import { api, isUpstreamExpired } from "@/lib/api-client";
import { CampaignSummary } from "./types";
import { useRouter } from "next/navigation";

interface SocialsResp {
  socials: Array<{
    publicId: string;
    platform: string;
    handle: string;
    url: string;
    status?: string;
  }>;
}

export function ApplyToCampaignDialog({
  open,
  onOpenChange,
  campaign,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  campaign: CampaignSummary;
}) {
  const qc = useQueryClient();
  const router = useRouter();

  const { data, isLoading } = useQuery<SocialsResp>({
    queryKey: ["socials"],
    queryFn: () => api.get<SocialsResp>("/api/socials"),
    enabled: open,
  });

  // Filter to socials whose platform is supported by this campaign
  const allowedPlatforms = new Set(campaign.rates?.platforms ?? []);
  const eligible = (data?.socials ?? []).filter((s) =>
    allowedPlatforms.size === 0 ? true : allowedPlatforms.has(s.platform),
  );

  // Existing application status indexed by social publicId
  const appBySocial = new Map(
    campaign.applications.map((a) => [a.social.publicId, a]),
  );

  const [pendingId, setPendingId] = React.useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (socialPublicId: string) =>
      api.post<{ ok: true; message: string }>("/api/campaigns/apply", {
        campaignPublicId: campaign.publicId,
        socialPublicId,
      }),
    onSuccess: (resp) => {
      toast.success(resp.message || "Application sent");
      setPendingId(null);
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      qc.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: (err: unknown) => {
      setPendingId(null);
      if (isUpstreamExpired(err)) {
        toast.error("Session expired — please sign in again");
        router.replace("/login");
        return;
      }
      toast.error((err as Error)?.message || "Could not apply");
    },
  });

  function applyWith(socialPublicId: string) {
    setPendingId(socialPublicId);
    mutation.mutate(socialPublicId);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-scroll">
        <DialogHeader>
          <DialogTitle>Apply to campaign</DialogTitle>
          <DialogDescription>{campaign.name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-1">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading accounts…
            </div>
          ) : eligible.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No eligible social accounts.{" "}
              <a className="underline text-primary" href="/social-accounts">
                Add one on the Social Accounts page.
              </a>
            </p>
          ) : (
            eligible.map((social) => {
              const existing = appBySocial.get(social.publicId);
              const isPending = pendingId === social.publicId;

              return (
                <div
                  key={social.publicId}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <PlatformIcon
                    platform={social.platform}
                    className="h-5 w-5 flex-shrink-0 text-muted-foreground"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {social.url.split("/")[1]}
                    </div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {social.platform}
                    </div>
                  </div>

                  {existing ? (
                    <StatusBadge status={existing.status} />
                  ) : (
                    <Button
                      size="sm"
                      disabled={mutation.isPending}
                      onClick={() => applyWith(social.publicId)}
                    >
                      {isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <UserCheck className="h-3.5 w-3.5" />
                      )}
                      Apply
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "approved") {
    return (
      <Badge variant="success" className="gap-1">
        <CheckCircle2 className="h-3 w-3" /> Approved
      </Badge>
    );
  }
  if (status === "pending") {
    return (
      <Badge variant="warning" className="gap-1">
        <Clock className="h-3 w-3" /> Pending
      </Badge>
    );
  }
  if (status === "rejected") {
    return (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="h-3 w-3" /> Rejected
      </Badge>
    );
  }
  return <Badge variant="secondary">{status}</Badge>;
}
