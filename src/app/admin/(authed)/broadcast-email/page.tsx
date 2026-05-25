'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Mail, Send, Loader2, Clock, Users } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api-client';
import { formatRelative } from '@/lib/utils';

interface BroadcastRecord {
  id: string;
  subject: string;
  recipientCount: number;
  createdAt: string;
}

interface HistoryResp {
  history: BroadcastRecord[];
}

interface SendResp {
  sent: number;
  failed: number;
  total: number;
}

export default function BroadcastEmailPage() {
  const qc = useQueryClient();
  const [subject, setSubject]     = React.useState('');
  const [bodyHtml, setBodyHtml]   = React.useState('');
  const [preview, setPreview]     = React.useState(false);

  const history = useQuery<HistoryResp>({
    queryKey: ['admin', 'broadcast-email'],
    queryFn: () => api.get<HistoryResp>('/api/admin/broadcast-email'),
    staleTime: 30_000,
  });

  const sendMut = useMutation({
    mutationFn: () =>
      fetch('/api/admin/broadcast-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: subject.trim(), bodyHtml: bodyHtml.trim() }),
      }).then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || 'Failed to send');
        return json as SendResp;
      }),
    onSuccess: (data) => {
      toast.success(`Email sent to ${data.sent} creator${data.sent !== 1 ? 's' : ''}${data.failed > 0 ? ` (${data.failed} failed)` : ''}`);
      setSubject('');
      setBodyHtml('');
      setPreview(false);
      qc.invalidateQueries({ queryKey: ['admin', 'broadcast-email'] });
    },
    onError: (err: unknown) => toast.error((err as Error)?.message || 'Could not send email'),
  });

  function handleSend() {
    if (!subject.trim()) { toast.error('Subject is required'); return; }
    if (!bodyHtml.trim()) { toast.error('Email body is required'); return; }
    if (!confirm(`Send this email to ALL creators on the platform? This cannot be undone.`)) return;
    sendMut.mutate();
  }

  return (
    <>
      <PageHeader
        title="Broadcast Email"
        description="Compose and send an email to all creators on the platform."
      />

      <div className="container max-w-3xl py-6 space-y-6">
        {/* Compose */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Compose</h3>
          </div>

          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Input
              placeholder="e.g. Important update from the team"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={sendMut.isPending}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Body (HTML)</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setPreview((v) => !v)}
                disabled={!bodyHtml.trim()}
              >
                {preview ? 'Edit' : 'Preview'}
              </Button>
            </div>

            {preview ? (
              <div
                className="min-h-[300px] rounded-md border bg-background p-4 text-sm overflow-auto prose prose-sm dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: bodyHtml }}
              />
            ) : (
              <textarea
                className="flex min-h-[300px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                placeholder={`<p>Hello creator,</p>\n\n<p>We have an exciting update for you...</p>\n\n<p>Best,<br/>The Orcazo Team</p>`}
                value={bodyHtml}
                onChange={(e) => setBodyHtml(e.target.value)}
                disabled={sendMut.isPending}
              />
            )}
            <p className="text-xs text-muted-foreground">
              Write valid HTML. Use {'<p>'}, {'<b>'}, {'<a href="...">'}, etc.
              The email is sent with platform branding via Resend.
            </p>
          </div>

          <Button
            onClick={handleSend}
            disabled={sendMut.isPending || !subject.trim() || !bodyHtml.trim()}
            className="gap-2"
          >
            {sendMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send to all creators
          </Button>
        </Card>

        {/* History */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4" /> Broadcast history
          </h3>
          <Card>
            {history.isLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
              </div>
            ) : (history.data?.history.length ?? 0) === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No broadcasts sent yet.
              </div>
            ) : (
              <ul className="divide-y">
                {history.data!.history.map((b) => (
                  <li key={b.id} className="px-4 py-3 flex items-center gap-4">
                    <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{b.subject}</p>
                      <p className="text-xs text-muted-foreground">{formatRelative(b.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                      <Users className="h-3.5 w-3.5" />
                      {b.recipientCount}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
