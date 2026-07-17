import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarketingNav } from '@/components/marketing/marketing-nav';
import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { SITE } from '@/config/site';
import { ARTICLES, getArticle } from '../articles';

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return {};
  return {
    title: article.title,
    description: article.description,
    alternates: { canonical: `/blog/${article.slug}` },
    openGraph: {
      type: 'article',
      title: article.title,
      description: article.description,
      publishedTime: article.publishedAt,
    },
  };
}

function formatDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

export default async function BlogArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    datePublished: article.publishedAt,
    author: { '@type': 'Organization', name: SITE.name, url: SITE.url },
    publisher: { '@type': 'Organization', name: SITE.name, logo: { '@type': 'ImageObject', url: `${SITE.url}/icon-512.png` } },
    mainEntityOfPage: `${SITE.url}/blog/${article.slug}`,
  };

  return (
    <div className="theme-light flex flex-col min-h-screen bg-background text-foreground">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <MarketingNav />

      <main className="flex-1">
        <article>
          <header className="border-b py-14 sm:py-18">
            <div className="container max-w-3xl px-4">
              <Link href="/blog" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-6">
                <ArrowLeft className="h-3 w-3" /> All articles
              </Link>
              <h1 className="text-display text-3xl sm:text-5xl">
                {article.title}
              </h1>
              <p className="mt-4 text-sm font-semibold text-muted-foreground">
                {formatDate(article.publishedAt)} · {article.readMinutes} min read · {SITE.name}
              </p>
            </div>
          </header>

          <div className="container max-w-3xl px-4 py-12 sm:py-16">
            {article.sections.map((s, i) => (
              <section key={i} className={i > 0 ? 'mt-10' : ''}>
                {s.heading && (
                  <h2 className="text-2xl font-extrabold tracking-tight mb-4">{s.heading}</h2>
                )}
                {s.paragraphs.map((p, j) => (
                  <p key={j} className="text-base leading-relaxed text-foreground/80 mb-4">{p}</p>
                ))}
              </section>
            ))}
          </div>
        </article>

        <section className="bg-primary text-primary-foreground py-16">
          <div className="container max-w-3xl px-4 text-center">
            <h2 className="text-display text-3xl">Ready to earn from your content?</h2>
            <p className="mt-3 text-primary-foreground/85 font-medium">No follower minimum. Most applicants hear back within 24 hours.</p>
            <Button size="lg" variant="dark" className="mt-6" asChild>
              <Link href="/auth?tab=signup">
                Apply as a creator <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
