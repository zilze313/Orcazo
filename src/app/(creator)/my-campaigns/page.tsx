"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Heart } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { CampaignsResponse } from "@/components/campaigns/types";
import { CampaignCard } from "@/components/campaigns/campaign-card";
import { api, isUpstreamExpired } from "@/lib/api-client";
import * as React from "react";

export default function MyCampaignsPage() {
  const router = useRouter();

  const query = useQuery<CampaignsResponse>({
    queryKey: ["campaigns", "mine"],
    queryFn: () =>
      api.get<CampaignsResponse>(`/api/campaigns?page=1&pageSize=60`),
    staleTime: 15_000,
  });

  React.useEffect(() => {
    if (query.error && isUpstreamExpired(query.error)) router.replace("/login");
  }, [query.error, router]);

  const campaigns = query.data?.items ?? [];
  const favorites = campaigns.filter((c) => c.favorite);

  return (
    <>
      <PageHeader
        title="My Campaigns"
        description="Your favorited campaigns."
      />
      <div className="container max-w-7xl py-6 space-y-8">
        {query.isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-72" />
            ))}
          </div>
        ) : (
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <Heart className="h-4 w-4 text-red-500 fill-red-500" />
              Favorites
            </h2>
            {favorites.length === 0 ? (
              <EmptyState
                icon={Heart}
                title="No favorited campaigns"
                description="Click the heart icon on any campaign card to save it here."
                action={
                  <Button asChild size="sm">
                    <Link href="/campaigns">Browse campaigns</Link>
                  </Button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {favorites.map((c) => (
                  <CampaignCard key={c.publicId} campaign={c} />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </>
  );
}
