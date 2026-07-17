'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Send, Loader2, CheckCircle2, Mail, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { MarketingNav } from '@/components/marketing/marketing-nav';
import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { TurnstileWidget } from '@/components/turnstile-widget';

const formSchema = z.object({
  name:    z.string().trim().min(2, 'Enter your name').max(120),
  email:   z.string().trim().toLowerCase().email('Enter a valid email').max(254),
  subject: z.string().trim().min(3, 'Add a subject').max(200),
  message: z.string().trim().min(10, 'Tell us a bit more').max(5000),
});

type FormData = z.infer<typeof formSchema>;

export function ContactPageClient() {
  const [turnstileToken, setTurnstileToken] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', email: '', subject: '', message: '' },
  });

  const mutation = useMutation({
    mutationFn: async (values: FormData) => {
      const res = await fetch('/api/public/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, turnstileToken }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to send');
      return json;
    },
    onSuccess: () => {
      setSent(true);
      form.reset();
    },
    onError: (err: unknown) => toast.error((err as Error)?.message || 'Could not send'),
  });

  return (
    <div className="theme-light flex flex-col min-h-screen bg-background text-foreground">
      <MarketingNav />

      <main className="flex-1">
        <section className="container max-w-3xl px-4 py-16 sm:py-20">
          <div className="text-center max-w-xl mx-auto mb-10">
            <span className="inline-flex items-center gap-2 rounded-full bg-accent text-primary text-xs font-bold px-3.5 py-1.5 mb-5">
              <MessageCircle className="h-3.5 w-3.5" /> We typically reply within 24 hours
            </span>
            <h1 className="text-display text-3xl sm:text-[2.6rem]">
              Get in touch
            </h1>
            <p className="mt-4 text-muted-foreground font-medium leading-relaxed">
              Have a question about Orcazo, a campaign, or your account? Drop us a message —
              no account required. We read every message.
            </p>
          </div>

          {sent ? (
            <Card className="p-8 text-center max-w-xl mx-auto border-green-500/40 bg-green-500/5">
              <div className="inline-flex w-12 h-12 rounded-full bg-green-500/15 items-center justify-center mb-4">
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-lg font-semibold mb-1">Message sent</h2>
              <p className="text-sm text-muted-foreground mb-5">
                Thanks for reaching out — our team will reply to your email soon.
              </p>
              <Button variant="outline" onClick={() => setSent(false)}>
                Send another message
              </Button>
            </Card>
          ) : (
            <Card className="p-6 sm:p-8 max-w-xl mx-auto">
              <form
                onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Your name" error={form.formState.errors.name?.message}>
                    <Input
                      placeholder="Jane Doe"
                      disabled={mutation.isPending}
                      {...form.register('name')}
                    />
                  </Field>
                  <Field label="Email" error={form.formState.errors.email?.message}>
                    <Input
                      type="email"
                      placeholder="you@example.com"
                      disabled={mutation.isPending}
                      {...form.register('email')}
                    />
                  </Field>
                </div>

                <Field label="Subject" error={form.formState.errors.subject?.message}>
                  <Input
                    placeholder="What's this about?"
                    disabled={mutation.isPending}
                    {...form.register('subject')}
                  />
                </Field>

                <Field label="Message" error={form.formState.errors.message?.message}>
                  <textarea
                    className="flex min-h-[140px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                    placeholder="Share as much detail as you can — links, screenshots descriptions, what you tried, etc."
                    disabled={mutation.isPending}
                    maxLength={5000}
                    {...form.register('message')}
                  />
                </Field>

                <TurnstileWidget onToken={setTurnstileToken} className="my-2" />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={mutation.isPending || !turnstileToken}
                >
                  {mutation.isPending
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Send className="h-4 w-4" />}
                  Send message
                </Button>

                <p className="text-xs text-muted-foreground text-center pt-2 flex items-center justify-center gap-1.5">
                  <Mail className="h-3 w-3" />
                  We'll reply to the email address you provide above.
                </p>
              </form>
            </Card>
          )}
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}

function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
