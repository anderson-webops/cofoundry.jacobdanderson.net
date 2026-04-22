export interface GuideSection {
  title: string
  body: string
  bullets?: string[]
}

export interface GuidePage {
  slug: string
  title: string
  description: string
  eyebrow: string
  category: "trust" | "contracts"
  ctaLabel: string
  ctaTo: string
  sections: GuideSection[]
}

export const trustCenterPages: GuidePage[] = [
  {
    slug: "profile-visibility",
    title: "Profile visibility and employer safety",
    description: "Control when your profile is public, who can see it, and when direct outreach becomes possible.",
    eyebrow: "Trust Center",
    category: "trust",
    ctaLabel: "Create a private-first profile",
    ctaTo: "/auth/sign-up",
    sections: [
      {
        title: "Private by default, public by choice",
        body: "Members can stay private, member-visible, or open a public preview page when they want to be discoverable on the wider web.",
      },
      {
        title: "Contact details stay gated",
        body: "Even when a profile is public, direct email and phone details are not. Public pages help people evaluate fit before they request contact through CoFoundry.",
        bullets: [
          "Public pages show role fit, proof of work, and company preferences.",
          "Contact details remain hidden until the member's reveal rule is met.",
          "Outbound requests still run through trust and outreach limits.",
        ],
      },
      {
        title: "When to go public",
        body: "Public profiles work best when you are actively running a search and want a shareable page that still keeps direct outreach inside the product.",
      },
    ],
  },
  {
    slug: "anti-spam",
    title: "Anti-spam and outreach limits",
    description: "CoFoundry limits outreach so the network stays usable and conversations stay relevant.",
    eyebrow: "Trust Center",
    category: "trust",
    ctaLabel: "See how matching works",
    ctaTo: "/how-it-works",
    sections: [
      {
        title: "Why limits exist",
        body: "The point of the network is not maximum message volume. Limits, trust checks, and moderation are there to keep the conversation quality high.",
      },
      {
        title: "What we look for",
        body: "Signals that support more access include stronger profile completeness, proof links, recent activity, and extra verification for higher-risk actions.",
        bullets: [
          "Low-effort profiles do not get full outbound access.",
          "Off-platform pressure, fee requests, or scraping behavior trigger review.",
          "High-priority abuse categories escalate separately from routine moderation.",
        ],
      },
      {
        title: "What happens if a member is restricted",
        body: "Restrictions are reviewable. Reports and moderation actions stay attached to the case so a decision can be revisited if the account was flagged incorrectly.",
      },
    ],
  },
  {
    slug: "not-a-freelance-marketplace",
    title: "Who CoFoundry is for",
    description: "CoFoundry is built for founders, co-founders, and early collaborators forming real companies together.",
    eyebrow: "Trust Center",
    category: "trust",
    ctaLabel: "Browse public founder searches",
    ctaTo: "/find-cofounder",
    sections: [
      {
        title: "Who the platform is for",
        body: "Founders, future co-founders, and early collaborators who want to start or join a business with meaningful ownership, defined scope, and shared downside.",
      },
      {
        title: "What does not belong here",
        body: "Recruiting for ordinary jobs, freelance project work, advisory spam, and off-platform service selling all make matching worse.",
        bullets: [
          "If you need one-off execution, use a services marketplace.",
          "If you are hiring employees, use a recruiting product.",
          "If you want a startup partner, use CoFoundry's matching, proposal, and agreement tools.",
        ],
      },
      {
        title: "Why the focus matters",
        body: "The product only works if people can trust that outreach is coming from someone who actually wants to build a company together.",
      },
    ],
  },
]

export const contractGuidePages: GuidePage[] = [
  {
    slug: "founder-agreement",
    title: "Founder agreement checklist",
    description: "A strong founder agreement starts with clear decisions about scope, economics, decision rights, and exits.",
    eyebrow: "Contracts & Proposals",
    category: "contracts",
    ctaLabel: "Start with a proposal",
    ctaTo: "/auth/sign-up",
    sections: [
      {
        title: "Decisions that should already be explicit",
        body: "A clean founder agreement should reflect decisions already made in conversation and a trial sprint, not surprises introduced by the document itself.",
        bullets: [
          "Who owns what role and what is explicitly out of scope.",
          "How much time each person is committing and by when.",
          "Cash, equity, vesting, and any cliff or milestone triggers.",
          "Decision rights, tie-break rules, and off-ramp terms.",
        ],
      },
      {
        title: "What CoFoundry contributes",
        body: "The proposal flow captures the facts most founder teams leave fuzzy: role title, responsibilities, weekly commitment, decision rights, IP assignment, confidentiality, and termination expectations.",
      },
      {
        title: "Important limitation",
        body: "CoFoundry's agreement builder produces editable templates and a negotiation record. It does not replace legal review, jurisdiction-specific drafting, or counsel for unusual founder terms.",
      },
    ],
  },
  {
    slug: "trial-project-plan",
    title: "Trial project plan for co-founders",
    description: "A short working sprint reveals more than a long run of speculative calls.",
    eyebrow: "Contracts & Proposals",
    category: "contracts",
    ctaLabel: "See how it works",
    ctaTo: "/how-it-works",
    sections: [
      {
        title: "What a good trial covers",
        body: "The sprint should be small, real, and hard enough to surface how the pair actually works together.",
        bullets: [
          "One narrow but meaningful problem to solve together.",
          "A weekly hour expectation and check-in cadence.",
          "Visible deliverables and a written retro at the end.",
        ],
      },
      {
        title: "What the sprint is testing",
        body: "It should expose communication quality, judgment, how disagreement gets resolved, and whether the role boundaries still make sense after real work starts.",
      },
      {
        title: "How it feeds the proposal",
        body: "A useful sprint creates evidence. That evidence should narrow the proposal instead of forcing the partnership to negotiate in the dark.",
      },
    ],
  },
  {
    slug: "founder-vesting",
    title: "Founder vesting and cliffs explained",
    description: "Vesting helps long-term ownership reflect long-term contribution and protects the company if the partnership breaks early.",
    eyebrow: "Contracts & Proposals",
    category: "contracts",
    ctaLabel: "Review agreement terms",
    ctaTo: "/contracts/founder-agreement",
    sections: [
      {
        title: "Why vesting shows up early",
        body: "Most founder conversations reach vesting quickly because it affects trust, incentives, and what happens if one person leaves before the company is real.",
      },
      {
        title: "Questions that matter",
        body: "Even if your counsel handles the final drafting, the founder pair should already be aligned on the broad logic.",
        bullets: [
          "What vesting schedule feels fair for the company shape.",
          "Whether there is a cliff and what it protects against.",
          "How unvested equity should be treated if someone exits early.",
        ],
      },
      {
        title: "How CoFoundry helps",
        body: "The proposal and agreement tools keep vesting and cliff choices in the same conversation as role scope, commitment, and IP so the tradeoffs stay connected.",
      },
    ],
  },
  {
    slug: "ip-assignment",
    title: "IP assignment for founder teams",
    description: "Founder teams should know what already exists, what may be constrained by employment obligations, and what needs to transfer into the company.",
    eyebrow: "Contracts & Proposals",
    category: "contracts",
    ctaLabel: "Compare proposal terms",
    ctaTo: "/pricing",
    sections: [
      {
        title: "Questions to answer before drafting",
        body: "IP conversations go badly when the team skips pre-existing assets, side projects, employer restrictions, and ambiguous ownership of early prototypes.",
        bullets: [
          "What already exists before the company is formed.",
          "Whether any current employer or client claim could conflict.",
          "Which net-new work must be assigned into the company.",
        ],
      },
      {
        title: "Why this belongs in the process",
        body: "IP readiness is not a legal afterthought. People who cannot discuss constraints clearly should not be sending founder terms yet.",
      },
      {
        title: "What CoFoundry does",
        body: "Profiles ask for IP readiness signals early, proposals preserve the negotiation record, and the agreement template carries the expectation forward into the document draft.",
      },
    ],
  },
]
