export interface LegalSection {
  id: string
  title: string
  summary: string
  paragraphs: string[]
  bullets?: string[]
}

export const termsLastUpdated = "April 11, 2026"

export const termsKeyNotes = [
  {
    title: "Startup team formation only",
    body: "CoFoundry is for founders, co-founders, and startup collaborators. It is not a freelance marketplace, recruiting agency, or generic job board.",
  },
  {
    title: "Structured workflow, not guaranteed outcomes",
    body: "Profiles, matches, messaging, proposals, and agreement templates help users form teams, but CoFoundry does not guarantee intros, funding, company success, or legal enforceability.",
  },
  {
    title: "Paid SaaS, not automatic platform equity",
    body: "Subscriptions unlock workflow and visibility benefits. Paid plans do not give CoFoundry ownership in your company or a right to your cap table.",
  },
  {
    title: "Future investment module is separate",
    body: "If CoFoundry later enables an investment workflow, that feature will be gated behind supplemental terms and distinct product controls.",
  },
]

export const termsSections: LegalSection[] = [
  {
    id: "acceptance",
    title: "1. Acceptance and Eligibility",
    summary: "Using CoFoundry creates a binding agreement and is limited to serious adult users.",
    paragraphs: [
      "By accessing or using CoFoundry's website, application, profiles, messaging, proposal workflow, contract builder, billing pages, or related services, you agree to these Terms of Service and the Privacy Policy.",
      "You must be at least 18 years old, legally able to enter contracts, and not prohibited from using the service under applicable law. If you use CoFoundry on behalf of an organization, you represent that you have authority to bind that organization.",
      "If you do not agree to these Terms, do not use CoFoundry.",
    ],
  },
  {
    id: "service-scope",
    title: "2. What CoFoundry Is",
    summary: "CoFoundry is software for forming startup teams and documenting collaboration terms.",
    paragraphs: [
      "CoFoundry helps founders and startup collaborators create profiles, evaluate fit, express interest, message after a mutual connection, exchange structured proposals, run trial collaboration workflows, and generate editable collaboration agreement templates.",
      "CoFoundry is not a freelance marketplace, staffing firm, employment agency, broker-dealer, funding portal, investment adviser, venture fund, law firm, tax adviser, or fiduciary for user relationships.",
      "The core service is subscription software. Any future investment-related feature is separate from the main SaaS workflow and may be subject to additional eligibility rules, product gates, and supplemental terms.",
    ],
  },
  {
    id: "accounts-profiles",
    title: "3. Accounts, Profiles, and Visibility",
    summary: "Profiles must be accurate, current, and consistent with the trust signals you choose to display.",
    paragraphs: [
      "You are responsible for your account credentials, all activity under your account, and the accuracy of your profile, opportunity listings, uploaded materials, and communications.",
      "You may not impersonate another person, misstate your identity, create misleading trust signals, or present fabricated traction, role ownership, or availability.",
      "CoFoundry includes privacy controls such as public-lite visibility, member-only visibility, and gated contact-reveal rules. If you choose a public setting, profile or startup information may become visible on the public web and may be indexed by search engines or viewed by people outside the product.",
      "Verification badges and trust markers only mean that a specific signal or workflow was completed inside CoFoundry or through a linked account. They are not a guarantee of character, legal compliance, background checks, business quality, or future performance.",
    ],
  },
  {
    id: "acceptable-use",
    title: "4. Acceptable Use and Network Integrity",
    summary: "The platform is designed for serious startup formation, not spam, harvesting, or disguised consulting marketplaces.",
    paragraphs: [
      "You may use CoFoundry only for lawful purposes tied to evaluating or forming startup teams, negotiating startup collaboration terms, or managing a legitimate company-building workflow.",
      "You may not use CoFoundry in ways that degrade trust, create safety risk, or turn the network into a lead-generation channel for unrelated services.",
    ],
    bullets: [
      "impersonating another person or misrepresenting skills, traction, funding, role, or intent",
      "using CoFoundry primarily for freelance work, recruiting employees, agency sales, consulting lead generation, or unrelated commercial solicitation",
      "scraping, harvesting, exporting, or compiling profile data, contact details, messages, or public pages without express permission",
      "sending spam, bulk intros, deceptive links, malware, credential-harvesting attempts, or repeated low-quality outreach",
      "asking users for wire transfers, diligence fees, crypto payments, or off-platform payments through CoFoundry messages",
      "sharing confidential information, personal data, or third-party intellectual property without the right to do so",
      "harassing, threatening, stalking, discriminating against, or abusing other users",
      "circumventing suspensions, rate limits, trust controls, or contact-reveal rules",
    ],
  },
  {
    id: "user-content",
    title: "5. User Content and Licenses",
    summary: "Users keep ownership of their content, but CoFoundry needs operational rights to host and display it.",
    paragraphs: [
      "You retain ownership of the text, files, links, profile data, startup information, proposal inputs, agreement drafts, and other content you submit to CoFoundry.",
      "You grant CoFoundry a non-exclusive, worldwide, royalty-free license to host, store, reproduce, process, display, format, transmit, moderate, and distribute that content only as needed to operate, secure, improve, and support the service.",
      "You represent that you have the rights needed to upload your content and that your content does not violate confidentiality obligations, privacy rights, intellectual property rights, sanctions laws, or other applicable law.",
      "If you send CoFoundry feedback, product ideas, or workflow suggestions, you grant CoFoundry the right to use that feedback without restriction or compensation to you.",
    ],
  },
  {
    id: "interactions",
    title: "6. Matches, Messaging, and User Interactions",
    summary: "CoFoundry facilitates introductions but is not a party to user relationships or off-platform conduct.",
    paragraphs: [
      "CoFoundry may gate messaging behind mutual interest, structured intros, trust-critical completion, or contact-reveal settings. Those controls are part of the product design and may change over time.",
      "CoFoundry is not a party to any conversation, proposal, negotiation, trial sprint, collaboration, incorporation decision, employment relationship, or company agreement between users.",
      "You are responsible for deciding what information to share, when to move a conversation off-platform, whether to run a trial project, and whether another user is credible enough for deeper collaboration.",
      "CoFoundry does not guarantee that another user's identity, funding claims, traction, responsiveness, or intentions are accurate, even if some verification or trust markers are present.",
    ],
  },
  {
    id: "proposals-templates",
    title: "7. Proposals, Templates, and Professional Disclaimers",
    summary: "CoFoundry's proposal and contract tools are workflow infrastructure, not legal or investment advice.",
    paragraphs: [
      "Proposal builders, clause comments, deal-room summaries, and generated agreement templates are informational workflow tools. They help users structure discussions about role scope, time commitment, compensation, equity, vesting, confidentiality, decision rights, and IP assignment.",
      "CoFoundry does not provide legal, tax, accounting, investment, employment, or regulatory advice. Using the proposal or contract workflow does not create an attorney-client, adviser-client, fiduciary, brokerage, or agency relationship with CoFoundry.",
      "Generated documents are editable templates. Their legal effect depends on the facts, jurisdiction, formation documents, signature method, and the final text the parties actually accept.",
      "You are responsible for obtaining qualified professional advice before relying on any proposal, agreement template, or negotiation summary for a real company, financing, employment, or ownership decision.",
    ],
  },
  {
    id: "billing",
    title: "8. Subscriptions, Billing, Cancellation, and Refunds",
    summary: "Paid plans auto-renew unless canceled, and subscription benefits are software features rather than ownership rights.",
    paragraphs: [
      "Some CoFoundry features require a paid subscription. Paid plans may unlock messaging capacity, saved searches, proposal workflow limits, agreement generation, visibility boosts, or other account benefits described at checkout or on the pricing page.",
      "By starting a paid subscription, you authorize CoFoundry and its payment processors to charge the recurring fees, taxes, and other disclosed amounts for your selected plan until you cancel.",
      "Subscriptions renew automatically at the end of each billing period unless you cancel before renewal through the billing settings flow or another method CoFoundry makes available.",
      "Unless CoFoundry states otherwise at the time of purchase, fees are non-refundable, subscription periods are not prorated, and cancellation takes effect at the end of the current paid term. Nothing in a subscription gives CoFoundry automatic equity, ownership, or governance rights in your venture.",
      "CoFoundry may suspend or downgrade paid features for failed payments, chargebacks, fraud concerns, or billing disputes.",
    ],
  },
  {
    id: "trust-safety",
    title: "9. Trust, Safety, Moderation, and Enforcement",
    summary: "CoFoundry may investigate reports, preserve evidence, and take action to protect the network.",
    paragraphs: [
      "CoFoundry may review profiles, opportunities, messages, attachments, proposals, contracts, and reports to enforce these Terms, investigate suspected abuse, respond to legal obligations, or protect users and the platform.",
      "CoFoundry may remove content, limit visibility, reduce messaging privileges, require additional verification, suspend accounts, terminate access, or preserve evidence when it reasonably believes such action is necessary for trust and safety, fraud prevention, policy enforcement, legal compliance, or product integrity.",
      "CoFoundry does not promise to monitor every interaction or act on every report within a specific time frame, but it may escalate high-risk categories such as impersonation, scam behavior, privacy violations, and data harvesting.",
      "If you believe an enforcement action was incorrect, you may request review through CoFoundry's support channels. CoFoundry may decide whether and how to offer an appeal or reinstatement.",
    ],
  },
  {
    id: "investment-module",
    title: "10. Future Investment Module and Supplemental Terms",
    summary: "Investment-related features, if ever enabled, are separate from the core matching product.",
    paragraphs: [
      "The current core CoFoundry product is a founder-and-collaborator SaaS workflow. The future investment module is feature-flagged, disabled by default, and not part of the primary user experience unless CoFoundry expressly enables it.",
      "If CoFoundry later offers investment-related workflows, those features may require additional eligibility checks, disclosures, approvals, regulated partners, or supplemental terms. CoFoundry may refuse access to those features at its sole discretion.",
      "Nothing in these core Terms means CoFoundry is effecting securities transactions, soliciting investments, providing investment advice, guaranteeing financing, or acting as your broker, funding portal, or placement agent.",
    ],
  },
  {
    id: "third-party",
    title: "11. Third-Party Services and Linked Accounts",
    summary: "External providers may power parts of the product, and outside links remain your own responsibility.",
    paragraphs: [
      "CoFoundry may rely on third-party services for authentication, hosting, storage, payments, messaging infrastructure, analytics, or linked-account verification. Your use of those services may also be subject to their own terms and privacy policies.",
      "If you connect external accounts, add external links, or click through to third-party sites, CoFoundry is not responsible for those services, their availability, their content, or how they handle your data.",
      "CoFoundry may change providers, integrations, verification methods, or linked-account requirements without creating an obligation to maintain any specific third-party connection.",
    ],
  },
  {
    id: "termination",
    title: "12. Suspension, Termination, and Survival",
    summary: "Users can stop using the service, and CoFoundry may end access when risk or policy violations justify it.",
    paragraphs: [
      "You may stop using CoFoundry at any time. Canceling a paid subscription or closing your account does not automatically delete all records immediately if CoFoundry needs to retain data for safety, billing, legal compliance, dispute resolution, or legitimate business purposes.",
      "CoFoundry may suspend or terminate your access immediately if you violate these Terms, create safety risk, abuse the network, fail to pay required fees, attempt to bypass controls, or expose CoFoundry or other users to legal or operational harm.",
      "Sections that by their nature should survive termination, including payment obligations, intellectual property provisions, disclaimers, liability limits, dispute resolution, and enforcement rights, will survive.",
    ],
  },
  {
    id: "disclaimers",
    title: "13. Disclaimers and No Guarantees",
    summary: "The platform is provided as-is and cannot guarantee business or relationship outcomes.",
    paragraphs: [
      "CoFoundry is provided on an \"as is\" and \"as available\" basis to the fullest extent permitted by law. CoFoundry disclaims all warranties, whether express, implied, statutory, or otherwise, including implied warranties of merchantability, fitness for a particular purpose, title, non-infringement, quiet enjoyment, and uninterrupted availability.",
      "CoFoundry does not guarantee introductions, response rates, profile visibility, platform uptime, company formation, successful partnerships, retained collaborators, fundraising, incorporation, or any business outcome.",
      "CoFoundry does not guarantee that users are who they claim to be, that their traction claims are accurate, that their legal documents are sufficient, or that negotiations will remain confidential once you choose to share sensitive information.",
    ],
  },
  {
    id: "liability",
    title: "14. Limitation of Liability",
    summary: "CoFoundry limits its exposure because user decisions on the platform can have outsized business consequences.",
    paragraphs: [
      "To the fullest extent permitted by law, CoFoundry and its affiliates, officers, employees, contractors, and service providers will not be liable for indirect, incidental, consequential, special, exemplary, or punitive damages, or for lost profits, lost revenue, lost business opportunities, loss of goodwill, loss of data, or the cost of substitute services.",
      "To the fullest extent permitted by law, CoFoundry's aggregate liability for any claim arising out of or relating to the service will not exceed the greater of one hundred U.S. dollars (USD $100) or the total amount you paid CoFoundry for the service during the twelve months before the event giving rise to the claim.",
      "These limits apply even if CoFoundry knew or should have known that damages were possible, and even if a limited remedy fails of its essential purpose. Some jurisdictions do not allow certain limitations, so portions of this section may not apply to you.",
    ],
  },
  {
    id: "indemnity",
    title: "15. Indemnification",
    summary: "Users bear responsibility for claims caused by their content, misconduct, or misuse of the network.",
    paragraphs: [
      "You will defend, indemnify, and hold harmless CoFoundry and its affiliates, officers, employees, contractors, and service providers from and against claims, losses, liabilities, damages, judgments, fines, penalties, and costs, including reasonable attorneys' fees, arising out of or relating to your content, your use of the service, your dealings with other users, your violation of these Terms, or your violation of law or third-party rights.",
    ],
  },
  {
    id: "disputes",
    title: "16. Dispute Resolution, Governing Law, and Class Waiver",
    summary: "Most disputes should be handled individually and, unless law requires otherwise, through arbitration after an informal resolution attempt.",
    paragraphs: [
      "Before filing a formal claim, you and CoFoundry agree to try to resolve the dispute informally by giving written notice and a short opportunity to discuss the issue in good faith.",
      "Except for claims that may be brought in small claims court, claims seeking injunctive relief for intellectual property misuse, or claims that applicable law says cannot be arbitrated, disputes arising out of or relating to these Terms or the service will be resolved by binding individual arbitration in the United States under the rules of the American Arbitration Association applicable to the claim.",
      "You and CoFoundry agree to bring claims only on an individual basis and not as a plaintiff or class member in any class, consolidated, representative, or private attorney general proceeding, except where applicable law makes that waiver unenforceable.",
      "If a dispute relates to sexual assault or sexual harassment and applicable law gives a claimant the right to elect court rather than a predispute arbitration clause, that claimant may choose to bring the claim in court.",
      "Unless a separate order form or public company notice states otherwise, these Terms are governed by the laws of the State of Delaware, USA, without regard to conflict-of-law rules, and the Federal Arbitration Act governs the interpretation and enforcement of this arbitration section.",
    ],
  },
  {
    id: "ip-notices",
    title: "17. Intellectual Property Complaints and Repeat Infringers",
    summary: "Rights holders can report infringing material, and repeat abuse can lead to removal or termination.",
    paragraphs: [
      "If you believe content on CoFoundry infringes your copyright, trademark, privacy, or other intellectual property rights, send a detailed notice to CoFoundry's support contact with enough information for CoFoundry to review the claim.",
      "CoFoundry may remove or disable access to allegedly infringing content, request more information, notify the affected user, or terminate repeat offenders when appropriate.",
    ],
  },
  {
    id: "changes",
    title: "18. Changes to the Service or These Terms",
    summary: "CoFoundry may evolve the product and update these Terms as the platform matures.",
    paragraphs: [
      "CoFoundry may change, suspend, or discontinue features, plan limits, verification methods, integrations, trust controls, or workflow requirements at any time.",
      "CoFoundry may update these Terms from time to time. If CoFoundry makes a material change, it may provide notice through the website, the application, email, or another reasonable method. Your continued use of the service after the updated Terms become effective means you accept the revised Terms.",
    ],
  },
]
