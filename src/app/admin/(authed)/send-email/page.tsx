'use client';

import * as React from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Mail, Send, Loader2, Search, User } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api-client';

interface EmployeeRow {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}
interface EmployeesResp {
  employees: EmployeeRow[];
}

export default function SendEmailPage() {
  const [search, setSearch]   = React.useState('');
  const [email, setEmail]     = React.useState('');
  const [heading, setHeading] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [preview, setPreview] = React.useState(false);

  // Debounced search of creators (only fires once the admin has typed something)
  const [debounced, setDebounced] = React.useState('');
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const results = useQuery<EmployeesResp>({
    queryKey: ['admin', 'send-email', 'search', debounced],
    queryFn: () =>
      api.get<EmployeesResp>(`/api/admin/employees?search=${encodeURIComponent(debounced)}&pageSize=8`),
    enabled: debounced.length >= 2,
    staleTime: 30_000,
  });

  const sendMut = useMutation({
    mutationFn: () =>
      fetch('/api/admin/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), heading: heading.trim(), message: message.trim() }),
      }).then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || 'Failed to send');
        return json as { ok: boolean; delivered: boolean };
      }),
    onSuccess: (data) => {
      toast.success(
        data.delivered
          ? `Email sent to ${email}`
          : `Email queued (Resend not configured — logged only)`,
      );
      setHeading('');
      setMessage('');
      setEmail('');
      setSearch('');
      setPreview(false);
    },
    onError: (err: unknown) => toast.error((err as Error)?.message || 'Could not send email'),
  });

  function pickCreator(c: EmployeeRow) {
    setEmail(c.email);
    setSearch('');
  }

  function handleSend() {
    if (!email.trim())   { toast.error('Pick a recipient first');     return; }
    if (!heading.trim()) { toast.error('Heading is required');         return; }
    if (!message.trim()) { toast.error('Message is required');         return; }
    sendMut.mutate();
  }

  return (
    <>
      <PageHeader
        title="Send Email"
        description="Send a direct email to a single creator using the Orcazo template."
      />

      <div className="container max-w-3xl py-6 space-y-6">
        <Card className="p-5 space-y-4">
          {/* Recipient */}
          <div className="space-y-1.5">
            <Label>Recipient</Label>
            {email ? (
              <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm truncate">{email}</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setEmail('')}
                  disabled={sendMut.isPending}
                >
                  Change
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or email…"
                    className="pl-9"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    disabled={sendMut.isPending}
                  />
                </div>
                {debounced.length >= 2 && (
                  <div className="rounded-md border max-h-64 overflow-auto divide-y">
                    {results.isLoading ? (
                      <div className="p-3 text-xs text-muted-foreground flex items-center gap-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
                      </div>
                    ) : (results.data?.employees.length ?? 0) === 0 ? (
                      <div className="p-3 text-xs text-muted-foreground">No creators found.</div>
                    ) : (
                      results.data!.employees.map((c) => {
                        const name = [c.firstName, c.lastName].filter(Boolean).join(' ');
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => pickCreator(c)}
                            className="w-full text-left px-3 py-2 hover:bg-muted/50 flex items-center gap-2"
                          >
                            <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              {name && <p className="text-sm truncate">{name}</p>}
                              <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Heading */}
          <div className="space-y-1.5">
            <Label>Heading</Label>
            <Input
              placeholder="e.g. Update on your last submission"
              value={heading}
              onChange={(e) => setHeading(e.target.value)}
              maxLength={200}
              disabled={sendMut.isPending}
            />
            <p className="text-xs text-muted-foreground">
              Shown as the email subject and the bold title at the top of the message.
            </p>
          </div>

          {/* Message */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Message</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setPreview((v) => !v)}
                disabled={!heading.trim() || !message.trim()}
              >
                {preview ? 'Edit' : 'Preview'}
              </Button>
            </div>

            {preview ? (
              <PreviewBox heading={heading} message={message} />
            ) : (
              <textarea
                className="flex min-h-[220px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                placeholder={'Write your message here.\n\nLeave a blank line between paragraphs.'}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={10_000}
                disabled={sendMut.isPending}
              />
            )}
            <p className="text-xs text-muted-foreground">
              Plain text — we'll style it. Blank lines start new paragraphs.
            </p>
          </div>

          <Button
            onClick={handleSend}
            disabled={sendMut.isPending || !email.trim() || !heading.trim() || !message.trim()}
            className="gap-2"
          >
            {sendMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send email
          </Button>
        </Card>
      </div>
    </>
  );
}

// Client-side preview that mirrors the server template just closely enough to
// give the admin a sense of layout. Server is the source of truth.
function PreviewBox({ heading, message }: { heading: string; message: string }) {
  const paragraphs = message
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="rounded-md border bg-background p-6 text-sm">
      <div className="max-w-[480px] mx-auto">
        <div className="text-center mb-6">
          <span className="inline-block px-3 py-1.5 rounded bg-black text-white text-xs font-semibold tracking-wider">
            <Mail className="h-3 w-3 inline mr-1" /> Orcazo
          </span>
        </div>
        <h1 className="text-lg font-semibold mb-4 text-foreground">{heading || 'Heading'}</h1>
        {paragraphs.length === 0 ? (
          <p className="text-muted-foreground italic">Your message will appear here…</p>
        ) : (
          paragraphs.map((p, i) => (
            <p key={i} className="text-sm leading-relaxed mb-3 whitespace-pre-line text-foreground">
              {p}
            </p>
          ))
        )}
        <p className="text-xs text-muted-foreground mt-6">— The Orcazo team</p>
      </div>
    </div>
  );
}
