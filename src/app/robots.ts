import type { MetadataRoute } from 'next';
import { SITE } from '@/config/site';

// Public marketing pages are crawlable; the signed-in app, admin, API and the
// auth screens are kept out of the index.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/api',
          '/auth',
          '/login',
          '/campaigns',
          '/dashboard',
          '/guide',
          '/my-campaigns',
          '/payouts',
          '/referrals',
          '/reposting',
          '/social-accounts',
          '/support',
          '/updates',
        ],
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
