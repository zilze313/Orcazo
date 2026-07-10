"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Check, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PlatformIcon } from "@/components/platform-icon";
import { api } from "@/lib/api-client";
import { RepostCampaignSummary } from "./types";

export function SubscribeDialog({
  open,
  onOpenChange,
  campaign,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  campaign: RepostCampaignSummary;
}) {
  const qc = useQueryClient();
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: ({ sourceAccountId, subscribe }: { sourceAccountId: string; subscribe: boolean }) =>
      api.post<{ ok: true; subscribed: boolean }>("/api/repost/subscribe", { sourceAccountId, subscribe }),
    onSuccess: () => {
      setPendingId(null);
      qc.invalidateQueries({ queryKey: ["repost", "campaigns"] });
    },
    onError: (err: unknown) => {
      setPendingId(null);
      toast.error((err as Error)?.message || "Could not update subscription");
    },
  });

  function toggle(accountId: string, next: boolean) {
    setPendingId(accountId);
    mutation.mutate({ sourceAccountId: accountId, subscribe: next });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-scroll">
        <DialogHeader>
          <DialogTitle>Subscribe to accounts</DialogTitle>
          <DialogDescription>{campaign.name} — follow any of these accounts to get notified when they post.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-1">
          {campaign.accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No accounts added to this program yet.
            </p>
          ) : (
            campaign.accounts.map((account) => {
              const isPending = pendingId === account.id;
              return (
                <div key={account.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <PlatformIcon platform={account.platform} className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {account.displayName || `@${account.handle}`}
                    </div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {account.platform} {account.displayName ? `· @${account.handle}` : ""}
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant={account.subscribed ? "outline" : "default"}
                    disabled={mutation.isPending}
                    onClick={() => toggle(account.id, !account.subscribed)}
                  >
                    {isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : account.subscribed ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                    {account.subscribed ? "Subscribed" : "Subscribe"}
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
