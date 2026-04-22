import type { MarketingStat, PricingTier } from "../types/domain"

export const heroMetrics: MarketingStat[] = [
  { label: "Contact", value: "Mutual", context: "Direct outreach stays inside the product until both sides opt in." },
  { label: "Trial sprint", value: "Built in", context: "Move from the first call to a short working test before heavier terms." },
  { label: "Proposal history", value: "Versioned", context: "Keep comments, revisions, and agreement drafts in one place." },
]

export const howItWorksSteps = [
  {
    id: "intent",
    eyebrow: "1. Start with a clear search",
    title: "Say what you want to build, join, and commit to right now.",
    body: "Profiles start with role, timing, weekly availability, stage preferences, and the company shapes you are actually open to.",
  },
  {
    id: "trust",
    eyebrow: "2. Show real proof",
    title: "Give people enough context to decide whether a conversation is worth having.",
    body: "Use links, visible work, and recent activity to show that you are real, current, and serious about the search.",
  },
  {
    id: "match",
    eyebrow: "3. Match with context",
    title: "Filter by role, stage, industry, commitment, compensation, and work style.",
    body: "Discovery helps you narrow the list quickly, while direct contact stays gated until both sides opt in.",
  },
  {
    id: "call",
    eyebrow: "4. Use the first call well",
    title: "Focus early on motivation, commitment, scope, and decision-making.",
    body: "The early conversation should answer whether the fit is real, not just whether the energy is good.",
  },
  {
    id: "trial",
    eyebrow: "5. Run a short trial",
    title: "Test how you work together before you formalize the relationship.",
    body: "Use a small working sprint to check pace, communication, ownership, and follow-through before you negotiate long-term terms.",
  },
  {
    id: "agreement",
    eyebrow: "6. Put the terms in writing",
    title: "Move from trial notes to a proposal and an agreement draft.",
    body: "Keep role scope, commitment, vesting, IP, cash, equity, and decision rights in one versioned workflow.",
  },
]

export const pricingTiers: PricingTier[] = [
  {
    id: "free",
    name: "Free",
    priceLabel: "$0",
    description: "Build your profile, browse the network, and start a focused search.",
    ctaLabel: "Start free",
    highlighted: false,
    features: [
      "Create a founder or collaborator profile",
      "Member discovery and basic ranking",
      "Up to 5 new intros each month",
      "1 saved search, 2 proposal sends, and 1 agreement preview each month",
      "Matched messaging",
      "First-call guide and one active trial sprint",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    priceLabel: "$29/mo",
    description: "For active searches that need more outreach and the full proposal workflow.",
    ctaLabel: "Upgrade to Pro",
    highlighted: true,
    features: [
      "40 new intros per month with unlimited saved searches",
      "Stronger visibility for proof, activity, and trust signals",
      "12 proposal sends and 8 agreement drafts each month",
      "Deal room with clause-level comments and version history",
      "Signature-ready agreement workflow and export",
      "Clear renewal date and in-product cancellation",
      "Ranking boost and deeper workflow tools",
    ],
  },
  {
    id: "team",
    name: "Team / Studio",
    priceLabel: "$99/mo",
    description: "For venture studios and repeat founders running several searches at once.",
    ctaLabel: "Talk to sales",
    highlighted: false,
    features: [
      "Higher-volume intros, proposals, and agreement drafts",
      "Multiple startup opportunities",
      "Shared deal-room management across several searches",
      "Team-level review and moderation tools",
      "Priority setup for repeat searches and studios",
    ],
  },
]

export const faqs = [
  {
    question: "Is CoFoundry a freelance marketplace?",
    answer: "No. CoFoundry is for founders and early collaborators who want to build a company together, not for one-off project work.",
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
    question: "Are profiles public to the open internet?",
    answer: "Only if you opt in. CoFoundry now supports public profile previews and startup opportunity pages for members who want searchable visibility, while direct contact details remain gated behind mutual-intent rules.",
  },
  {
    question: "Why do you limit outreach on the free tier?",
    answer: "Because unlimited outreach turns any matching product into spam. The free tier is meant for a focused search, not inbox spray.",
  },
  {
    question: "Do I have to pay to message someone I already matched with?",
    answer: "No. Messaging after a mutual match stays available on every plan. Limits apply to new outbound intros and later-stage workflow actions.",
  },
  {
    question: "What is the trial collaboration workflow?",
    answer: "It is a short, structured working sprint that helps both sides pressure-test cadence, ownership, and communication before they finalize a proposal or agreement.",
  },
  {
    question: "Why does CoFoundry ask about runway, equity philosophy, and IP readiness?",
    answer: "Because most bad founder matches fail over commitment, control, role boundaries, or ownership surprises. CoFoundry asks those questions early so the fit is clearer before people get deep into the process.",
  },
  {
    question: "Are the contracts legally binding?",
    answer: "The contracts are editable templates with typed signatures and timestamps. They are not legal advice and should be reviewed by qualified counsel before execution.",
  },
  {
    question: "How easy is it to cancel a paid plan?",
    answer: "Cancellation is handled in-product with the renewal date shown clearly. CoFoundry does not treat billing friction as a growth tactic.",
  },
  {
    question: "Do you support remote-first teams?",
    answer: "Yes. Remote, hybrid, and in-person preferences are all part of the matching and opportunity filters.",
  },
]

export const trustPillars = [
  {
    title: "Mutual contact rules",
    body: "Direct contact details stay hidden until both sides opt into a connection.",
  },
  {
    title: "Visible proof",
    body: "Profiles surface linked accounts, real work, and verification signals so members can judge credibility faster.",
  },
  {
    title: "Activity signals",
    body: "Recent activity and reply behavior help keep discovery focused on people who are actually active.",
  },
  {
    title: "Structured negotiation",
    body: "The workflow moves from first call to trial sprint to proposal and agreement draft, surfacing the important terms early.",
  },
  {
    title: "Moderation workflow",
    body: "Profiles, opportunities, and messages can be flagged and reviewed when something looks unsafe or misleading.",
  },
]

export const researchPrinciples = [
  {
    title: "See fit sooner",
    body: "Profiles surface role, stage, timing, and commitment so you can rule people in or out quickly.",
  },
  {
    title: "Talk with context",
    body: "First-call prompts keep the early conversation focused on the decisions that matter.",
  },
  {
    title: "Test the working relationship",
    body: "A short sprint tells you more than a long thread of speculative messages.",
  },
  {
    title: "Keep the terms organized",
    body: "Proposal versions, comments, and agreement drafts stay in one workflow instead of getting scattered across docs and threads.",
  },
  {
    title: "Pay when the workflow matters",
    body: "Free gets you into the network. Paid plans expand outreach and the tools that formalize a partnership.",
  },
]
