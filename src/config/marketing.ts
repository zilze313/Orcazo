// Static marketing copy + numbers. Edit freely as you grow — no DB, no fancy CMS.
// All numbers are placeholders / aspirational; swap for real counts when you have them.

export const MARKETING = {
  creatorHero: {
    eyebrow: "Get paid for the content you already make",
    heading: "Make money uploading videos on social media",
    sub: "Join thousands of creators earning real income from short-form content. No followers required — just real engagement.",
  },

  // Top-line stats shown on both pages
  stats: [
    { label: "Creators on the network", value: "255,000+" },
    { label: "Active monthly creators", value: "34,767" },
    { label: "Views generated this year", value: "6.8B+" },
    { label: "Paid out to creators", value: "$18M+" },
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

  creatorCta: {
    heading: "Start earning today",
    sub: "Apply now — most creators get a decision within 24 hours.",
  },

} as const;
