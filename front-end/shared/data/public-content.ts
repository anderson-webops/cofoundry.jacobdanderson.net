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
    description: "Public discovery only works if serious people can control when their identity becomes indexable and when direct outreach becomes possible.",
    eyebrow: "Trust Center",
    category: "trust",
    ctaLabel: "Create a private-first profile",
    ctaTo: "/auth/sign-up",
    sections: [
      {
        title: "Private by default, public by choice",
        body: "CoFoundry treats public visibility as an explicit opt-in. Members can stay private, member-visible, or open a public preview page when they want to be discoverable to the wider web.",
      },
      {
        title: "Contact details stay gated",
        body: "Even when a profile is public, direct email and phone details are not. The public page is there to prove fit and credibility. Access to the person still runs through CoFoundry's mutual-interest workflow.",
        bullets: [
          "Public pages show role fit, proof of work, and company preferences.",
          "Contact details remain hidden until the member's reveal rule is met.",
          "Outbound requests still run through trust and outreach limits.",
        ],
      },
      {
        title: "When to go public",
        body: "Public profiles work best when someone is actively running a search, wants shareable proof of seriousness, and can handle a small number of qualified inbound requests without creating noise.",
      },
    ],
  },
  {
    slug: "anti-spam",
    title: "Anti-spam and outreach limits",
    description: "A founder-matching product gets worse fast when every new account can spray messages or scrape links. CoFoundry keeps that channel intentionally narrow.",
    eyebrow: "Trust Center",
    category: "trust",
    ctaLabel: "See how matching works",
    ctaTo: "/how-it-works",
    sections: [
      {
        title: "Why limits exist",
        body: "The point of the network is not maximum message volume. It is a higher percentage of serious conversations. Free-tier limits, trust tiers, and moderation rules protect that.",
      },
      {
        title: "What we look for",
        body: "Signals that support more access include stronger profile completeness, proof-of-work links, recent activity, and step-up verification for higher-risk actions.",
        bullets: [
          "Low-effort profiles do not get full outbound access.",
          "Off-platform pressure, fee requests, or scraping behavior trigger review.",
          "High-priority abuse categories escalate separately from routine moderation.",
        ],
      },
      {
        title: "What happens if a member is restricted",
        body: "Restrictions are reviewable. Reports, safety context, and moderation actions are attached to the case so the decision can be revisited if the account was flagged incorrectly.",
      },
    ],
  },
  {
    slug: "not-a-freelance-marketplace",
    title: "Why CoFoundry is not a freelance marketplace",
    description: "The product is built for long-term startup formation: shared ownership, serious commitment, and founder-level clarity. It is not optimized for gigs, recruiting funnels, or consulting lead-gen.",
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
        title: "What we do not want on the network",
        body: "Recruiting around full-time jobs, freelance project work, advisory spam, and off-platform service selling all degrade matching quality.",
        bullets: [
          "If you need one-off execution, use a services marketplace.",
          "If you are hiring employees, use a recruiting product.",
          "If you want a startup partner, use CoFoundry's match, proposal, and agreement workflow.",
        ],
      },
      {
        title: "Why the distinction matters",
        body: "The product only works if users can trust that outreach is coming from people who actually want to build a company together rather than extract leads or sell hours.",
      },
    ],
  },
]

export const contractGuidePages: GuidePage[] = [
  {
    slug: "founder-agreement",
    title: "Founder agreement checklist",
    description: "The right founder agreement starts with decisions about scope, economics, decision rights, and exit paths. CoFoundry turns those into a structured workflow before the document exists.",
    eyebrow: "Contracts & Proposals",
    category: "contracts",
    ctaLabel: "Start with a proposal",
    ctaTo: "/auth/sign-up",
    sections: [
      {
        title: "Decisions that should already be explicit",
        body: "A clean founder agreement usually reflects decisions already made in conversation and a trial sprint, not surprises introduced by the document itself.",
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
    description: "A short working sprint reveals more than a dozen chemistry calls. Use a trial plan to test communication, pace, and ownership before equity terms calcify.",
    eyebrow: "Contracts & Proposals",
    category: "contracts",
    ctaLabel: "See the workflow",
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
        body: "Not just output. It should expose communication quality, judgment, how disagreement gets resolved, and whether the role boundaries still make sense after real work starts.",
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
    description: "Vesting is not punishment. It is a way to make long-term ownership reflect long-term contribution and to protect the company if the partnership breaks early.",
    eyebrow: "Contracts & Proposals",
    category: "contracts",
    ctaLabel: "Review agreement terms",
    ctaTo: "/contracts/founder-agreement",
    sections: [
      {
        title: "Why vesting shows up early",
        body: "Most serious founder conversations reach vesting quickly because it affects trust, incentives, and what happens if one person leaves before the company is real.",
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
        body: "The proposal and agreement workflow forces vesting and cliff choices into the same conversation as role scope, commitment, and IP so the tradeoffs stay connected.",
      },
    ],
  },
  {
    slug: "ip-assignment",
    title: "IP assignment for founder teams",
    description: "Founder teams should understand what work already exists, what might be constrained by employment obligations, and what needs to transfer cleanly into the company.",
    eyebrow: "Contracts & Proposals",
    category: "contracts",
    ctaLabel: "Compare proposal terms",
    ctaTo: "/pricing",
    sections: [
      {
        title: "Questions to answer before drafting",
        body: "IP conversations go badly when the team skips past the messy part: pre-existing assets, side projects, employer restrictions, and ambiguous ownership of early prototypes.",
        bullets: [
          "What already exists before the company is formed.",
          "Whether any current employer or client claim could conflict.",
          "Which net-new work must be assigned into the company.",
        ],
      },
      {
        title: "Why this belongs in the workflow",
        body: "IP readiness is not a legal afterthought. It is a founder-fit question. People who cannot discuss constraints clearly should not be sending clean-looking founder terms yet.",
      },
      {
        title: "What CoFoundry does",
        body: "Profiles ask for IP readiness signals early, proposals preserve the negotiation record, and the agreement template carries the expectation forward into the document draft.",
      },
    ],
  },
]
