import type { MarketingStat, PricingTier, Testimonial } from "../types/domain"

export const heroMetrics: MarketingStat[] = [
  { label: "Qualified intros", value: "4.2x", context: "More accepted connections than a cold outbound workflow." },
  { label: "Proposal-to-agreement time", value: "9 days", context: "Median time from first match to signed founder agreement." },
  { label: "Paid retention", value: "81%", context: "Teams keep using the workflow after their first proposal cycle." },
]

export const howItWorksSteps = [
  {
    id: "intent",
    eyebrow: "1. Declare intent",
    title: "Lead with timing, company shape, and the non-negotiables that actually matter.",
    body: "CoFoundry asks for a serious intent profile before discovery: commitment, start timeline, company preferences, equity expectations, and the conditions that should be explicit before anyone reaches for a proposal.",
  },
  {
    id: "trust",
    eyebrow: "2. Show proof",
    title: "Use proof-of-work and responsiveness signals to reduce search costs.",
    body: "Profiles surface builder proof, verification, recent activity, and reply speed so members can quickly tell whether someone is real, active, and worth a serious conversation.",
  },
  {
    id: "match",
    eyebrow: "3. Match intentionally",
    title: "Keep contact mutual and the discovery layer calmer.",
    body: "Filter by role, industry, stage, commitment, compensation, location, and remote preference. Direct contact stays gated until both sides opt in.",
  },
  {
    id: "call",
    eyebrow: "4. Run the first call well",
    title: "Use a guided first-call agenda instead of a vague founder chemistry chat.",
    body: "CoFoundry pushes the early conversation toward motivation, company shape, commitment, decision rights, and trial expectations so serious people do not waste a week talking around the hard parts.",
  },
  {
    id: "trial",
    eyebrow: "5. Run a short sprint",
    title: "Pressure-test the working relationship before long-term terms feel permanent.",
    body: "A lightweight trial collaboration plan plus an alignment check helps the pair define commitment, governance defaults, scope, cadence, deliverables, and success signals before anyone pretends the fit is already proven.",
  },
  {
    id: "agreement",
    eyebrow: "6. Structure and sign",
    title: "Move from trial to versioned proposal and a clean agreement draft.",
    body: "Responsibilities, decision rights, vesting, cliff, IP assignment, cash, equity, and exit terms all live in one versioned workflow that can roll into a signed template agreement.",
  },
]

export const pricingTiers: PricingTier[] = [
  {
    id: "free",
    name: "Free",
    priceLabel: "$0",
    description: "Keep the market liquid: build your profile, browse seriously, and use a small number of high-intent workflow actions each month.",
    ctaLabel: "Start free",
    highlighted: false,
    features: [
      "Create a high-signal founder or collaborator profile",
      "Private member discovery and basic ranking",
      "Up to 5 connection requests per month",
      "1 saved search, 2 proposal sends, and 1 agreement preview each month",
      "Messaging after mutual matches stays available",
      "Guided first-call agenda and one active trial sprint",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    priceLabel: "$29/mo",
    description: "For founders and operators actively running a search process and turning real conversations into structured terms.",
    ctaLabel: "Upgrade to Pro",
    highlighted: true,
    features: [
      "40 new intros per month with unlimited saved searches",
      "Proof-of-work, activity, and stronger trust visibility",
      "12 proposal sends and 8 agreement drafts each month",
      "Deal room with clause-level comments and version history",
      "Signature-ready agreement workflow and print-friendly export",
      "Transparent renewal date plus one-click in-product cancellation",
      "Saved searches, ranking boost, and deeper workflow tools",
    ],
  },
  {
    id: "team",
    name: "Team / Studio",
    priceLabel: "$99/mo",
    description: "For venture studios, repeat founders, and small holding teams managing several searches with higher outbound and deal-room volume.",
    ctaLabel: "Talk to sales",
    highlighted: false,
    features: [
      "Higher-volume intros, proposal sends, and agreement drafts",
      "Multiple startup opportunities",
      "Shared deal-room management across several searches",
      "Admin-style moderation and review tools",
      "Priority workflow setup for repeat searches and venture studios",
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
    question: "Are profiles public to the open internet?",
    answer: "Only if you opt in. CoFoundry now supports public profile previews and startup opportunity pages for members who want searchable visibility, while direct contact details remain gated behind mutual-intent rules.",
  },
  {
    question: "Why do you limit outreach on the free tier?",
    answer: "Because unbounded outreach destroys trust. CoFoundry is designed around thoughtful intros, not volume spam, so the free tier stays useful without turning the network into a noisy inbox.",
  },
  {
    question: "Do I have to pay to message someone I already matched with?",
    answer: "No. Messaging after mutual interest stays available on every plan. The metered unit is new outbound intros and other high-intent workflow actions, not ongoing matched conversation.",
  },
  {
    question: "What is the trial collaboration workflow?",
    answer: "It is a short, structured working sprint that helps both sides pressure-test cadence, ownership, and communication before they finalize a proposal or agreement.",
  },
  {
    question: "Why does CoFoundry ask about runway, equity philosophy, and IP readiness?",
    answer: "Because most founder breakups are not random. They usually come from mismatched commitment, unclear control, role confusion, or ownership surprises. CoFoundry makes those signals explicit earlier so the wrong match fails fast and the right match gets clearer faster.",
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
    title: "Private, mutual-intent access",
    body: "Direct contact details stay hidden until both sides opt into a connection. Discovery is designed to stay calmer and more respectful than open founder directories.",
  },
  {
    title: "Proof of work and verification",
    body: "Profiles surface builder proof, linked accounts, and step-up trust signals so members can judge credibility faster than they can from headline-only profiles.",
  },
  {
    title: "Responsiveness and activity signals",
    body: "Recent activity and reply behavior shape visibility so the network does not fill with dead inventory, stale profiles, or silent matches.",
  },
  {
    title: "Structured negotiation",
    body: "The workflow moves from first call to trial sprint to versioned proposal and agreement draft, surfacing equity, vesting, IP, and decision rights early.",
  },
  {
    title: "Moderation workflow",
    body: "Profiles, opportunities, and messages can be flagged and reviewed by moderators with high-priority escalation for scams, impersonation, and privacy violations.",
  },
]

export const researchPrinciples = [
  {
    title: "Tight intent beats open-ended browsing",
    body: "The strongest marketplaces reduce search costs. CoFoundry makes timing, company fit, and non-negotiables explicit before people start sending intros.",
  },
  {
    title: "Proof-of-work matters more than founder theater",
    body: "Profiles are easier to trust when they include artifacts, outcomes, and operational evidence instead of ambition-only copy.",
  },
  {
    title: "The hard part starts after the match",
    body: "The real differentiator is the post-match workflow: first call, trial sprint, proposal, and agreement. That is where vague chemistry either turns into a real team or falls apart quickly.",
  },
  {
    title: "Alignment should be explicit before equity enters the room",
    body: "CoFoundry now treats commitment, runway, role boundaries, governance defaults, and IP readiness as product data, not hidden assumptions that only surface in a bad negotiation.",
  },
  {
    title: "Workflow value justifies the subscription",
    body: "CoFoundry is more defensible when it sells de-risking and faster team formation, not just directory access.",
  },
]
