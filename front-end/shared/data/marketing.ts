import type { PricingTier } from "../types/domain"

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
    body: "Use links, visible work, and recent activity to show that you are real, current, and worth replying to.",
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
    body: "Keep role scope, commitment, vesting, IP, cash, equity, and decision rights in one versioned record.",
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
    description: "For active searches that need more outreach and full proposal and agreement tools.",
    ctaLabel: "Upgrade to Pro",
    highlighted: true,
    features: [
      "40 new intros per month with unlimited saved searches",
      "Stronger visibility for proof, activity, and trust signals",
      "12 proposal sends and 8 agreement drafts each month",
      "Deal room with clause-level comments and version history",
      "Signature-ready agreements and export for both participants",
      "Version-bound handoff to your in-house or outside counsel",
      "Clear renewal date and in-product cancellation",
      "Deeper search controls and visibility",
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
      "Shared proposal and agreement management across several searches",
      "Shared in-house and outside-counsel review handoffs",
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
    answer: "No. The core product is subscription software. When the separate fundraising workspace is enabled, teams may optionally submit a program application, but platform equity is not part of the subscription product and no financing is guaranteed.",
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
    answer: "No. Messaging after a mutual match stays available on every plan. Limits apply to new outbound intros and later-stage proposal and agreement actions.",
  },
  {
    question: "Does each agreement participant need a paid plan?",
    answer: "No. When either participant has an active Pro or Team plan, that plan sponsors the shared agreement workflow so both people can revise, request legal review, export, and sign that agreement.",
  },
  {
    question: "How does the trial collaboration step work?",
    answer: "It is a short, structured working sprint that helps both sides pressure-test cadence, ownership, and communication before they finalize a proposal or agreement.",
  },
  {
    question: "Why does CoFoundry ask about runway, equity philosophy, and IP readiness?",
    answer: "Because most bad founder matches fail over commitment, control, role boundaries, or ownership surprises. CoFoundry asks those questions early so the fit is clearer before people get deep into the process.",
  },
  {
    question: "Are the contracts legally binding?",
    answer: "The agreements are editable templates with typed signatures and timestamps. They are not legal advice. You can invite your own in-house or outside legal representative to one exact version before execution.",
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
    body: "The product moves from first call to trial sprint, proposal negotiation, versioned agreement, optional counsel review, and signatures.",
  },
  {
    title: "Moderation and review",
    body: "Profiles, opportunities, and messages can be flagged and reviewed when something looks unsafe or misleading.",
  },
]
