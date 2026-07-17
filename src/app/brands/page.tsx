import type { Metadata } from 'next';
import { SITE } from '@/config/site';
import { BrandsPageClient } from './_client';

export const metadata: Metadata = {
  title: 'For Brands — Launch a creator campaign',
  description:
    `Launch a UGC campaign with ${SITE.name} creators. Set your budget, tell us about your product, and our creator network posts short-form content that drives real views.`,
  alternates: { canonical: '/brands' },
  openGraph: {
    title: `For Brands — Launch a creator campaign | ${SITE.name}`,
    description:
      'Put your product in front of millions with short-form creator content. Set a budget, submit your campaign, and we handle the rest.',
  },
};

// Service structured data so the brands page can surface in rich results.
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: `${SITE.name} Creator Campaigns`,
  serviceType: 'Influencer and UGC marketing campaigns',
  provider: { '@type': 'Organization', name: SITE.name, url: SITE.url },
  areaServed: 'Worldwide',
  url: `${SITE.url}/brands`,
  description:
    'Short-form creator marketing campaigns across TikTok, Instagram, YouTube and Snapchat, paid on real views.',
};

export default function BrandsPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <BrandsPageClient />
    </>
  );
}
