import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { MarketingNav } from '@/components/marketing/marketing-nav';
import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { ARTICLES } from './articles';

export const metadata: Metadata = {
  title: 'Creator earnings blog',
  description:
    'Honest guides on earning from short-form content: affiliate content marketing, faceless accounts, payout methods, and growing creator income.',
  alternates: { canonical: '/blog' },
};

function formatDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

export default function BlogIndexPage() {
  return (
    <div className="theme-light flex flex-col min-h-screen bg-background text-foreground">
      <MarketingNav />

      <main className="flex-1">
        <section className="py-16 sm:py-20 bg-hero-glow">
          <div className="container max-w-3xl px-4 text-center">
            <span className="inline-block rounded-full bg-accent text-primary text-xs font-bold uppercase tracking-wide px-3.5 py-1.5 mb-5">
              Blog
            </span>
            <h1 className="text-display text-4xl sm:text-5xl">
              The creator earnings blog
            </h1>
            <p className="mt-5 text-muted-foreground font-medium max-w-xl mx-auto leading-relaxed">
              No fluff. Real numbers on what short-form content pays and how to get your share.
            </p>
          </div>
        </section>

        <section className="container max-w-3xl px-4 py-12 sm:py-16 space-y-5">
          {ARTICLES.map((a) => (
            <Link key={a.slug} href={`/blog/${a.slug}`} className="group block">
              <Card className="rounded-3xl p-7 hover:border-primary/40 transition-colors">
                <div className="text-xs font-semibold text-muted-foreground">
                  {formatDate(a.publishedAt)} · {a.readMinutes} min read
                </div>
                <h2 className="mt-2.5 text-xl sm:text-2xl font-extrabold tracking-tight leading-tight">
                  {a.title}
                </h2>
                <p className="mt-2.5 text-sm text-muted-foreground font-medium leading-relaxed">{a.description}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-primary group-hover:gap-2 transition-all">
                  Read article <ArrowRight className="h-4 w-4" />
                </span>
              </Card>
            </Link>
          ))}
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
