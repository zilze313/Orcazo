"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Megaphone } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function UpdatesPage() {
  const { data, isLoading } = useQuery<ListResp>({
    queryKey: ["updates"],
    queryFn: () => api.get<ListResp>("/api/updates"),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  return (
    <>
      <PageHeader
        title="Updates"
        description="News and announcements from the Orcazo team."
      />

      <div className="container max-w-3xl py-6 space-y-4">
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : (data?.announcements.length ?? 0) === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="No updates yet"
            description="Check back here for news and announcements from the team."
          />
        ) : (
          data!.announcements.map((item) => (
            <Card key={item.id} className="p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <h2 className="font-semibold text-base leading-snug">{item.title}</h2>
                <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                  {formatDate(item.createdAt)}
                </span>
              </div>
              <div
                className="prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: item.contentHtml }}
              />
            </Card>
          ))
        )}
      </div>
    </>
  );
}
