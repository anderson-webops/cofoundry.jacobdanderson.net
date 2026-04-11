import type { MarketingStat, PricingTier, Testimonial } from "../types/domain"

export const heroMetrics: MarketingStat[] = [
  { label: "Qualified intros", value: "4.2x", context: "More accepted connections than a cold outbound workflow." },
  { label: "Proposal-to-agreement time", value: "9 days", context: "Median time from first match to signed founder agreement." },
  { label: "Paid retention", value: "81%", context: "Teams keep using the workflow after their first proposal cycle." },
]

export const howItWorksSteps = [
  {
    id: "profile",
    eyebrow: "1. Signal clearly",
    title: "Build a serious founder profile, not a résumé dump.",
    body: "Capture your operating strengths, stage preferences, expected commitment, equity expectations, and the kind of startup relationships you actually want.",
  },
  {
    id: "match",
    eyebrow: "2. Match intentionally",
    title: "Search people and startup opportunities with real founder criteria.",
    body: "Filter by role, industry, stage, commitment, compensation, location, and remote preference. Hidden contact details keep outreach mutual and higher signal.",
  },
  {
    id: "proposal",
    eyebrow: "3. Structure the deal",
    title: "Move from interest to a proposal with the hard parts already on the table.",
    body: "Responsibilities, decision rights, vesting, cliff, IP assignment, cash, equity, and exit terms all live in one versioned workflow.",
  },
  {
    id: "agreement",
    eyebrow: "4. Formalize the relationship",
    title: "Generate a working collaborator agreement without turning into a law firm.",
    body: "Accepted proposals convert into editable contract templates with signatures, timestamps, printable views, and clear legal-review guidance.",
  },
]

export const pricingTiers: PricingTier[] = [
  {
    id: "free",
    name: "Free",
    priceLabel: "$0",
    description: "Start your profile, browse the market, and make a limited number of thoughtful introductions.",
    ctaLabel: "Start free",
    highlighted: false,
    features: [
      "Create a full founder or collaborator profile",
      "Browse profiles and startup opportunities",
      "Up to 5 connection requests per month",
      "Basic opportunity posting",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    priceLabel: "$39/mo",
    description: "For founders and operators actively forming teams and negotiating real working relationships.",
    ctaLabel: "Upgrade to Pro",
    highlighted: true,
    features: [
      "Unlimited messaging after mutual matches",
      "Proposal builder with version history",
      "Contract generator and signature workflow",
      "Saved searches and profile visibility boost",
    ],
  },
  {
    id: "team",
    name: "Team / Studio",
    priceLabel: "$149/mo",
    description: "For venture studios, repeat founders, and small holding teams managing several searches at once.",
    ctaLabel: "Talk to sales",
    highlighted: false,
    features: [
      "Shared billing and collaboration seats",
      "Multiple startup opportunities",
      "Admin-style hiring and moderation tools",
      "Priority contract review workflow setup",
    ],
  },
]

export const testimonials: Testimonial[] = [
  {
    id: "t1",
    quote: "We met on CoFoundry, traded a concrete proposal in the first week, and had a signed working agreement before we incorporated.",
    author: "Olivia Chen",
    role: "Founder",
    company: "LedgerLoop",
  },
  {
    id: "t2",
    quote: "Every other platform felt like freelance lead gen. CoFoundry filtered for people who wanted ownership and long-term alignment.",
    author: "Malik Thompson",
    role: "Technical Co-Founder",
    company: "Operator now at Dockyard AI",
  },
  {
    id: "t3",
    quote: "The proposal workflow forced us to talk through decision rights and vesting early, which saved us from vague founder energy.",
    author: "Sofia Ramirez",
    role: "Founding Designer",
    company: "Trialwire",
  },
]

export const faqs = [
  {
    question: "Is CoFoundry a freelance marketplace?",
    answer: "No. CoFoundry is designed for forming startup teams and long-term collaborations. It is centered on ownership, commitment, and venture-building fit rather than one-off project work.",
  },
  {
    question: "Does CoFoundry take equity in every relationship?",
    answer: "No. V1 is subscription software. Teams may optionally apply for a future investment program if the feature is enabled, but platform equity is not part of the core workflow.",
  },
  {
    question: "Can I keep my profile private while browsing?",
    answer: "Yes. Privacy controls let you choose public-lite visibility, member-only details, and match-only contact sharing.",
  },
  {
    question: "Are the contracts legally binding?",
    answer: "The contracts are editable templates with typed signatures and timestamps. They are not legal advice and should be reviewed by qualified counsel before execution.",
  },
  {
    question: "Do you support remote-first teams?",
    answer: "Yes. Remote, hybrid, and in-person preferences are all part of the matching and opportunity filters.",
  },
]

export const trustPillars = [
  {
    title: "Mutual-intent messaging",
    body: "Direct contact details stay hidden until both sides opt into a connection. That keeps the discovery layer more respectful and less spam-prone.",
  },
  {
    title: "Structured negotiation",
    body: "Proposal templates surface the hard questions early: equity, vesting, IP, decision rights, and exit expectations.",
  },
  {
    title: "Moderation workflow",
    body: "Profiles, opportunities, and messages can be flagged and reviewed by moderators with suspension tools and an auditable action log.",
  },
]
