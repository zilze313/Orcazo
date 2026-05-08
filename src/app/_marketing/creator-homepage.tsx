'use client';

import * as React from 'react';
import { ArrowRight, DollarSign, Clock, Trophy, Sparkles, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MarketingNav } from '@/components/marketing/marketing-nav';
import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { CreatorSignupDialog } from '@/components/marketing/creator-signup-dialog';
import { LoginDialog } from '@/components/marketing/login-dialog';
import { FadeIn } from '@/components/fade-in';
import { MARKETING } from '@/config/marketing';
import { PlatformIcon } from '@/components/platform-icon';

const PLATFORMS = ['tiktok', 'instagram', 'youtube', 'snapchat', 'x', 'facebook'] as const;

export function CreatorHomepage() {
  const [signupOpen, setSignupOpen] = React.useState(false);
  const [loginOpen, setLoginOpen] = React.useState(false);

  return (
    <div className="flex flex-col min-h-screen">
      <MarketingNav
        variant="creator"
        onPrimaryCta={() => setSignupOpen(true)}
        onLoginCta={() => setLoginOpen(true)}
      />

      {/* Hero */}
      <section className="relative overflow-hidden border-b">
        {/* ── 3-D perspective grid ────────────────────────────────── */}
        <div className="absolute inset-x-0 bottom-0 h-56 overflow-hidden pointer-events-none -z-10">
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `
                linear-gradient(to right, hsl(199 80% 50% / 0.13) 1px, transparent 1px),
                linear-gradient(to bottom, hsl(199 80% 50% / 0.13) 1px, transparent 1px)
              `,
              backgroundSize: '52px 52px',
              transform: 'perspective(320px) rotateX(68deg)',
              transformOrigin: 'center bottom',
              maskImage: 'linear-gradient(to top, black 0%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to top, black 0%, transparent 100%)',
            }}
          />
        </div>

        {/* ── Dot texture ─────────────────────────────────────────── */}
        <div
          className="absolute inset-0 -z-10 opacity-[0.035] pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        <div className="container max-w-6xl px-4 pt-20 pb-28 sm:pt-28 sm:pb-36 text-center relative">
          {/* ── Floating metric cards (2xl only) ───────────────────── */}
          <HeroCard
            value={MARKETING.stats[1].value}
            label="Active creators"
            rotation="-7deg"
            delay="0s"
            className="absolute left-0 top-[38%] -translate-y-1/2 hidden 2xl:block"
          />
          <HeroCard
            value={MARKETING.stats[3].value}
            label="Paid to creators"
            rotation="7deg"
            delay="1.6s"
            className="absolute right-0 top-[35%] -translate-y-1/2 hidden 2xl:block"
          />
          <HeroCard
            value={MARKETING.stats[2].value}
            label="Views this year"
            rotation="4deg"
            delay="0.8s"
            className="absolute right-0 top-[62%] -translate-y-1/2 hidden 2xl:block"
          />

          <FadeIn>
            <span className="inline-flex items-center gap-2 rounded-full border bg-background/60 backdrop-blur px-3 py-1 text-xs text-muted-foreground mb-6">
              <Users className="h-3 w-3" />
              <strong className="font-semibold text-foreground">{MARKETING.stats[1].value}</strong> active creators
            </span>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight leading-[1.05] max-w-4xl mx-auto">
              {MARKETING.creatorHero.heading}
            </h1>
            <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              {MARKETING.creatorHero.sub}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Button size="lg" onClick={() => setSignupOpen(true)}>
                Sign up <ArrowRight className="h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => setLoginOpen(true)}>
                Log in
              </Button>
            </div>
            <div className="mt-10 flex items-center justify-center gap-2 text-muted-foreground text-sm">
              <span>Earn on</span>
              <div className="flex items-center gap-2">
                {PLATFORMS.map((p) => (
                  <PlatformIcon key={p} platform={p} className="h-4 w-4" />
                ))}
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Quick stats */}
      <section className="border-b py-12 bg-muted/20">
        <div className="container max-w-5xl px-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {MARKETING.stats.map((s, i) => (
              <FadeIn key={s.label} delay={i * 80}>
                <div className="text-center">
                  <div className="text-2xl sm:text-3xl font-semibold tabular-nums">{s.value}</div>
                  <div className="text-xs sm:text-sm text-muted-foreground mt-1">{s.label}</div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-b py-20">
        <div className="container max-w-5xl px-4">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">Three steps. That&apos;s it.</h2>
            <p className="mt-3 text-muted-foreground">
              No follower minimums, no exclusivity contracts, no waiting weeks for payment.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {MARKETING.howItWorksCreator.map((step, i) => (
              <FadeIn key={step.title} delay={i * 100}>
                <Card className="p-6 h-full">
                  <div className="flex items-center justify-center w-10 h-10 rounded-md bg-primary text-primary-foreground font-semibold mb-3">
                    {i + 1}
                  </div>
                  <div className="font-semibold mb-2">{step.title}</div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.body}</p>
                </Card>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Why creators love it */}
      <section className="border-b py-20 bg-muted/20">
        <div className="container max-w-6xl px-4">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">Why creators choose Orcazo</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: DollarSign, title: "Real, predictable money", body: "Most platforms pay pennies per thousand views. Our active creators average $2,000–$8,000 monthly." },
              { icon: Clock, title: "Get paid weekly", body: "No 30-day net terms. You earn it, we send it — bank or crypto, whichever you prefer." },
              { icon: Trophy, title: "No follower count required", body: "We score by engagement and view-through, not vanity metrics. Even mid-sized accounts thrive here." },
            ].map((p, i) => (
              <FadeIn key={p.title} delay={i * 100}>
                <PerkCard icon={p.icon} title={p.title} body={p.body} />
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="border-b py-20">
        <div className="container max-w-6xl px-4">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">From our top creators</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {MARKETING.creatorTestimonials.map((t, i) => (
              <FadeIn key={t.handle} delay={i * 100}>
              <Card className="p-6 flex flex-col h-full">
                <p className="text-sm leading-relaxed flex-1">{t.quote}</p>
                <div className="mt-5 pt-4 border-t">
                  <div className="text-sm font-medium">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.handle}</div>
                  <div className="text-xs text-green-600 dark:text-green-400 font-medium mt-2">{t.stat}</div>
                </div>
              </Card>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container max-w-4xl px-4 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/10 px-3 py-1 text-xs mb-4">
            <Sparkles className="h-3 w-3" />
            Most creators get a decision within 24 hours
          </span>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">{MARKETING.creatorCta.heading}</h2>
          <p className="mt-3 text-primary-foreground/80 max-w-xl mx-auto">{MARKETING.creatorCta.sub}</p>
          <Button size="lg" variant="secondary" className="mt-7" onClick={() => setSignupOpen(true)}>
            Apply now <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </section>

      <MarketingFooter />

      <CreatorSignupDialog open={signupOpen} onOpenChange={setSignupOpen} />
      <LoginDialog
        open={loginOpen}
        onOpenChange={setLoginOpen}
        onSwitchToSignup={() => { setLoginOpen(false); setSignupOpen(true); }}
      />
    </div>
  );
}

function PerkCard({
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

function HeroCard({
  value, label, rotation, delay, className,
}: {
  value: string;
  label: string;
  rotation: string;
  delay: string;
  className?: string;
}) {
  return (
    <div
      className={`pointer-events-none w-44 rounded-2xl border border-border/70 bg-background/70 px-5 py-4 shadow-2xl backdrop-blur-md ${className ?? ''}`}
      style={{
        ['--card-rot' as string]: rotation,
        transform: `rotate(${rotation})`,
        animation: `float-card 5s ease-in-out infinite`,
        animationDelay: delay,
      }}
    >
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
