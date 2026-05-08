'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Megaphone, Heart, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import { CampaignsResponse } from '@/components/campaigns/types';
import { CampaignCard } from '@/components/campaigns/campaign-card';
import { PlatformIcon } from '@/components/platform-icon';
import { formatRelative } from '@/lib/utils';
import { api, isUpstreamExpired } from '@/lib/api-client';
import * as React from 'react';

const STATUS_META: Record<string, { variant: 'success' | 'warning' | 'destructive' | 'secondary'; icon: React.ComponentType<{ className?: string }>; label: string }> = {
  approved: { variant: 'success',     icon: CheckCircle2, label: 'Approved' },
  pending:  { variant: 'warning',     icon: Clock,        label: 'Pending'  },
  rejected: { variant: 'destructive', icon: XCircle,      label: 'Rejected' },
};

export default function MyCampaignsPage() {
  const router = useRouter();

  const query = useQuery<CampaignsResponse>({
    queryKey: ['campaigns', 'mine'],
    queryFn: () => api.get<CampaignsResponse>(`/api/campaigns?page=1&pageSize=60`),
    staleTime: 15_000,
  });

  React.useEffect(() => {
    if (query.error && isUpstreamExpired(query.error)) router.replace('/login');
  }, [query.error, router]);

  const campaigns = query.data?.items ?? [];
  const favorites = campaigns.filter((c) => c.favorite);

  const appliedRows = campaigns
    .filter((c) => c.applications.length > 0)
    .flatMap((c) => c.applications.map((a) => ({ campaign: c, app: a })))
    .sort((a, b) => new Date(b.app.appliedAt).getTime() - new Date(a.app.appliedAt).getTime());

  return (
    <>
      <PageHeader title="My Campaigns" description="Your favorited campaigns and your applications." />
      <div className="container max-w-7xl py-6 space-y-8">
        {query.isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-72" />)}
          </div>
        ) : (
          <>
            {/* Favorites — same CampaignCard as Explore page (clickable, full functionality) */}
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
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {favorites.map((c) => (
                    <CampaignCard key={c.publicId} campaign={c} />
                  ))}
                </div>
              )}
            </section>

            {/* Applications */}
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Megaphone className="h-4 w-4" />
                Applications
              </h2>
              {appliedRows.length === 0 ? (
                <EmptyState
                  icon={Megaphone}
                  title="No applications yet"
                  description="Head over to Explore Campaigns to apply."
                />
              ) : (
                <div className="space-y-3">
                  {appliedRows.map(({ campaign, app }) => {
                    const meta = STATUS_META[app.status] ?? { variant: 'secondary' as const, icon: Clock, label: app.status };
                    const Icon = meta.icon;
                    return (
                      <Card key={`${campaign.publicId}-${app.social.publicId}`} className="p-4 flex items-center gap-4">
                        <div className="h-10 w-10 rounded-md bg-secondary overflow-hidden flex-shrink-0 relative">
                          {campaign.icon && (
                            <Image src={campaign.icon} alt="" fill sizes="40px" className="object-cover" unoptimized />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">{campaign.name}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <PlatformIcon platform={app.social.platform} className="h-3 w-3" />
                            <span>@{app.social.username}</span>
                            <span>· applied {formatRelative(app.appliedAt)}</span>
                          </div>
                        </div>
                        <Badge variant={meta.variant} className="gap-1 flex-shrink-0">
                          <Icon className="h-3 w-3" /> {meta.label}
                        </Badge>
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
}
