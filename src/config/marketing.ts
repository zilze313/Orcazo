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

  // Curated campaign cards for the public homepage grid.
  // Static by design: numbers here are examples you control, nothing leaks from the DB.
  showcaseCampaigns: [
    {
      title: "Fitness App Clipping | $25k Budget",
      brand: "PulseFit",
      category: "Clipping",
      niche: "Health",
      age: "2 weeks ago",
      paid: 9840, budget: 25000,
      rate: "$1.80", approval: "64%", views: "4.2M", creators: 812,
    },
    {
      title: "AI Study Tool — Meme Style Clips",
      brand: "ArtaAI",
      category: "Clipping",
      niche: "Technology",
      age: "1 month ago",
      paid: 21360, budget: 30000,
      rate: "$2.00", approval: "71%", views: "11.9M", creators: 1204,
    },
    {
      title: "Podcast Highlights | $18k Budget",
      brand: "Cantina",
      category: "Clipping",
      niche: "Personal Brand",
      age: "3 weeks ago",
      paid: 12475, budget: 18000,
      rate: "$1.50", approval: "58%", views: "8.6M", creators: 640,
    },
    {
      title: "Faith & Daily Quotes Shorts",
      brand: "BibleChat",
      category: "UGC",
      niche: "Lifestyle",
      age: "1 month ago",
      paid: 15980, budget: 20000,
      rate: "$1.25", approval: "77%", views: "14.3M", creators: 923,
    },
    {
      title: "Streetwear Drop — Product Clips",
      brand: "Zestr",
      category: "Clipping",
      niche: "Product",
      age: "2 weeks ago",
      paid: 6120, budget: 15000,
      rate: "$2.50", approval: "49%", views: "2.1M", creators: 356,
    },
    {
      title: "Dating App Skits | $22k Budget",
      brand: "RizzApp",
      category: "UGC",
      niche: "Entertainment",
      age: "1 week ago",
      paid: 3480, budget: 22000,
      rate: "$2.20", approval: "38%", views: "1.4M", creators: 289,
    },
  ],

  faqs: [
    {
      q: "How does Orcazo work?",
      a: "Brands fund campaigns with a budget and a rate per 1,000 views. You pick a campaign, post short-form videos on TikTok, Instagram or YouTube, submit the link, and earn from every approved view your video generates.",
    },
    {
      q: "Do I need a lot of followers to earn?",
      a: "No. We pay for views and engagement, not follower counts. Plenty of creators earn well with small or brand-new accounts — what matters is that your clips perform.",
    },
    {
      q: "How do I submit videos?",
      a: "Once your application is approved, open a campaign in your dashboard, follow its brief, and paste the link to your published post. We track the views automatically from there.",
    },
    {
      q: "How often do I get paid?",
      a: "Weekly. Once your balance clears the minimum payout, you can withdraw to your bank account or crypto wallet — no 30-day net terms, no chasing invoices.",
    },
    {
      q: "Are there any fees?",
      a: "Joining Orcazo is free for creators. The rate you see on a campaign is what you earn per 1,000 approved views.",
    },
    {
      q: "Why was my video rejected?",
      a: "The most common reasons are not following the campaign brief, reposting content that wasn't yours, or artificial engagement. Every rejection shows a reason in your dashboard so you know exactly what to fix.",
    },
  ],

} as const;
