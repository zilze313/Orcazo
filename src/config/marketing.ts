// Static marketing copy + numbers. Edit freely as you grow — no DB, no fancy CMS.
// All numbers are placeholders / aspirational; swap for real counts when you have them.

export const MARKETING = {
  brandHero: {
    eyebrow: "Organic content marketing, at scale",
    heading: "The Supreme Platform For Organic Marketing",
    sub: "Grow your brand with Orcazo’s network of over 150,000 creators across TikTok, Instagram, YouTube, X, Snapchat, and Facebook.",
  },

  creatorHero: {
    eyebrow: "Get paid for the content you already make",
    heading: "Make money uploading videos on social media",
    sub: "Join thousands of creators earning real income from short-form content. No followers required — just real engagement.",
  },

  // Top-line stats shown on both pages
  stats: [
    { label: "Creators on the network", value: "150,000+" },
    { label: "Active monthly creators", value: "25,767" },
    { label: "Views generated this year", value: "4.8B+" },
    { label: "Paid out to creators", value: "$12M+" },
  ],

  // "Trusted by" ticker — feel free to swap in real client names once you have them
  trustedBy: [
    "Cantina",
    "RizzApp",
    "Zestr",
    "ArtaAI",
    "PlugAI",
    "PumpFun",
    "BibleChat",
  ],

  // How it works — for brands
  howItWorksBrand: [
    {
      title: "Tell us your goal",
      body: "Share your campaign objectives, target audience, and budget. Our team builds a strategy in 24h.",
    },
    {
      title: "We match you with creators",
      body: "Get paired with vetted creators who match your niche and audience. No follower minimums — we score by engagement.",
    },
    {
      title: "Pay only for performance",
      body: "You set the rate per thousand views. Creators get paid when their videos hit your view threshold. No upfront retainers.",
    },
    {
      title: "Track everything in real time",
      body: "Live dashboards showing every video, view count, demographic split, and ROI. Full transparency.",
    },
  ],

  howItWorksCreator: [
    {
      title: "Apply in 60 seconds",
      body: "Tell us your social handles, and we’ll review your application within 24 hours.",
    },
    {
      title: "Pick a campaign",
      body: "Browse active campaigns, see the rate per thousand views, and submit your video link.",
    },
    {
      title: "Get paid every week",
      body: "Earnings deposited via bank or crypto, with full transparency on what each video earned.",
    },
  ],

  // Brand testimonials / case studies
  brandTestimonials: [
    {
      brand: "Rebet",
      quote:
        "“Orcazo scaled our content output 6x in two months. The creator quality is unmatched, and the dashboard makes it impossible to lose track of any video.”",
      author: "Marketing Lead, Rebet",
      stat: "21M+ views in 60 days",
    },
    {
      brand: "Cantina",
      quote:
        "“We tried three other influencer platforms before this. Only Orcazo actually delivered creators who understood the brief without us micromanaging.”",
      author: "Growth Director, Cantina",
      stat: "$0.18 effective CPM",
    },
    {
      brand: "High5Casino",
      quote:
        "“The ability to apply rate caps per post and still get serious creators is a game changer. We control spend without sacrificing reach.”",
      author: "CMO, High5Casino",
      stat: "12.4M views, 3.2x ROI",
    },
  ],

  // Creator testimonials (static dummy)
  creatorTestimonials: [
    {
      name: "Selena M.",
      handle: "@selenamiller_2",
      quote:
        "“I started with one Instagram account a year ago. Now I have four, all earning every week. Orcazo actually pays on time, every time.”",
      stat: "Earned $4,200 last month",
    },
    {
      name: "Diego R.",
      handle: "@diegoclips",
      quote:
        "“The dashboard is super clear — I know exactly what each video earned and when I’m getting paid. No more chasing brands for invoices.”",
      stat: "Earned $8,750 last month",
    },
    {
      name: "Noor K.",
      handle: "@noor.creates",
      quote:
        "“What I love most is the variety of campaigns. There’s always something new to repost, and the rates are way better than direct brand deals.”",
      stat: "Earned $2,900 last month",
    },
  ],

  // Final-CTA blurbs
  brandCta: {
    heading: "Ready to scale your brand?",
    sub: "Get a custom strategy and creator-match list from our team within 24 hours.",
  },
  creatorCta: {
    heading: "Start earning today",
    sub: "Apply now — most creators get a decision within 24 hours.",
  },

  // Brand budget options on the brand-signup form
  budgetOptions: [
    "Under $1,000 / month",
    "$1,000 – $5,000 / month",
    "$5,000 – $10,000 / month",
    "$10,000 – $50,000 / month",
    "$50,000 – $100,000 / month",
    "$100,000+ / month",
  ],
} as const;
