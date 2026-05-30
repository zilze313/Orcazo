'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Inbox, ExternalLink, Check, RotateCcw, Loader2, ChevronDown, ChevronRight, User as UserIcon, Mail,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api-client';
import { formatRelative } from '@/lib/utils';

interface InboundEvent {
  id: string;
  to: string;
  fromAddress: string | null;
  subject: string | null;
  confirmUrl: string | null;
  bodySnippet: string | null;
  dismissedAt: string | null;
  createdAt: string;
  ownerEmail: string | null;
}

interface EventsResp {
  events: InboundEvent[];
}

export default function InboundMailPage() {
  const qc = useQueryClient();
  const [status, setStatus] = React.useState<'pending' | 'all'>('pending');
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  const events = useQuery<EventsResp>({
    queryKey: ['admin', 'inbound-mail', status],
    queryFn: () => api.get<EventsResp>(`/api/admin/inbound-mail?status=${status}`),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const dismissMut = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'dismiss' | 'restore' }) =>
      fetch(`/api/admin/inbound-mail/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error || 'Failed');
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'inbound-mail'] }),
    onError: (err: unknown) => toast.error((err as Error)?.message || 'Action failed'),
  });

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const rows = events.data?.events ?? [];

  return (
    <>
      <PageHeader
        title="Inbound Mail"
        description="Emails received at creator inbound addresses where no OTP was found — usually Gmail forwarding confirmations."
      />

      <div className="container max-w-4xl py-6 space-y-4">
        {/* Status toggle */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={status === 'pending' ? 'default' : 'outline'}
            onClick={() => setStatus('pending')}
          >
            Pending
          </Button>
          <Button
            size="sm"
            variant={status === 'all' ? 'default' : 'outline'}
            onClick={() => setStatus('all')}
          >
            All (incl. dismissed)
          </Button>
          <div className="flex-1" />
          <p className="text-xs text-muted-foreground self-center">
            Auto-purged after 30 days.
          </p>
        </div>

        {events.isLoading ? (
          <Card className="p-4 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
          </Card>
        ) : rows.length === 0 ? (
          <Card className="p-10 text-center text-sm text-muted-foreground">
            <Inbox className="h-8 w-8 mx-auto mb-3 opacity-50" />
            {status === 'pending'
              ? "No pending inbound mail. You're all caught up."
              : 'No inbound mail events on record.'}
          </Card>
        ) : (
          <Card className="divide-y">
            {rows.map((e) => {
              const isExpanded = expanded.has(e.id);
              const isDismissed = e.dismissedAt !== null;
              return (
                <div key={e.id} className={isDismissed ? 'opacity-60' : ''}>
                  {/* Row header */}
                  <div className="p-4 space-y-2">
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => toggleExpand(e.id)}
                        className="flex-shrink-0 mt-0.5 text-muted-foreground hover:text-foreground"
                        aria-label={isExpanded ? 'Collapse' : 'Expand'}
                      >
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                          <p className="text-sm font-medium truncate">
                            {e.subject || '(no subject)'}
                          </p>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatRelative(e.createdAt)}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
                          <span className="inline-flex items-center gap-1">
                            <Mail className="h-3 w-3" /> to <code className="text-foreground">{e.to}</code>
                          </span>
                          {e.fromAddress && (
                            <span className="inline-flex items-center gap-1">
                              from <code className="text-foreground">{e.fromAddress}</code>
                            </span>
                          )}
                          {e.ownerEmail && (
                            <span className="inline-flex items-center gap-1">
                              <UserIcon className="h-3 w-3" /> for <code className="text-foreground">{e.ownerEmail}</code>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex-shrink-0 flex gap-1.5">
                        {e.confirmUrl && (
                          <Button
                            size="sm"
                            asChild
                            className="gap-1.5 h-8 text-xs"
                          >
                            <a href={e.confirmUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3.5 w-3.5" /> Confirm
                            </a>
                          </Button>
                        )}
                        {isDismissed ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1.5 h-8 text-xs"
                            disabled={dismissMut.isPending}
                            onClick={() => dismissMut.mutate({ id: e.id, action: 'restore' })}
                          >
                            <RotateCcw className="h-3.5 w-3.5" /> Restore
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 h-8 text-xs"
                            disabled={dismissMut.isPending}
                            onClick={() => dismissMut.mutate({ id: e.id, action: 'dismiss' })}
                          >
                            {dismissMut.isPending && dismissMut.variables?.id === e.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="h-3.5 w-3.5" />
                            )}
                            Dismiss
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expandable body snippet */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pl-11 space-y-2">
                      {e.confirmUrl && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">Confirmation URL: </span>
                          <a
                            href={e.confirmUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-foreground underline underline-offset-2 break-all"
                          >
                            {e.confirmUrl}
                          </a>
                        </div>
                      )}
                      {e.bodySnippet ? (
                        <pre className="text-xs bg-muted rounded p-3 whitespace-pre-wrap break-words max-h-80 overflow-auto font-mono leading-relaxed">
                          {e.bodySnippet}
                        </pre>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">No readable body extracted.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </Card>
        )}
      </div>
    </>
  );
}
