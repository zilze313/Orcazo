"use client";
import * as React from "react";
import Image from "next/image";
import { Repeat, BookOpen } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlatformIcon } from "@/components/platform-icon";
import { RulesDialog } from "@/components/campaigns/rules-dialog";
import { RepostCampaignSummary } from "./types";
import { SubscribeDialog } from "./subscribe-dialog";

export function RepostCampaignCard({ campaign }: { campaign: RepostCampaignSummary }) {
  const [subscribeOpen, setSubscribeOpen] = React.useState(false);
  const [rulesOpen, setRulesOpen] = React.useState(false);

  const platforms = Array.from(new Set(campaign.accounts.map((a) => a.platform)));
  const subscribedCount = campaign.accounts.filter((a) => a.subscribed).length;
  const hasRules = typeof campaign.rulesHtml === "string" && campaign.rulesHtml.length > 0;

  return (
    <>
      <Card className="flex flex-col overflow-hidden">
        <div className="p-4 flex items-start gap-3">
          <div className="h-11 w-11 rounded-lg bg-secondary overflow-hidden flex-shrink-0 relative">
            {campaign.iconUrl ? (
              <Image src={campaign.iconUrl} alt="" fill sizes="44px" className="object-cover" unoptimized />
            ) : (
              <div className="h-full w-full grid place-items-center text-muted-foreground">
                <Repeat className="h-5 w-5" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-sm leading-tight line-clamp-2">{campaign.name}</h3>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
              {platforms.map((p) => (
                <PlatformIcon key={p} platform={p} className="h-3.5 w-3.5 text-muted-foreground" />
              ))}
            </div>
          </div>
        </div>

        {campaign.description && (
          <p className="px-4 pb-3 text-xs text-muted-foreground line-clamp-3">{campaign.description}</p>
        )}

        <div className="px-4 pb-3 text-xs text-muted-foreground">
          {subscribedCount > 0
            ? `Subscribed to ${subscribedCount} of ${campaign.accounts.length} account${campaign.accounts.length === 1 ? "" : "s"}`
            : `${campaign.accounts.length} account${campaign.accounts.length === 1 ? "" : "s"} to follow`}
        </div>

        <div className="border-t p-3 mt-auto flex gap-2">
          {hasRules && (
            <Button size="sm" variant="outline" className="flex-shrink-0" onClick={() => setRulesOpen(true)}>
              <BookOpen className="h-3.5 w-3.5" /> Rules
            </Button>
          )}
          <Button size="sm" className="flex-1" onClick={() => setSubscribeOpen(true)}>
            <Repeat className="h-3.5 w-3.5" /> Subscribe
          </Button>
        </div>
      </Card>

      <SubscribeDialog open={subscribeOpen} onOpenChange={setSubscribeOpen} campaign={campaign} />
      {hasRules && (
        <RulesDialog
          open={rulesOpen}
          onOpenChange={setRulesOpen}
          campaignName={campaign.name}
          rulesHtml={campaign.rulesHtml as string}
        />
      )}
    </>
  );
}
