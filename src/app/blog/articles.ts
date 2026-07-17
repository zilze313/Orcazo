// Static blog articles — plain data so the pages stay server-rendered and
// indexable. Add a new object here and it appears on /blog and the sitemap.

export interface Article {
  slug: string;
  title: string;
  description: string;
  /** ISO date shown on the article + used in JSON-LD */
  publishedAt: string;
  readMinutes: number;
  /** Section list: h2 heading + paragraphs (rendered as real <h2>/<p> for SEO) */
  sections: Array<{ heading?: string; paragraphs: string[] }>;
}

export const ARTICLES: Article[] = [
  {
    slug: 'what-is-affiliate-content-marketing',
    title: 'What is affiliate content marketing? A creator’s guide for 2026',
    description:
      'Affiliate content marketing pays creators for the performance of their posts, not their follower count. Here’s how the model works, what it pays, and how to get started.',
    publishedAt: '2026-05-18',
    readMinutes: 6,
    sections: [
      {
        paragraphs: [
          'Most creators still think brand money only flows to accounts with hundreds of thousands of followers. Affiliate content marketing flips that assumption: instead of paying for your audience, a brand pays for what your content actually does — the views it earns, the clicks it drives, the customers it brings in.',
          'That single change makes the model radically more open. A creator with eight thousand followers and strong hooks can out-earn an account ten times their size, because the money follows performance rather than reach.',
        ],
      },
      {
        heading: 'How the model actually works',
        paragraphs: [
          'A brand defines a campaign: the product, the message, the platforms, and a rate — usually per one thousand views, sometimes with a bonus per conversion. Creators pick campaigns that fit their content, post native short-form videos on their own accounts, and submit the links for tracking.',
          'Views are then measured over a set window, and earnings are calculated against the campaign’s rate, threshold, and cap. The threshold filters out posts that never took off; the cap keeps budgets predictable for the brand. Everything in between is yours.',
        ],
      },
      {
        heading: 'What it pays compared to platform funds',
        paragraphs: [
          'Native creator funds typically pay a few cents per thousand views. Affiliate campaigns routinely pay ten to fifty times more, because the brand is buying targeted attention for a product rather than reselling generic ad space.',
          'On Orcazo, active creators posting consistently across two or three accounts commonly land in the low-to-mid four figures per month. The spread is wide — hooks, niche, and consistency matter — but the ceiling is far higher than any platform bonus program.',
        ],
      },
      {
        heading: 'Getting started without an audience',
        paragraphs: [
          'You don’t need a personal brand to start. Many of the best-earning accounts in affiliate content marketing are faceless niche pages: clips, edits, curated themes. What matters is that the account posts consistently and the first three seconds of every video earn the viewer’s attention.',
          'Applying takes minutes: connect your accounts, browse live campaigns with their rates displayed up front, and submit your first post. Most creators get their first approval decision within a day.',
        ],
      },
    ],
  },
  {
    slug: 'faceless-accounts-that-earn',
    title: 'Faceless accounts that earn: the clipping playbook',
    description:
      'You don’t need to show your face to earn from short-form content. How clipping and theme accounts turn consistent posting into a real monthly income.',
    publishedAt: '2026-06-02',
    readMinutes: 5,
    sections: [
      {
        paragraphs: [
          'Some of the most reliable earners in creator marketing never appear on camera. They run clipping accounts — pages that publish tightly edited clips, reposts, and themed compilations — and they treat posting like a production line rather than a performance.',
          'Because campaign earnings follow views instead of personality, a well-run faceless page competes on equal footing with influencers. The playbook is simple to describe and hard to beat: volume, hooks, and niche focus.',
        ],
      },
      {
        heading: 'Volume beats perfection',
        paragraphs: [
          'A clipping account posting twenty videos a week doesn’t need every clip to land. If three take off, the month is made. Short-form algorithms distribute every upload on its own merits, so each post is a fresh lottery ticket — and volume buys tickets.',
          'The operational trick is batching: pick source material once, cut ten clips in one sitting, schedule them out. Two focused sessions a week sustain a posting cadence most solo creators can’t match.',
        ],
      },
      {
        heading: 'The first three seconds are the whole job',
        paragraphs: [
          'Viewers decide to stay or scroll almost instantly, and campaign math amplifies that decision: a clip that holds viewers past the threshold earns; one that doesn’t, earns nothing. Strong text hooks, immediate motion, and cutting straight into the moment are what separate earning accounts from dormant ones.',
          'Study the top posts in your niche and copy their structure shamelessly — the hook formula, the pacing, the caption style. Originality matters far less than execution here.',
        ],
      },
      {
        heading: 'Where the money comes in',
        paragraphs: [
          'Campaigns pay per thousand views, with rates that vary by niche and platform. A faceless page that reliably produces a few hundred thousand views a month translates those views into a predictable payout — no sponsorship negotiations, no media kits, no DMs.',
          'That predictability is the real advantage: clipping turns content into something closer to a part-time job with a paycheck than a creative gamble.',
        ],
      },
    ],
  },
  {
    slug: 'creator-payouts-explained-bank-crypto-paypal',
    title: 'Creator payouts explained: bank, crypto, or PayPal?',
    description:
      'Where your campaign earnings actually land: how bank transfers, crypto, and PayPal payouts compare on speed, fees, and reliability for creators.',
    publishedAt: '2026-06-24',
    readMinutes: 4,
    sections: [
      {
        paragraphs: [
          'Earning the money is half the story; getting it into your hands is the other half. Creators on Orcazo choose between bank transfer, crypto, and PayPal for their payouts, and the right answer depends on where you live, how fast you want the money, and what fees you’ll tolerate.',
        ],
      },
      {
        heading: 'Bank transfers: the default for a reason',
        paragraphs: [
          'A direct transfer to your own bank account is the most predictable option: no wallet management, straightforward for taxes, and no conversion step. International transfers can take a few business days and may involve intermediary fees, but for most creators this is the set-and-forget choice.',
        ],
      },
      {
        heading: 'Crypto: fastest across borders',
        paragraphs: [
          'For creators in countries where international banking is slow or expensive, stablecoin payouts (USDC or USDT) arrive in minutes with minimal fees. The trade-offs are real: you manage the wallet, you handle the off-ramp to local currency, and you keep your own records for tax purposes.',
          'If you go this route, double-check the network before submitting a payout request — a token sent on the wrong network is often unrecoverable.',
        ],
      },
      {
        heading: 'PayPal: convenient, with caveats',
        paragraphs: [
          'PayPal is instant and familiar, which makes it popular for smaller, more frequent payouts. Watch the fee structure and currency-conversion spread, and make sure your account is verified — unverified accounts are where payment holds happen.',
          'Whichever method you pick, keep it consistent. A stable payout method with a clean history processes faster on every request that follows.',
        ],
      },
    ],
  },
];

export function getArticle(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}
