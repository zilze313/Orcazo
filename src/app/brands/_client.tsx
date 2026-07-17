'use client';

// Public "launch a campaign" page for brands. Submits a lead into the admin
// panel — no brand account is created. Rate-limited + Turnstile-gated API.

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Send, Loader2, CheckCircle2, Megaphone, Eye, Zap, Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { MarketingNav } from '@/components/marketing/marketing-nav';
import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { TurnstileWidget } from '@/components/turnstile-widget';
import { PlatformIcon } from '@/components/platform-icon';

const BUDGETS = [
  { value: 'under-1000', label: 'Under $1,000' },
  { value: '1000-5000', label: '$1,000 – $5,000' },
  { value: '5000-10000', label: '$5,000 – $10,000' },
  { value: '10000-25000', label: '$10,000 – $25,000' },
  { value: '25000-plus', label: '$25,000+' },
] as const;

const PLATFORM_OPTIONS = ['tiktok', 'instagram', 'youtube', 'snapchat', 'other'] as const;

const formSchema = z.object({
  brandName: z.string().trim().min(2, 'Enter your brand name').max(120),
  contactName: z.string().trim().min(2, 'Enter your name').max(120),
  email: z.string().trim().toLowerCase().email('Enter a valid email').max(254),
  website: z.string().trim().max(300).optional().or(z.literal('')),
  campaignName: z.string().trim().min(3, 'Give your campaign a name').max(160),
  budget: z.enum(BUDGETS.map((b) => b.value) as [string, ...string[]], {
    required_error: 'Pick a budget range',
  }),
  description: z.string().trim().max(3000).optional().or(z.literal('')),
});

type FormData = z.infer<typeof formSchema>;

const VALUE_PROPS = [
  {
    icon: Users,
    title: 'A creator army, on demand',
    body: 'Hundreds of vetted short-form creators pick up your campaign and post native content on their own accounts.',
  },
  {
    icon: Eye,
    title: 'Pay for views, not promises',
    body: 'Campaigns are scored on real view-through. Your budget maps directly to watched minutes, not follower counts.',
  },
  {
    icon: Zap,
    title: 'Launch in days',
    body: 'Tell us the product, the budget, and the vibe. We brief creators and content starts shipping within days.',
  },
];

export function BrandsPageClient() {
  const [turnstileToken, setTurnstileToken] = React.useState<string | null>(null);
  const [platforms, setPlatforms] = React.useState<string[]>(['tiktok', 'instagram']);
  const [sent, setSent] = React.useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      brandName: '', contactName: '', email: '', website: '',
      campaignName: '', description: '',
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: FormData) => {
      const res = await fetch('/api/public/brand-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, platforms, turnstileToken }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to submit');
      return json;
    },
    onSuccess: () => {
      setSent(true);
      form.reset();
    },
    onError: (err: unknown) => toast.error((err as Error)?.message || 'Could not submit'),
  });

  const togglePlatform = (p: string) =>
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  const submit = (v: FormData) => {
    if (platforms.length === 0) {
      toast.error('Pick at least one platform.');
      return;
    }
    mutation.mutate(v);
  };

  return (
    <div className="theme-light flex flex-col min-h-screen bg-background text-foreground">
      <MarketingNav />

      <main className="flex-1">
        {/* Hero */}
        <section className="py-16 sm:py-24 bg-hero-glow">
          <div className="container max-w-4xl px-4 text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-accent text-primary text-xs font-bold uppercase tracking-wide px-3.5 py-1.5 mb-6">
              <Megaphone className="h-3.5 w-3.5" /> For Brands
            </span>
            <h1 className="text-display text-4xl sm:text-5xl md:text-6xl">
              Your product.
              <br />
              Millions of views.
            </h1>
            <p className="mt-6 text-base sm:text-lg text-muted-foreground font-medium max-w-2xl mx-auto leading-relaxed">
              Launch a campaign on our creator network. Set your budget, tell us about the
              product, and short-form creators start posting for you.
            </p>
          </div>
        </section>

        {/* Value props */}
        <section className="py-14">
          <div className="container max-w-5xl px-4 grid grid-cols-1 md:grid-cols-3 gap-5">
            {VALUE_PROPS.map((v) => (
              <Card key={v.title} className="rounded-3xl p-7">
                <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-accent text-primary mb-4">
                  <v.icon className="h-5 w-5" />
                </div>
                <div className="text-lg font-extrabold tracking-tight mb-2">{v.title}</div>
                <p className="text-sm text-muted-foreground font-medium leading-relaxed">{v.body}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Request form */}
        <section className="py-16" id="launch">
          <div className="container max-w-2xl px-4">
            <div className="mb-10 text-center">
              <h2 className="text-display text-3xl sm:text-[2.6rem]">
                Tell us what you&apos;re promoting
              </h2>
              <p className="mt-3 text-muted-foreground font-medium">
                Submit the form and our team gets back to you within one business day.
              </p>
            </div>

            {sent ? (
              <Card className="p-8 text-center border-green-500/40 bg-green-500/5">
                <div className="inline-flex w-12 h-12 rounded-full bg-green-500/15 items-center justify-center mb-4">
                  <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <h2 className="text-lg font-semibold mb-1">Request received</h2>
                <p className="text-sm text-muted-foreground mb-5">
                  Thanks! Our partnerships team will review your campaign and reach out at the
                  email you provided.
                </p>
                <Button variant="outline" onClick={() => setSent(false)}>
                  Submit another campaign
                </Button>
              </Card>
            ) : (
              <Card className="p-6 sm:p-8">
                <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Brand name" error={form.formState.errors.brandName?.message}>
                      <Input placeholder="Acme Inc." disabled={mutation.isPending} {...form.register('brandName')} />
                    </Field>
                    <Field label="Your name" error={form.formState.errors.contactName?.message}>
                      <Input placeholder="Jane Doe" disabled={mutation.isPending} {...form.register('contactName')} />
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Work email" error={form.formState.errors.email?.message}>
                      <Input type="email" placeholder="you@brand.com" disabled={mutation.isPending} {...form.register('email')} />
                    </Field>
                    <Field label="Website (optional)" error={form.formState.errors.website?.message}>
                      <Input placeholder="https://brand.com" disabled={mutation.isPending} {...form.register('website')} />
                    </Field>
                  </div>

                  <Field label="Campaign name" error={form.formState.errors.campaignName?.message}>
                    <Input placeholder="e.g. Summer app launch" disabled={mutation.isPending} {...form.register('campaignName')} />
                  </Field>

                  <Field label="Monthly budget" error={form.formState.errors.budget?.message}>
                    <Select
                      value={form.watch('budget') ?? ''}
                      onValueChange={(v) => form.setValue('budget', v as FormData['budget'], { shouldValidate: true })}
                      disabled={mutation.isPending}
                    >
                      <SelectTrigger><SelectValue placeholder="Pick a range" /></SelectTrigger>
                      <SelectContent>
                        {BUDGETS.map((b) => (
                          <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Platforms</Label>
                    <div className="flex gap-2 flex-wrap">
                      {PLATFORM_OPTIONS.map((p) => {
                        const activePlatform = platforms.includes(p);
                        return (
                          <button
                            key={p}
                            type="button"
                            onClick={() => togglePlatform(p)}
                            disabled={mutation.isPending}
                            className={
                              'inline-flex items-center gap-1.5 rounded-full border px-3 h-9 text-sm font-medium capitalize transition-colors ' +
                              (activePlatform
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground')
                            }
                            aria-pressed={activePlatform}
                          >
                            <PlatformIcon platform={p === 'other' ? 'x' : p} className="h-3.5 w-3.5" />
                            {p}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <Field label="Tell us about the product (optional)" error={form.formState.errors.description?.message}>
                    <textarea
                      className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                      placeholder="What are you promoting? Who's the audience? Any goals or references?"
                      disabled={mutation.isPending}
                      maxLength={3000}
                      {...form.register('description')}
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
                    Submit campaign request
                  </Button>
                </form>
              </Card>
            )}
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}

function Field({
  label, children, error,
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
