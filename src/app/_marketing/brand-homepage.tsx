'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowRight, BarChart3, Globe, Sparkles, ShieldCheck, Zap, TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MarketingNav } from '@/components/marketing/marketing-nav';
import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { BrandSignupDialog } from '@/components/marketing/brand-signup-dialog';
import { MARKETING } from '@/config/marketing';
import { PlatformIcon } from '@/components/platform-icon';

const PLATFORMS = ['tiktok', 'instagram', 'youtube', 'snapchat', 'x', 'facebook'] as const;

export function BrandHomepage() {
  const [brandOpen, setBrandOpen] = React.useState(false);

  return (
    <div className="flex flex-col min-h-screen">
      <MarketingNav variant="brand" onPrimaryCta={() => setBrandOpen(true)} />

      {/* Hero */}
      <section className="relative overflow-hidden border-b">
        <div
          className="absolute inset-0 -z-10 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, currentColor 1px, transparent 1px), radial-gradient(circle at 80% 60%, currentColor 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
        <div className="container max-w-6xl px-4 pt-20 pb-24 sm:pt-28 sm:pb-32 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border bg-background/60 backdrop-blur px-3 py-1 text-xs text-muted-foreground mb-6">
            <Sparkles className="h-3 w-3" />
            {MARKETING.brandHero.eyebrow}
          </span>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight leading-[1.05] max-w-4xl mx-auto">
            {MARKETING.brandHero.heading}
          </h1>
          <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {MARKETING.brandHero.sub}
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" onClick={() => setBrandOpen(true)}>
              Sign up as a brand
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/creators">Sign up as a creator</Link>
            </Button>
          </div>
          <div className="mt-10 flex items-center justify-center gap-2 text-muted-foreground text-sm">
            <span>Available on</span>
            <div className="flex items-center gap-2">
              {PLATFORMS.map((p) => (
                <PlatformIcon key={p} platform={p} className="h-4 w-4" />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Trusted-by ticker */}
      <section className="border-b py-8 overflow-hidden">
        <div className="container max-w-7xl px-4">
          <p className="text-center text-xs uppercase tracking-widest text-muted-foreground mb-5">
            Trusted by leading brands
          </p>
          <div className="relative overflow-hidden">
            <div className="flex gap-12 animate-marquee whitespace-nowrap">
              {[...MARKETING.trustedBy, ...MARKETING.trustedBy].map((b, i) => (
                <span
                  key={i}
                  className="text-xl sm:text-2xl font-semibold text-muted-foreground/70 tracking-tight"
                >
                  {b}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b py-16 sm:py-20">
        <div className="container max-w-6xl px-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {MARKETING.stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-3xl sm:text-4xl font-semibold tabular-nums">{s.value}</div>
                <div className="text-sm text-muted-foreground mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-b py-20">
        <div className="container max-w-6xl px-4">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">How it works</h2>
            <p className="mt-3 text-muted-foreground">
              From kickoff to your first viral campaign in under a week.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {MARKETING.howItWorksBrand.map((step, i) => (
              <Card key={step.title} className="p-6">
                <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary text-primary-foreground font-semibold mb-3">
                  {i + 1}
                </div>
                <div className="font-semibold mb-2">{step.title}</div>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Why Orcazo */}
      <section className="border-b py-20 bg-muted/20">
        <div className="container max-w-6xl px-4">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">Why Orcazo</h2>
            <p className="mt-3 text-muted-foreground">
              We&apos;re not another influencer marketplace. We&apos;re a performance content platform.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Feature
              icon={ShieldCheck}
              title="Vetted creators only"
              body="Every creator passes a manual review. No fake followers, no engagement farms — just real audiences."
            />
            <Feature
              icon={BarChart3}
              title="Pay per view, not per post"
              body="You set the rate. Creators earn when their videos hit your view threshold. Costs scale with results."
            />
            <Feature
              icon={Zap}
              title="Live tracking, no surprises"
              body="Real-time dashboards for every campaign. View counts, demographics, ROI — all transparent."
            />
            <Feature
              icon={Globe}
              title="Multi-platform reach"
              body="Run a single brief across TikTok, Instagram Reels, YouTube Shorts, Snapchat, X, and Facebook."
            />
            <Feature
              icon={TrendingUp}
              title="Optimize as you go"
              body="See which creators and formats work best, then double down. We surface insights automatically."
            />
            <Feature
              icon={Sparkles}
              title="Hands-off scaling"
              body="Brief once, get hundreds of unique videos. Our team handles outreach, briefing, and review."
            />
          </div>
        </div>
      </section>

      {/* Testimonials / case studies */}
      <section className="border-b py-20">
        <div className="container max-w-6xl px-4">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">Real results from real brands</h2>
            <p className="mt-3 text-muted-foreground">
              How leading brands use Orcazo to scale their organic content.
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {MARKETING.brandTestimonials.map((t) => (
              <Card key={t.brand} className="p-6 flex flex-col">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{t.brand}</div>
                <p className="text-sm leading-relaxed flex-1">{t.quote}</p>
                <div className="mt-5 pt-4 border-t">
                  <div className="text-sm font-medium">{t.author}</div>
                  <div className="text-xs text-muted-foreground mt-1">{t.stat}</div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container max-w-4xl px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">{MARKETING.brandCta.heading}</h2>
          <p className="mt-3 text-primary-foreground/80 max-w-xl mx-auto">{MARKETING.brandCta.sub}</p>
          <Button size="lg" variant="secondary" className="mt-7" onClick={() => setBrandOpen(true)}>
            Sign up as a brand <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </section>

      <MarketingFooter />

      <BrandSignupDialog open={brandOpen} onOpenChange={setBrandOpen} />
    </div>
  );
}

function Feature({
  icon: Icon, title, body,
}: { icon: React.ComponentType<{ className?: string }>; title: string; body: string }) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary/10 text-primary mb-3">
        <Icon className="h-5 w-5" />
      </div>
      <div className="font-semibold mb-2">{title}</div>
      <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
    </Card>
  );
}
