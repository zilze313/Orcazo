import { redirect } from 'next/navigation';
import { getEmployeeSession } from '@/lib/session';
import { CreatorHomepage } from './_marketing/creator-homepage';
import { SITE } from '@/config/site';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Organization + WebSite structured data for rich results.
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE.url}/#organization`,
      name: SITE.name,
      url: SITE.url,
      logo: `${SITE.url}/icon-512.png`,
      description: SITE.description,
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE.url}/#website`,
      url: SITE.url,
      name: SITE.name,
      description: SITE.description,
      publisher: { '@id': `${SITE.url}/#organization` },
    },
  ],
};

export default async function Home() {
  const session = await getEmployeeSession();
  if (session) redirect('/campaigns');

  // Server-render the payout wall so it's indexable and paints immediately.
  const payoutCardsRaw = await db.showcasePayout
    .findMany({
      where: { active: true },
      orderBy: [{ ordering: 'asc' }, { createdAt: 'desc' }],
      take: 24,
      select: {
        id: true, displayName: true, handle: true, platform: true,
        amount: true, note: true, paidLabel: true,
      },
    })
    .catch(() => []);

  // Decimal → number so the payload is serializable for the client component.
  const payoutCards = payoutCardsRaw.map((c) => ({
    ...c,
    amount: parseFloat(String(c.amount)) || 0,
  }));

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <CreatorHomepage payoutCards={payoutCards} />
    </>
  );
}
