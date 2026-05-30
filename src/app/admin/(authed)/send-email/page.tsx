'use client';

import * as React from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Mail, Send, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SendEmailPage() {
  const [email, setEmail]     = React.useState('');
  const [heading, setHeading] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [preview, setPreview] = React.useState(false);

  const emailValid = EMAIL_RE.test(email.trim());
  const canSend    = emailValid && heading.trim() && message.trim();

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
          ? `Email sent to ${email.trim()}`
          : `Email queued (Resend not configured — logged only)`,
      );
      setEmail('');
      setHeading('');
      setMessage('');
      setPreview(false);
    },
    onError: (err: unknown) => toast.error((err as Error)?.message || 'Could not send email'),
  });

  function handleSend() {
    if (!emailValid)     { toast.error('Enter a valid email address'); return; }
    if (!heading.trim()) { toast.error('Heading is required');          return; }
    if (!message.trim()) { toast.error('Message is required');          return; }
    sendMut.mutate();
  }

  return (
    <>
      <PageHeader
        title="Send Email"
        description="Send a direct email to any address using the Orcazo template."
      />

      <div className="container max-w-3xl py-6 space-y-6">
        <Card className="p-5 space-y-4">
          {/* Recipient */}
          <div className="space-y-1.5">
            <Label>Recipient email</Label>
            <Input
              type="email"
              autoComplete="off"
              placeholder="anyone@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={sendMut.isPending}
            />
            <p className="text-xs text-muted-foreground">
              Any email address — the recipient does not need to be a registered creator.
            </p>
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
            disabled={sendMut.isPending || !canSend}
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
