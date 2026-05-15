'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { Compass, Search } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import { PaginationBar } from '@/components/pagination-bar';
import { CampaignCard } from '@/components/campaigns/campaign-card';
import { CampaignsResponse } from '@/components/campaigns/types';
import { api, isUpstreamExpired } from '@/lib/api-client';

export default function CampaignsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const page = Math.max(1, parseInt(params.get('page') || '1', 10));
  const search = params.get('search') || '';
  const [searchInput, setSearchInput] = React.useState(search);

  // debounce search input → URL
  React.useEffect(() => {
    const t = setTimeout(() => {
      const u = new URLSearchParams(params);
      if (searchInput) u.set('search', searchInput); else u.delete('search');
      u.set('page', '1');
      router.replace(`/campaigns?${u.toString()}`, { scroll: false });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const query = useQuery<CampaignsResponse>({
    queryKey: ['campaigns', page, search],
    queryFn: () => {
      const u = new URLSearchParams({ page: String(page), pageSize: '24' });
      if (search) u.set('search', search);
      return api.get<CampaignsResponse>(`/api/campaigns?${u.toString()}`);
    },
    staleTime: 30_000,
  });

  React.useEffect(() => {
    if (query.error && isUpstreamExpired(query.error)) router.replace('/login');
  }, [query.error, router]);

  const setPage = (p: number) => {
    const u = new URLSearchParams(params);
    u.set('page', String(p));
    router.replace(`/campaigns?${u.toString()}`, { scroll: false });
  };

  return (
    <>
      <PageHeader
        title="Explore Campaigns"
        description="Browse all available campaigns and submit your videos."
        actions={
          <div className="relative w-full sm:w-72">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search campaigns…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>
        }
      />
      <div className="container max-w-7xl py-6">
        {query.isLoading ? (
          <Grid>{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-72" />)}</Grid>
        ) : query.error ? (
          <EmptyState
            icon={Compass}
            title="Couldn't load campaigns"
            description={(query.error as Error).message}
          />
        ) : query.data && query.data.items.length === 0 ? (
          <EmptyState
            icon={Compass}
            title={search ? 'No campaigns match your search' : 'No campaigns yet'}
            description={search ? 'Try a different search term.' : 'Check back soon — new campaigns are added regularly.'}
            action={search ? (
              <Button size="sm" variant="outline" onClick={() => setSearchInput('')}>
                Clear search
              </Button>
            ) : undefined}
          />
        ) : (
          <>
            <Grid>{query.data!.items.map((c) => <CampaignCard key={c.publicId} campaign={c} />)}</Grid>
            <PaginationBar
              page={query.data!.pagination.page}
              totalPages={query.data!.pagination.totalPages}
              total={query.data!.pagination.total}
              onPageChange={setPage}
            />
          </>
        )}
      </div>
    </>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{children}</div>;
}
