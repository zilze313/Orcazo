import type { MetadataRoute } from 'next';
import { SITE } from '@/config/site';
import { ARTICLES } from './blog/articles';

// Public, indexable marketing routes only.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: Array<{ path: string; priority: number; changeFrequency: 'weekly' | 'monthly' }> = [
    { path: '', priority: 1, changeFrequency: 'weekly' },
    { path: '/brands', priority: 0.9, changeFrequency: 'monthly' },
    { path: '/blog', priority: 0.7, changeFrequency: 'weekly' },
    { path: '/contact', priority: 0.6, changeFrequency: 'monthly' },
    { path: '/privacy', priority: 0.3, changeFrequency: 'monthly' },
    { path: '/terms', priority: 0.3, changeFrequency: 'monthly' },
  ];

  return [
    ...entries.map(({ path, priority, changeFrequency }) => ({
      url: `${SITE.url}${path}`,
      lastModified: now,
      changeFrequency,
      priority,
    })),
    ...ARTICLES.map((a) => ({
      url: `${SITE.url}/blog/${a.slug}`,
      lastModified: new Date(a.publishedAt),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ];
}
