"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  ChevronDown,
  Eye,
  Landmark,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import {
  PayoutWall,
  type PayoutWallCard,
} from "@/components/marketing/payout-wall";
import { FadeIn } from "@/components/fade-in";
import { MARKETING } from "@/config/marketing";
import { PlatformIcon } from "@/components/platform-icon";

const PLATFORMS = [
  "tiktok",
  "instagram",
  "youtube",
  "snapchat",
  "x",
  "facebook",
] as const;

export function CreatorHomepage({
  payoutCards = [],
}: {
  payoutCards?: PayoutWallCard[];
}) {
  return (
    <div className="theme-light flex flex-col min-h-screen bg-background text-foreground">
      <MarketingNav />

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-hero-glow">
        {/* Ambient drifting aurora */}
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          aria-hidden
        >
          <span className="hero-blob hero-blob-1" />
          <span className="hero-blob hero-blob-2" />
          <span className="hero-blob hero-blob-3" />
        </div>

        <div className="relative z-10 container max-w-7xl px-4 pt-14 pb-20 sm:pt-20 sm:pb-28 grid lg:grid-cols-[1.15fr_1fr] gap-14 items-center">
          <div>
            <HeroHeadline />
            <p
              className="animate-fade-up mt-6 text-base sm:text-lg text-muted-foreground font-medium max-w-md leading-relaxed"
              style={{ animationDelay: "0.55s" }}
            >
              {MARKETING.creatorHero.sub}
            </p>
            <div
              className="animate-fade-up mt-9 flex flex-col sm:flex-row gap-3"
              style={{ animationDelay: "0.68s" }}
            >
              <Button size="xl" asChild>
                <Link href="/auth?tab=signup">Start Earning Today</Link>
              </Button>
              <Button
                size="xl"
                variant="outline"
                className="border-transparent shadow-sm"
                asChild
              >
                <Link href="#how-it-works">How It Works</Link>
              </Button>
            </div>
            <div
              className="animate-fade-up mt-10 flex items-center gap-2.5 text-muted-foreground text-sm font-medium"
              style={{ animationDelay: "0.8s" }}
            >
              <span>Earn on</span>
              <div className="flex items-center gap-2.5">
                {PLATFORMS.map((p) => (
                  <PlatformIcon
                    key={p}
                    platform={p}
                    className="h-[18px] w-[18px]"
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Desktop floating app-card stack */}
          <div
            className="animate-fade-up relative h-[440px] hidden lg:block"
            style={{ animationDelay: "0.4s" }}
            aria-hidden
          >
            <FloatCard
              rotation="-8deg"
              delay="0s"
              className="absolute left-0 top-14 w-60 z-10"
            >
              <NewCreatorsBody />
            </FloatCard>
            <FloatCard
              rotation="3deg"
              delay="0.9s"
              className="absolute right-24 top-0 w-64 z-20"
            >
              <CampaignsBody />
            </FloatCard>
            <FloatCard
              rotation="8deg"
              delay="1.8s"
              className="absolute right-0 bottom-14 w-60 z-30"
            >
              <PayoutBody />
            </FloatCard>
          </div>
        </div>

        {/* Mobile app-card cluster — fanned composition */}
        <div className="lg:hidden container max-w-7xl px-4 -mt-4 pb-6" aria-hidden>
          <div
            className="animate-fade-up relative mx-auto h-[340px] w-full max-w-[360px]"
            style={{ animationDelay: "0.5s" }}
          >
            <FloatCard
              rotation="-7deg"
              delay="0s"
              className="absolute left-0 top-0 w-[13.5rem] z-10"
            >
              <CampaignsBody />
            </FloatCard>
            <FloatCard
              rotation="7deg"
              delay="1s"
              className="absolute right-0 top-16 w-[12.5rem] z-20"
            >
              <NewCreatorsBody />
            </FloatCard>
            <FloatCard
              rotation="-2deg"
              delay="2s"
              className="absolute left-6 bottom-0 w-[14rem] z-30"
            >
              <PayoutBody />
            </FloatCard>
          </div>
        </div>
      </section>

      <TrustRibbon />

      {/* ── How it works ─────────────────────────────────────────── */}
      <section id="how-it-works" className="py-24">
        <div className="container max-w-6xl px-4">
          <SectionHeader
            eyebrow="How it Works"
            title={
              <>
                From posting to payout
                <br className="hidden sm:block" /> in 3 simple steps
              </>
            }
            sub="Pick a campaign, post your clip, watch the views turn into money. Every step is transparent."
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                step: "Step 1",
                title: "Apply in 60 seconds",
                body: MARKETING.howItWorksCreator[0].body,
                mock: <MockApply />,
              },
              {
                step: "Step 2",
                title: "Pick a campaign",
                body: MARKETING.howItWorksCreator[1].body,
                mock: <MockCampaign />,
              },
              {
                step: "Step 3",
                title: "Get paid every week",
                body: MARKETING.howItWorksCreator[2].body,
                mock: <MockPayout />,
              },
            ].map((s, i) => (
              <FadeIn key={s.title} delay={i * 100}>
                <div className="h-full rounded-3xl bg-card border border-black/[0.06] shadow-sm p-6 flex flex-col">
                  <div className="rounded-2xl bg-gradient-to-b from-accent/80 to-muted/40 p-5 mb-6 min-h-[170px] grid place-items-center">
                    {s.mock}
                  </div>
                  <div className="text-xs font-bold text-primary uppercase tracking-wide">
                    {s.step}
                  </div>
                  <div className="mt-1.5 text-xl font-extrabold tracking-tight">
                    {s.title}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground font-medium leading-relaxed">
                    {s.body}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
          <div className="mt-12 text-center">
            <Button size="xl" asChild>
              <Link href="/auth?tab=signup">Start Earning Today</Link>
            </Button>
          </div>
        </div>
      </section>

      <TrustRibbon />

      {/* ── Trust / protection bento ─────────────────────────────── */}
      <section className="py-24">
        <div className="container max-w-6xl px-4">
          <SectionHeader
            eyebrow="Built for Trust"
            title="A platform that protects creators"
            sub="Clear rules, tracked earnings, and payouts that arrive when we say they will."
          />
          <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
            <BentoCard
              className="md:col-span-3"
              icon={ShieldCheck}
              title="Payout protection"
              body="Campaign budgets are committed up front. When your views are approved, the money is already there — you never chase a brand for payment."
            >
              <div className="mt-6 rounded-2xl bg-muted/60 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
                    <ShieldCheck className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="text-sm font-bold">Protection shield</div>
                    <div className="text-xs text-muted-foreground font-medium">
                      Active on all campaigns
                    </div>
                  </div>
                </div>
                <span className="rounded-full bg-green-500/10 text-green-600 text-[11px] font-bold px-3 py-1">
                  ACTIVE
                </span>
              </div>
            </BentoCard>
            <BentoCard
              className="md:col-span-2"
              icon={Eye}
              title="Transparent tracking"
              body="See exactly what every video earned, view by view, in real time."
            >
              <div className="mt-6 space-y-2">
                {[
                  ["Gym transformation clip", "+$86.40"],
                  ["Podcast highlight #12", "+$41.25"],
                ].map(([t, v]) => (
                  <div
                    key={t}
                    className="rounded-xl bg-muted/60 px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold"
                  >
                    <span className="truncate">{t}</span>
                    <span className="text-green-600 shrink-0 ml-3">{v}</span>
                  </div>
                ))}
              </div>
            </BentoCard>
            <BentoCard
              className="md:col-span-2"
              icon={Users}
              title="No follower minimums"
              body="We pay for performance, not follower counts. New accounts welcome."
            >
              <div className="mt-6 flex items-center gap-3">
                <div className="flex -space-x-2">
                  {[0, 1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className="grid h-9 w-9 place-items-center rounded-full text-[10px] font-bold text-white ring-2 ring-card"
                      style={{
                        background: `hsl(${20 + i * 12} 90% ${50 + i * 4}%)`,
                      }}
                    >
                      {["+", "✦", "+", "✦"][i]}
                    </span>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground font-semibold">
                  {MARKETING.stats[0].value} creators on the network
                </div>
              </div>
            </BentoCard>
            <BentoCard
              className="md:col-span-3"
              icon={Landmark}
              title="Weekly payouts, your way"
              body="Withdraw to your bank account or crypto wallet every single week. No 30-day net terms, no invoices, no waiting."
            >
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-muted/60 p-4">
                  <Banknote className="h-5 w-5 text-primary mb-2" />
                  <div className="text-sm font-bold">Bank transfer</div>
                  <div className="text-xs text-muted-foreground font-medium">
                    Worldwide
                  </div>
                </div>
                <div className="rounded-2xl bg-muted/60 p-4">
                  <Wallet className="h-5 w-5 text-primary mb-2" />
                  <div className="text-sm font-bold">Crypto</div>
                  <div className="text-xs text-muted-foreground font-medium">
                    USDC &amp; more
                  </div>
                </div>
              </div>
            </BentoCard>
          </div>
        </div>
      </section>

      {/* ── Campaign showcase ────────────────────────────────────── */}
      <section className="py-24 bg-card border-y border-black/[0.04]">
        <div className="container max-w-6xl px-4">
          <SectionHeader
            eyebrow="Live Campaigns"
            title="Campaigns creators are earning from"
            sub="A sample of the briefs running on Orcazo — budgets, rates and results included."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {MARKETING.showcaseCampaigns.map((c, i) => (
              <FadeIn key={c.title} delay={i * 70}>
                <CampaignCard c={c} />
              </FadeIn>
            ))}
          </div>
          <div className="mt-12 text-center">
            <Button size="xl" variant="dark" asChild>
              <Link href="/auth?tab=signup">
                See All Campaigns <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Payout wall (real payouts marquee) ───────────────────── */}
      <PayoutWall cards={payoutCards} />

      {/* ── Success stories ──────────────────────────────────────── */}
      <section className="py-24">
        <div className="container max-w-6xl px-4">
          <SectionHeader
            eyebrow="Success Stories"
            title="Creators are already winning"
            sub="Real people, real accounts, real weekly payouts."
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {MARKETING.creatorTestimonials.map((t, i) => (
              <FadeIn key={t.handle} delay={i * 100}>
                <div className="h-full rounded-3xl bg-card border border-black/[0.06] shadow-sm p-7 flex flex-col">
                  <div className="flex items-center gap-3 mb-5">
                    <span className="grid h-11 w-11 place-items-center rounded-full bg-primary text-white font-extrabold">
                      {t.name[0]}
                    </span>
                    <div>
                      <div className="font-bold text-sm">{t.name}</div>
                      <div className="text-xs text-muted-foreground font-medium">
                        {t.handle}
                      </div>
                    </div>
                  </div>
                  <p className="text-[15px] font-semibold leading-relaxed tracking-tight flex-1">
                    {t.quote}
                  </p>
                  <div className="mt-6 pt-5 border-t">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                      Revenue generated
                    </div>
                    <div className="mt-1 text-sm font-extrabold text-primary">
                      {t.stat}
                    </div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <TrustRibbon />

      {/* ── FAQ ──────────────────────────────────────────────────── */}
      <section className="py-24">
        <div className="container max-w-3xl px-4">
          <SectionHeader
            eyebrow="FAQs"
            title="Questions, answered"
            sub="Everything you need to know about earning on Orcazo."
          />
          <div className="space-y-3">
            {MARKETING.faqs.map((f) => (
              <FaqItem key={f.q} q={f.q} a={f.a} />
            ))}
          </div>
          <div className="mt-12 rounded-3xl bg-card border border-black/[0.06] shadow-sm p-8 sm:p-10 text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3.5 py-1.5 text-xs font-bold text-primary mb-4">
              <Sparkles className="h-3.5 w-3.5" />
              Most creators get a decision within 24 hours
            </span>
            <h3 className="text-display text-2xl sm:text-3xl">
              {MARKETING.creatorCta.heading}
            </h3>
            <p className="mt-2 text-muted-foreground font-medium">
              {MARKETING.creatorCta.sub}
            </p>
            <Button size="xl" className="mt-7" asChild>
              <Link href="/auth?tab=signup">
                Become a Creator <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

/* ── Section pieces ─────────────────────────────────────────────── */

function SectionHeader({
  eyebrow,
  title,
  sub,
}: {
  eyebrow: string;
  title: React.ReactNode;
  sub: string;
}) {
  return (
    <div className="text-center max-w-2xl mx-auto mb-14">
      <span className="inline-block rounded-full bg-accent text-primary text-xs font-bold uppercase tracking-wide px-3.5 py-1.5 mb-4">
        {eyebrow}
      </span>
      <h2 className="text-display text-3xl sm:text-[2.6rem]">{title}</h2>
      <p className="mt-4 text-muted-foreground font-medium leading-relaxed">
        {sub}
      </p>
    </div>
  );
}

function TrustRibbon() {
  const chunk = (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <span
          key={i}
          className="mx-6 inline-flex items-center gap-3 text-sm font-bold uppercase tracking-wide whitespace-nowrap"
        >
          Trusted by {MARKETING.stats[0].value} creators{" "}
          <span className="text-base leading-none">✦</span>
        </span>
      ))}
    </>
  );
  return (
    <div
      className="relative overflow-hidden bg-primary text-white py-3"
      aria-hidden
    >
      <div
        className="flex animate-marquee-fast"
        style={{ width: "max-content" }}
      >
        <div className="flex">{chunk}</div>
        <div className="flex">{chunk}</div>
      </div>
    </div>
  );
}

function FloatCard({
  rotation,
  delay,
  className,
  children,
}: {
  rotation: string;
  delay: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-3xl border border-black/[0.06] bg-card p-5 shadow-[0_20px_50px_-20px_rgb(20_12_4/0.25)] ${className ?? ""}`}
      style={{
        ["--card-rot" as string]: rotation,
        transform: `rotate(${rotation})`,
        animation: "float-card 6s ease-in-out infinite",
        animationDelay: delay,
      }}
    >
      {children}
    </div>
  );
}

/* Headline that reveals word-by-word with a blur-rise, orange shimmer on "payout" */

function HeroHeadline() {
  const lines = [
    ["Turn", "every", "video"],
    ["into", "a", "payout"],
  ];
  let wordIndex = 0;
  return (
    <h1 className="text-display text-[2.6rem] sm:text-6xl lg:text-[4.2rem]">
      {lines.map((line, li) => (
        <span key={li} className="block">
          {line.map((word, wi) => {
            const delay = 0.1 + wordIndex++ * 0.075;
            return (
              <React.Fragment key={word + li}>
                <span
                  className="animate-word-rise inline-block"
                  style={{ animationDelay: `${delay}s` }}
                >
                  {word === "payout" ? (
                    <span className="hero-gradient-text">{word}</span>
                  ) : (
                    word
                  )}
                </span>
                {wi < line.length - 1 ? " " : null}
              </React.Fragment>
            );
          })}
        </span>
      ))}
    </h1>
  );
}

/* Hero app-card bodies — shared between the desktop stack and mobile cluster */

function NewCreatorsBody() {
  return (
    <>
      <div className="text-sm font-bold mb-3">New Creators</div>
      <div className="flex -space-x-2 mb-3">
        {["O", "R", "C", "A", "Z"].map((c, i) => (
          <span
            key={i}
            className="grid h-9 w-9 place-items-center rounded-full text-[11px] font-bold text-white ring-2 ring-white"
            style={{ background: `hsl(${18 + i * 9} 95% ${52 + i * 3}%)` }}
          >
            {c}
          </span>
        ))}
      </div>
      <div className="text-xs text-muted-foreground font-medium">
        {MARKETING.stats[1].value} creators earning this month
      </div>
    </>
  );
}

function CampaignsBody() {
  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-bold">Campaigns</div>
        <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-primary">
          LIVE
        </span>
      </div>
      <div className="rounded-xl bg-muted/70 p-3">
        <div className="text-xs font-semibold truncate">Fitness App Clipping</div>
        <div className="mt-2 h-1.5 rounded-full bg-border overflow-hidden">
          <div className="h-full w-[62%] rounded-full bg-primary" />
        </div>
        <div className="mt-2 flex justify-between text-[10px] font-semibold text-muted-foreground">
          <span>$15,600 / $25,000</span>
          <span className="text-primary">$1.80 / 1k</span>
        </div>
      </div>
    </>
  );
}

function PayoutBody() {
  return (
    <>
      <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        Available to pay out
      </div>
      <div className="mt-1 text-3xl font-extrabold tabular-nums tracking-tight">
        $2,140.00
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-green-600">
        <ShieldCheck className="h-3.5 w-3.5" /> Payout protection active
      </div>
      <div className="mt-3 rounded-full bg-foreground text-background text-center text-xs font-bold py-2.5">
        Withdraw
      </div>
    </>
  );
}

/* Mini UI mockups for the how-it-works cards */

function MockApply() {
  return (
    <div className="w-full max-w-[210px] rounded-2xl bg-card shadow-md p-4">
      <div className="flex items-center gap-2.5 mb-3">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-white text-xs font-bold">
          Y
        </span>
        <div>
          <div className="text-xs font-bold">You</div>
          <div className="text-[10px] text-muted-foreground font-medium">
            @yourhandle
          </div>
        </div>
        <BadgeCheck className="h-4 w-4 text-primary ml-auto" />
      </div>
      <div className="space-y-1.5">
        <div className="h-2 rounded-full bg-muted w-full" />
        <div className="h-2 rounded-full bg-muted w-3/4" />
      </div>
      <div className="mt-3 rounded-full bg-foreground text-background text-center text-[11px] font-bold py-2">
        Submit application
      </div>
    </div>
  );
}

function MockCampaign() {
  return (
    <div className="w-full max-w-[210px] rounded-2xl bg-card shadow-md p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="rounded-full bg-accent text-primary text-[9px] font-bold px-2 py-0.5 uppercase">
          Clipping
        </span>
        <span className="text-[10px] font-bold text-primary">$2.00 / 1k</span>
      </div>
      <div className="text-xs font-bold truncate">AI Study Tool Clips</div>
      <div className="mt-2.5 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full w-[71%] rounded-full bg-primary" />
      </div>
      <div className="mt-1.5 text-[10px] font-semibold text-muted-foreground">
        $21,360 of $30,000 paid out
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
        <TrendingUp className="h-3 w-3 text-green-600" /> 11.9M views generated
      </div>
    </div>
  );
}

function MockPayout() {
  return (
    <div className="w-full max-w-[210px] rounded-2xl bg-card shadow-md p-4">
      <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        Balance
      </div>
      <div className="mt-0.5 text-2xl font-extrabold tabular-nums tracking-tight">
        $1,862.50
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold text-green-600">
        <BadgeCheck className="h-3.5 w-3.5" /> Payout sent · every Friday
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-full bg-primary text-white text-center text-[11px] font-bold py-2">
          Bank
        </div>
        <div className="rounded-full bg-muted text-center text-[11px] font-bold py-2">
          Crypto
        </div>
      </div>
    </div>
  );
}

function BentoCard({
  icon: Icon,
  title,
  body,
  className,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-3xl bg-card border border-black/[0.06] shadow-sm p-7 flex flex-col ${className ?? ""}`}
    >
      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent text-primary mb-4">
        <Icon className="h-5 w-5" />
      </span>
      <div className="text-xl font-extrabold tracking-tight">{title}</div>
      <p className="mt-2 text-sm text-muted-foreground font-medium leading-relaxed">
        {body}
      </p>
      {children}
    </div>
  );
}

function CampaignCard({
  c,
}: {
  c: (typeof MARKETING.showcaseCampaigns)[number];
}) {
  const pct = Math.min(100, Math.round((c.paid / c.budget) * 100));
  const money = (n: number) => `$${n.toLocaleString("en-US")}`;
  return (
    <div className="h-full rounded-3xl bg-background border border-black/[0.06] shadow-sm p-6 flex flex-col">
      <div className="flex items-center gap-2 text-[11px] font-bold">
        <span className="rounded-full bg-accent text-primary px-2.5 py-1 uppercase tracking-wide">
          {c.category}
        </span>
        <span className="rounded-full bg-muted px-2.5 py-1 uppercase tracking-wide text-muted-foreground">
          {c.niche}
        </span>
        <span className="ml-auto font-semibold text-muted-foreground">
          {c.age}
        </span>
      </div>
      <div className="mt-4 text-lg font-extrabold tracking-tight leading-snug">
        {c.title}
      </div>
      <div className="mt-1 text-sm font-semibold text-muted-foreground">
        {c.brand}
      </div>
      <div className="mt-5">
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-xs font-bold">
          <span>
            {money(c.paid)}{" "}
            <span className="text-muted-foreground font-semibold">
              / {money(c.budget)}
            </span>
          </span>
          <span className="text-primary">{c.rate} / 1k views</span>
        </div>
      </div>
      <div className="mt-5 pt-4 border-t grid grid-cols-3 gap-2 text-center">
        {[
          ["Approval", c.approval],
          ["Views", c.views],
          ["Creators", String(c.creators)],
        ].map(([label, value]) => (
          <div key={label}>
            <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              {label}
            </div>
            <div className="mt-0.5 text-sm font-extrabold tabular-nums">
              {value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="rounded-2xl bg-card border border-black/[0.06] shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left font-bold tracking-tight"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {q}
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <p className="px-6 pb-5 text-sm text-muted-foreground font-medium leading-relaxed">
          {a}
        </p>
      )}
    </div>
  );
}
