export interface LegalSection {
  id: string
  title: string
  summary: string
  paragraphs: string[]
  bullets?: string[]
}

export interface PrivacyVisibilityTier {
  title: string
  audience: string
  details: string
  notes: string
}

export interface PrivacyDataCategory {
  category: string
  examples: string
  purposes: string
  visibility: string
}

export interface PrivacyRetentionRow {
  category: string
  window: string
  notes: string
}

export const termsLastUpdated = "August 8, 2026"

export const termsKeyNotes = [
  {
    title: "Built for founders and early collaborators",
    body: "CoFoundry is for founders, co-founders, and startup collaborators working toward real company formation.",
  },
  {
    title: "Tools, not guarantees",
    body: "Profiles, matches, messaging, proposals, and agreement templates help users form teams, but CoFoundry does not guarantee intros, funding, company success, or legal enforceability.",
  },
  {
    title: "Legal review stays user-directed",
    body: "Members may invite their own in-house or outside legal representative to a specific agreement version. CoFoundry transmits the document and response but does not select, retain, supervise, endorse, or verify counsel.",
  },
  {
    title: "Team workspaces are role-controlled",
    body: "Organization owners control seats and roles. Members should only add people who are authorized to access the organization's ventures, projects, policies, approvals, and linked collaboration records.",
  },
  {
    title: "Paid SaaS, not automatic platform equity",
    body: "Subscriptions unlock product and visibility benefits. Paid plans do not give CoFoundry ownership in your company or a right to your cap table.",
  },
  {
    title: "Optional investment workspace is separate",
    body: "When enabled, fundraising planning and program review remain behind a separate feature gate, supplemental terms, explicit sharing choices, and isolated staff permissions.",
  },
]

export const termsSections: LegalSection[] = [
  {
    id: "acceptance",
    title: "1. Acceptance and Eligibility",
    summary: "Using CoFoundry creates a binding agreement and is limited to adult users.",
    paragraphs: [
      "By accessing or using CoFoundry's website, application, profiles, messaging, proposals, contract builder, billing pages, or related services, you agree to these Terms of Service and the Privacy Policy.",
      "You must be at least 18 years old, legally able to enter contracts, and not prohibited from using the service under applicable law. If you use CoFoundry on behalf of an organization, you represent that you have authority to bind that organization.",
      "If you do not agree to these Terms, do not use CoFoundry.",
    ],
  },
  {
    id: "service-scope",
    title: "2. What CoFoundry Is",
    summary: "CoFoundry is software for forming startup teams and documenting collaboration terms.",
    paragraphs: [
      "CoFoundry helps founders and startup collaborators create profiles, evaluate fit, express interest, message after a mutual connection, exchange structured proposals, run trial collaboration steps, generate editable collaboration agreement templates, and coordinate approved work through role-controlled Team and Studio workspaces.",
      "CoFoundry is not a freelance marketplace, staffing firm, employment agency, broker-dealer, funding portal, investment adviser, venture fund, law firm, tax adviser, or fiduciary for user relationships.",
      "The core service is subscription software. The optional investment workspace is separate from the main SaaS product and is subject to an independent feature gate, supplemental terms, review permissions, and partner-sharing controls.",
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
      "Verification badges and trust markers only mean that a specific signal or step was completed inside CoFoundry or through a linked account. They are not a guarantee of character, legal compliance, background checks, business quality, or future performance.",
      "Organization owners are responsible for inviting only authorized people, assigning suitable owner, operator, member, reviewer, billing, and counsel roles, keeping those roles current, and transferring ownership before the original owner leaves. A workspace role is a software permission and does not establish employment, agency, fiduciary authority, professional licensure, or authority to bind a company.",
    ],
  },
  {
    id: "acceptable-use",
    title: "4. Acceptable Use and Network Integrity",
    summary: "The platform is designed for startup formation, not spam, harvesting, or disguised consulting marketplaces.",
    paragraphs: [
      "You may use CoFoundry only for lawful purposes tied to evaluating or forming startup teams, negotiating startup collaboration terms, or managing a legitimate company-building search and negotiation process.",
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
      "If you send CoFoundry feedback or product ideas, you grant CoFoundry the right to use that feedback without restriction or compensation to you.",
    ],
  },
  {
    id: "interactions",
    title: "6. Matches, Messaging, and User Interactions",
    summary: "CoFoundry facilitates introductions but is not a party to user relationships or off-platform conduct.",
    paragraphs: [
      "CoFoundry may gate messaging behind mutual interest, structured intros, profile completion, or contact-reveal settings. Those controls are part of the product design and may change over time.",
      "CoFoundry is not a party to any conversation, proposal, negotiation, trial sprint, collaboration, incorporation decision, employment relationship, or company agreement between users.",
      "You are responsible for deciding what information to share, when to move a conversation off-platform, whether to run a trial project, and whether another user is credible enough for deeper collaboration.",
      "When a relationship, proposal, agreement, opportunity, or investment application is linked to an organization workspace, authorized organization members may be able to view its workspace label, apply internal policies, request or resolve approvals, and review related audit history according to their role. You must have authority to make that link and share the related information.",
      "CoFoundry does not guarantee that another user's identity, funding claims, traction, responsiveness, or intentions are accurate, even if some verification or trust markers are present.",
    ],
  },
  {
    id: "proposals-templates",
    title: "7. Proposals, Templates, and Professional Disclaimers",
    summary: "CoFoundry's proposal and contract tools help structure discussions, but they are not legal or investment advice.",
    paragraphs: [
      "Proposal builders, clause comments, deal-room summaries, and generated agreement templates are informational product tools. They help users structure discussions about role scope, time commitment, compensation, equity, vesting, confidentiality, decision rights, and IP assignment.",
      "CoFoundry does not provide legal, tax, accounting, investment, employment, or regulatory advice. Using the proposal or contract tools does not create an attorney-client, adviser-client, fiduciary, brokerage, or agency relationship with CoFoundry.",
      "Generated documents are editable templates. Their legal effect depends on the facts, jurisdiction, formation documents, signature method, and the final text the parties actually accept.",
      "If you invite an in-house or outside legal representative, you represent that you are authorized to share the selected agreement version, review scope, and context with that person. The invite is a confidential bearer link that may be revoked by either agreement participant and expires automatically.",
      "CoFoundry only transmits the selected material and records the invited reviewer's response. CoFoundry does not select, vet, verify, retain, supervise, endorse, or pay the reviewer, and a typed responder name is not proof of identity, licensure, authority, engagement, or an electronic signature. Any attorney-client relationship, conflicts check, engagement terms, fees, or professional duties exist separately between the reviewer and the applicable parties.",
      "You are responsible for obtaining qualified professional advice before relying on any proposal, agreement template, or negotiation summary for a real company, financing, employment, or ownership decision.",
      "Organization agreement policies, approval states, clause requirements, signing holds, and audit events are coordination controls only. They do not establish that a document is complete, lawful, authorized under your formation documents, or approved by a qualified professional.",
    ],
  },
  {
    id: "billing",
    title: "8. Subscriptions, Billing, Cancellation, and Refunds",
    summary: "Paid plans auto-renew unless canceled, and subscription benefits are software features rather than ownership rights.",
    paragraphs: [
      "Some CoFoundry features require a paid subscription. Paid plans may unlock messaging capacity, saved searches, proposal and agreement limits, visibility boosts, or other account benefits described at checkout or on the pricing page.",
      "By starting a paid subscription, you authorize CoFoundry and its payment processors to charge the recurring fees, taxes, and other disclosed amounts for your selected plan until you cancel.",
      "Subscriptions renew automatically at the end of each billing period unless you cancel before renewal through the billing settings flow or another method CoFoundry makes available.",
      "Unless CoFoundry states otherwise at the time of purchase, fees are non-refundable, subscription periods are not prorated, and cancellation takes effect at the end of the current paid term. Nothing in a subscription gives CoFoundry automatic equity, ownership, or governance rights in your venture.",
      "CoFoundry may suspend or downgrade paid features for failed payments, chargebacks, fraud concerns, or billing disputes.",
      "A Team workspace may be sponsored by the subscription assigned to its billing owner. Seat limits and workspace operations may be restricted if that subscription expires, is canceled, or no longer includes the applicable Team features, without deleting already retained organization records solely because access is restricted.",
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
    title: "10. Optional Investment Workspace and Supplemental Terms",
    summary: "Fundraising planning and program review remain separate from matching, subscriptions, and any securities transaction.",
    paragraphs: [
      "The core CoFoundry product is founder-and-collaborator SaaS. The optional investment workspace is feature-flagged, disabled by default, and available only when CoFoundry deliberately enables the separately governed workflow.",
      "Applicants may record readiness, fundraising rounds, data-room materials, and investor contacts they already know or independently identify. CoFoundry does not discover, rank, recommend, endorse, or contact investor prospects for applicants, and applicant prospect and interaction records are excluded from program-staff views.",
      "A program application requires the current supplemental terms and applicant attestations. Submission captures a revision-bound snapshot of the application, readiness checklist, and round plan. Later draft or planning changes remain outside that submitted snapshot unless the applicant submits a new revision. Self-attested formation, capitalization, financial, traction, identity, authority, or readiness information is not CoFoundry verification and may be tested through additional diligence or an outside provider.",
      "Submission, review, committee advancement, acceptance, or referral means only the workflow status shown. None guarantees financing, commits CoFoundry or another person to invest, constitutes an offer or recommendation, or confirms that an offering complies with law.",
      "CoFoundry does not handle investor funds or securities, execute securities transactions, provide investment advice, act as a broker-dealer, funding portal, placement agent, or investment adviser, or receive transaction-based compensation through this workspace. Any offering or transaction must occur outside CoFoundry with qualified counsel and a registered intermediary when required.",
      "A regulated-partner handoff requires separate applicant consent and may include only data-room records the applicant explicitly shared with the program. The identified partner applies its own onboarding, engagement, conflicts, diligence, eligibility, disclosure, and regulatory controls, and may independently decline to proceed.",
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
      "CoFoundry may change, suspend, or discontinue features, plan limits, verification methods, integrations, trust controls, or feature requirements at any time.",
      "CoFoundry may update these Terms from time to time. If CoFoundry makes a material change, it may provide notice through the website, the application, email, or another reasonable method. Your continued use of the service after the updated Terms become effective means you accept the revised Terms.",
    ],
  },
]

export const privacyLastUpdated = "August 8, 2026"

export const privacyKeyNotes = [
  {
    title: "Visibility is a product feature",
    body: "CoFoundry uses public-lite, member-only, and mutual-connection visibility states. What you publish publicly can be indexed or copied outside the platform.",
  },
  {
    title: "Direct contact stays gated",
    body: "Email addresses, direct contact details, messages, proposal drafts, agreement drafts, and legal-review records are not shown on public pages. A member may deliberately share one agreement version with a named legal representative through a confidential, expiring link.",
  },
  {
    title: "Current tracking posture is restrained",
    body: "CoFoundry currently relies on essential session storage, first-party product state, and a first-party analytics script hosted at analytics.cofoundry.jacobdanderson.net. It does not use third-party ad pixels or cross-context behavioral advertising in the current configuration.",
  },
  {
    title: "Live vendors are conditional",
    body: "Some environments rely on CoFoundry-hosted internal services. When live vendors such as Supabase or Stripe are enabled, they process data only for the product functions described in this policy.",
  },
  {
    title: "Investment sharing is explicit",
    body: "Applicant prospect and interaction records stay outside program-staff views. Reviewers receive a submitted application and only the data-room records or updates the applicant marks for program sharing.",
  },
]

export const privacyVisibilityTiers: PrivacyVisibilityTier[] = [
  {
    title: "Public web",
    audience: "Visible to anyone, including search engines",
    details: "Public-lite profiles, selected startup listings, display name, photo, headline, broad location, bio, selected roles, selected skills, public links, and public trust signals may appear on public pages when a member chooses public visibility.",
    notes: "Once information is public, third parties may cache, scrape, or republish it outside CoFoundry's control.",
  },
  {
    title: "Signed-in members",
    audience: "Visible inside the product to authenticated users",
    details: "Member-only profile details, deeper fit signals, time commitment, startup preferences, structured intro context, and certain trust-readiness details may be visible only to logged-in members depending on the profile owner's settings.",
    notes: "This tier is meant for founder matching, not public indexing.",
  },
  {
    title: "Mutual connections",
    audience: "Visible to the relationship participants and people they expressly invite",
    details: "Messaging history, shared attachments, proposal versions, agreement drafts, signature events, and direct contact details CoFoundry reveals are limited to the parties involved, authorized admins supporting the relationship, and a named legal representative invited to a specific agreement version.",
    notes: "Counterparties and invited representatives may retain copies of information they already received even if you later revoke a link or close your account.",
  },
  {
    title: "Organization workspaces",
    audience: "Visible to active organization members according to assigned role",
    details: "Organization identity, membership, ventures, projects, tasks, decisions, shared searches, linked resources, agreement policies, approval requests, counsel queues, and audit history are projected according to owner, operator, member, reviewer, billing, or counsel permissions.",
    notes: "Organization owners control membership and role assignments. Removing a member ends their in-product access but cannot recall copies they previously received or information they exported lawfully.",
  },
  {
    title: "Applicant fundraising workspace",
    audience: "Visible to the applicant, with limited linked-record visibility for authorized organization members",
    details: "Readiness, rounds, applicant-created investor prospects, interactions, private data-room records, application drafts, and founder updates remain in the applicant workspace. Investor prospects and interactions are never projected to program staff.",
    notes: "Linking an application to a Team or Studio permits authorized internal approvals and linked-record visibility but does not expose the applicant's private outreach pipeline.",
  },
  {
    title: "Investment program review",
    audience: "Visible only to assigned or authorized investment-review staff",
    details: "Review staff can receive the revision-bound application, readiness, and round snapshot submitted by the applicant, applicant-shared data-room records and updates, information and diligence responses, and program workflow state. Staff-only notes, risk flags, internal rationale, and partner-preparation notes are excluded from applicant responses and account exports.",
    notes: "A third-party handoff requires separate applicant consent and is limited to the selected records. A recipient may retain information already sent even if future sharing consent is later withdrawn.",
  },
  {
    title: "Internal operations",
    audience: "Visible only to CoFoundry admins or service providers with a need to know",
    details: "Authentication logs, device and session signals, billing metadata, abuse reports, moderation notes, support records, and security investigations are kept internal unless disclosure is required by law or necessary to protect users or the service.",
    notes: "These records are used for trust, safety, billing support, and platform integrity rather than public networking.",
  },
]

export const privacyDataCategories: PrivacyDataCategory[] = [
  {
    category: "Account and security data",
    examples: "Email address, account ID, login state, session cookie, password or reset events, IP and device signals.",
    purposes: "Authentication, fraud prevention, account recovery, and platform security.",
    visibility: "Internal only, except limited account data shown to the signed-in member.",
  },
  {
    category: "Profile and onboarding data",
    examples: "Name, photo URL, headline, bio, location, roles, skills, industries, stage preferences, values, work style, availability, equity expectations, and linked profiles.",
    purposes: "Discovery, matching, trust signaling, profile rendering, and public directory pages when enabled by the member.",
    visibility: "Public, member-only, or private depending on the member's settings and the field involved.",
  },
  {
    category: "Discovery and interaction data",
    examples: "Search filters, saved searches, bookmarks, structured intros, connect requests, match state, and profile activity signals.",
    purposes: "Ranking results, measuring reciprocity, managing intros, and helping members resume the pipeline.",
    visibility: "Mostly internal or visible only to the participants involved in the interaction.",
  },
  {
    category: "Messages, proposals, and contract data",
    examples: "Messages, attachments, clause comments, proposal versions, negotiation notes, agreement drafts, legal-review contact details and responses, typed-name signatures, and timeline events.",
    purposes: "Running the deal room, creating editable documents, coordinating user-selected legal review, preserving negotiation history, and supporting disputes or trust-and-safety reviews.",
    visibility: "Visible to the relevant participants, a legal representative invited to the selected agreement version, and authorized admins when operational or safety review is required.",
  },
  {
    category: "Organization, project, and governance data",
    examples: "Organization identity, invitations, seats and roles, ventures, projects, tasks, decisions, shared searches, linked resources, agreement policies, approval requests, counsel queue entries, and organization audit events.",
    purposes: "Operating Team and Studio workspaces, coordinating portfolio work, enforcing internal agreement controls, routing review, preserving accountability, and supporting organization billing and security.",
    visibility: "Visible to active organization members according to assigned role, invited members for their own pending invitation, selected legal representatives for an exact agreement review, and authorized admins when operational or safety review is required.",
  },
  {
    category: "Fundraising, application, and diligence data",
    examples: "Readiness attestations, round plans, applicant-created prospects and interactions, data-room links and uploads, program applications, supplemental-term acceptance, information requests, diligence responses, founder updates, staff review notes, decisions, and regulated-partner handoffs.",
    purposes: "Applicant fundraising planning, separately governed program review, diligence, consent records, internal decision controls, secure file delivery, and approved regulated-partner preparation.",
    visibility: "Prospects, interactions, later application drafts, later private planning changes, and unshared records remain applicant-only. Review staff receive the application, readiness, and round snapshot for that revision plus explicitly shared records. Staff-only notes and internal rationale remain internal. Identified third parties receive only records covered by a consented handoff.",
  },
  {
    category: "Billing and subscription data",
    examples: "Plan tier, billing status, checkout events, invoice references, payment processor responses, and tax-related metadata when applicable.",
    purposes: "Charging for paid plans, preventing fraud, resolving billing issues, and keeping accounting records.",
    visibility: "Internal only, except plan status shown to the account owner.",
  },
  {
    category: "Support, moderation, and admin records",
    examples: "Reports, evidence uploads, moderation notes, appeal requests, support tickets, internal audit trails, and enforcement history.",
    purposes: "Investigations, abuse prevention, policy enforcement, legal compliance, and service improvement.",
    visibility: "Internal only, except for limited status notices shown to affected members.",
  },
]

export const privacyRetentionRows: PrivacyRetentionRow[] = [
  {
    category: "Active account and profile records",
    window: "While the account is active, then generally up to 24 months after closure",
    notes: "Used for reactivation, dispute handling, trust and safety, and legal compliance unless a shorter or longer period is required.",
  },
  {
    category: "Messages, proposals, and contract drafts",
    window: "While the relationship is active, then generally up to 36 months after the last proposal or contract activity",
    notes: "Includes legal-review requests and responses. These records let counterparties preserve shared negotiation history and let CoFoundry investigate reports tied to a collaboration.",
  },
  {
    category: "Organization workspace and audit records",
    window: "While the organization is active, then generally up to 36 months after archival; visible audit history also follows the owner-configured workspace window",
    notes: "Workspace settings may shorten the ordinary audit-history view but do not override legal holds, billing, security, dispute, or compliance retention. Other organization records may remain available while needed to operate the workspace and preserve shared decisions.",
  },
  {
    category: "Fundraising and investment-review records",
    window: "While the workspace or review is active, then generally up to 5 years after closure or the last review or partner-handoff activity",
    notes: "Private applicant outreach records, submitted materials, consent history, diligence, decisions, and staff audit records may have different visibility but follow the same ordinary retention window. Legal holds, securities or intermediary obligations, disputes, fraud review, or a recipient's independent duties may require longer retention.",
  },
  {
    category: "Security logs and session signals",
    window: "Generally up to 12 months",
    notes: "Kept for fraud prevention, access troubleshooting, and incident response unless a live investigation requires longer retention.",
  },
  {
    category: "Trust and safety reports",
    window: "Generally up to 5 years after the last related enforcement action",
    notes: "Longer retention may be necessary for repeat-offender review, legal claims, or coordinated abuse investigations.",
  },
  {
    category: "Billing and accounting records",
    window: "Generally 7 years or longer if required by law",
    notes: "Financial records are retained longer than ordinary product data because of accounting, tax, chargeback, and audit obligations.",
  },
]

export const privacySections: LegalSection[] = [
  {
    id: "scope-contact",
    title: "1. Scope and Who This Policy Covers",
    summary: "This policy covers CoFoundry's public website, application, founder-matching features, and Team and Studio workspaces.",
    paragraphs: [
      "This Privacy Policy explains how CoFoundry collects, uses, stores, shares, and protects information when you visit the marketing site, create an account, build a profile, search for collaborators, message other members, exchange proposals, generate agreement templates, invite a legal representative, operate a Team or Studio workspace, manage a subscription, contact support, or interact with the trust-and-safety process.",
      "It applies to both public pages and authenticated product pages. It also applies when CoFoundry processes information through service providers or through its internal service layer in environments where live third-party services are not enabled.",
      "For privacy questions, rights requests, or trust-and-safety escalation, use CoFoundry's support contact listed on this page.",
    ],
  },
  {
    id: "visibility-controls",
    title: "2. Visibility Controls and Public Profile Exposure",
    summary: "CoFoundry's privacy model depends heavily on what you choose to make public, member-only, or fully private.",
    paragraphs: [
      "CoFoundry is a discovery platform, so some profile and startup information may be deliberately visible to other people. Members can choose public-lite, member-only, or private settings for key profile surfaces, and some startup opportunities can also be published publicly.",
      "When you select a public setting, information such as your display name, headline, photo, broad location, role context, startup interests, public links, or startup listing details may appear on public directory pages and may be indexed by search engines.",
      "CoFoundry keeps direct contact information gated. Email addresses, messages, proposal drafts, agreement data, and similar collaboration materials are not intended for public display and are only revealed according to connection state, product permissions, a participant's deliberate legal-review invite, and admin review rules.",
      "Organization workspace information is not public by default. Active members receive a role-scoped view, pending invitees receive only their own invitation, and reviewer or counsel roles receive the organization and review information needed for their assigned work rather than unrestricted access to unrelated private account data.",
      "Because public content can be copied by search engines, aggregators, or other users, changing a visibility setting later may not remove every historical copy that exists outside CoFoundry.",
    ],
  },
  {
    id: "information-collected",
    title: "3. Information We Collect",
    summary: "We collect account, profile, collaboration, billing, and safety data needed to operate the network.",
    paragraphs: [
      "CoFoundry collects information you provide directly, including account credentials, profile details, startup opportunity listings, values and work-style inputs, links to external profiles, messages, proposals, agreement-template inputs, legal-review contact details and context, organization membership and governance records, projects and tasks, support requests, and report submissions.",
      "We also collect information generated by your use of the product, including search filters, bookmarks, saved searches, connect requests, matches, collaboration events, subscription activity, and trust-signal completion events.",
      "Certain technical and security data are collected automatically, such as session state, device and browser metadata, IP-based security signals, and logs tied to authentication, rate limiting, or abuse detection.",
      "CoFoundry may also receive limited information from third-party providers when enabled, such as payment status from Stripe-backed billing, authentication state from live identity providers, or storage and database metadata from a Supabase-backed environment.",
    ],
  },
  {
    id: "how-we-use-data",
    title: "4. How We Use Information",
    summary: "We use personal information to operate the service, rank relevant results, protect the network, and support billing.",
    paragraphs: [
      "CoFoundry uses information to create and maintain accounts, render profiles, power search and discovery, recommend relevant people or opportunities, manage structured intros, enable messaging after a mutual connection, support proposals and agreements, operate role-controlled Team and Studio workspaces, route internal approvals, and deliver version-bound legal-review invitations requested by members.",
      "We also use information for trust and safety, including fraud detection, scam prevention, moderation, support, debugging, enforcing the Terms of Service, and protecting members from spam, impersonation, harassment, and data harvesting.",
      "Subscription and billing information is used to determine plan access, process checkout events, prevent chargeback abuse, and maintain accounting records.",
      "CoFoundry may also use aggregated or de-identified product data to understand usage patterns, improve ranking quality, refine onboarding, and operate internal analytics for the service.",
    ],
  },
  {
    id: "matching-ranking",
    title: "5. Matching, Ranking, and Recommendations",
    summary: "CoFoundry uses declared preferences and product signals to rank discovery results and recommendations.",
    paragraphs: [
      "The product uses the information members provide, including roles, industries, startup-stage preferences, compensation preferences, time commitment, availability, values, work-style preferences, reciprocity signals, trust-readiness signals, and explicit search filters, to rank profiles and startup opportunities.",
      "Those rankings are meant to improve relevance, response likelihood, and network quality. They are not credit decisions, employment decisions, or guarantees that a person or startup is legitimate, safe, or suitable for partnership.",
      "Members can influence matching outcomes by updating profile information, adjusting visibility settings, changing stated preferences, and using filters directly. CoFoundry does not currently use third-party advertising profiles to shape in-product recommendations.",
    ],
  },
  {
    id: "sharing",
    title: "6. How We Share Information",
    summary: "We share information with other members, service providers, and authorities only as needed for the service or legal obligations.",
    paragraphs: [
      "CoFoundry shares information with other members according to profile visibility settings, startup listing settings, mutual-connection state, and product permissions. That includes profile content, intros, messages, proposals, agreement drafts, and signatures when the relevant step calls for it.",
      "When a participant requests legal review, CoFoundry shares the selected agreement version, requested review scope, requester context, and reviewer-facing product notice with the named representative through an expiring bearer link. The parties receive the reviewer's recorded outcome and response. CoFoundry does not share the requester's account email as part of that handoff.",
      "When an authorized member adds or links information to an organization workspace, CoFoundry shares the applicable organization record with other active members according to their assigned roles. Invitation emails disclose the organization name and proposed role to the invited address. CoFoundry does not make an organization's private workspace public merely because the organization has a public website or opportunity listing.",
      "We share information with service providers that help us operate the product, such as infrastructure, storage, authentication, billing, email delivery, and security vendors. In some environments, equivalent functionality may be handled by CoFoundry's internal service layer instead of live third-party processors.",
      "We may disclose information to comply with law, respond to lawful requests, protect the rights or safety of members, investigate fraud or abuse, or support a merger, acquisition, financing, or similar business transaction.",
      "CoFoundry's current configuration does not use third-party advertising pixels or cross-context behavioral advertising, and CoFoundry does not currently sell or share personal information for that purpose. If that changes, CoFoundry will update this policy and any required opt-out controls before rollout.",
    ],
  },
  {
    id: "tracking-storage",
    title: "7. Cookies, Local Storage, and Device Signals",
    summary: "Current tracking is limited to essential session and product-state technologies.",
    paragraphs: [
      "CoFoundry currently uses essential technologies such as cookies and local storage to keep members signed in, preserve workspace state, remember product preferences, and maintain secure session handling.",
      "These technologies include the session cookie used for authentication and first-party browser storage used to preserve product state, product preferences, and local interaction continuity.",
      "CoFoundry also deploys a first-party analytics script from analytics.cofoundry.jacobdanderson.net on deployed versions of the product to understand service usage and performance. That service may receive pageview and technical request metadata, but it is not used for third-party advertising or cross-context behavioral profiling.",
      "CoFoundry does not currently deploy third-party ad pixels, cross-site behavioral advertising tags, or similar tracking technologies in the present product configuration. If additional non-essential analytics or marketing cookies are introduced later, CoFoundry will update this policy and add any required notices or consent controls before using them.",
      "Because CoFoundry does not currently use cross-site behavioral advertising in this configuration, it does not presently offer a separate advertising opt-out flow. If that changes, CoFoundry will implement the required controls for the jurisdictions in which those features are offered.",
    ],
  },
  {
    id: "email-notifications",
    title: "8. Email, Product Notices, and Communication Preferences",
    summary: "Some messages are required for the service, while marketing communication remains optional.",
    paragraphs: [
      "CoFoundry may send service-related emails or in-product notices for account verification, security events, password resets, connect requests, match status, proposal updates, agreement signatures, legal-review invitations and responses, billing events, moderation actions, and similar operational communications.",
      "Members can manage optional relationship workflow emails and scheduled workspace digest emails from account settings. Those controls apply to product workflow reminders such as intros, unread messages, proposals, and signature requests, not to service-critical billing, safety, security, legal, or support notices.",
      "CoFoundry may also send product updates, launch announcements, or other marketing communications where permitted. You can opt out of non-essential marketing messages, but you may still receive service-critical communications tied to your account, subscription, or safety status.",
      "If members use direct links or contact details obtained through CoFoundry to continue a discussion off-platform, those later communications are governed by the tools and policies of the channels they choose to use.",
    ],
  },
  {
    id: "retention-deletion",
    title: "9. Retention and Deletion",
    summary: "Different categories of data stay around for different reasons, and deletion is not absolute across every collaboration record.",
    paragraphs: [
      "CoFoundry retains information for as long as necessary to operate the service, preserve collaboration history, enforce the Terms, handle trust-and-safety reports, meet legal obligations, and protect against fraud or abuse.",
      "Account closure or deletion requests do not always erase every record immediately. Other members and legal representatives they invited may still retain copies of messages, proposal drafts, agreement materials, or review responses they previously received, and CoFoundry may keep limited records for billing, security, legal compliance, or repeat-offender review.",
      "Organization owners may configure the ordinary audit-history window and archive a workspace, but those controls do not unilaterally delete records shared with other members or override legal, billing, security, dispute, or compliance retention. Members should ask their organization owner to correct workspace-controlled records and may also contact CoFoundry for privacy support.",
      "CoFoundry generally follows the retention windows summarized on this page, but may retain information for a shorter or longer period where a live investigation, legal hold, tax requirement, or dispute makes that necessary.",
    ],
  },
  {
    id: "security-moderation",
    title: "10. Security, Moderation, and Investigations",
    summary: "Admins and service providers may access protected data when the platform or another member needs protection.",
    paragraphs: [
      "CoFoundry uses technical and organizational safeguards designed to protect account data, collaboration history, and payment-related metadata, including access controls, scoped service-provider access, and server-side handling for secret-backed integrations when enabled.",
      "No internet service is perfectly secure, and CoFoundry cannot guarantee absolute security. Members should still use strong passwords, protect their devices, and avoid oversharing sensitive data before they have enough trust in another party.",
      "Authorized admins may review messages, attachments, proposals, contracts, reports, and associated logs when needed for support, trust and safety, fraud prevention, technical troubleshooting, or legal compliance. CoFoundry does not promise that every interaction is proactively monitored, but it reserves the right to investigate when warranted.",
      "Organization writes use role checks and version controls intended to prevent unauthorized or stale updates. Those controls reduce risk but do not replace an organization's own access reviews, confidentiality practices, device security, or legal recordkeeping obligations.",
    ],
  },
  {
    id: "rights-choices",
    title: "11. Your Choices and Privacy Rights",
    summary: "Members can change visibility settings, edit profile data, and request privacy-related action through support.",
    paragraphs: [
      "You can update profile information, change visibility settings, manage linked accounts, cancel a paid plan, and close your account through the settings and account tools CoFoundry makes available.",
      "You can also contact CoFoundry to request access, correction, deletion, or other privacy-related support. CoFoundry may need to verify your identity before acting on a request and may limit or deny a request where another user's rights, ongoing investigations, legal obligations, or record-retention duties prevent immediate deletion.",
      "Members can also control whether they receive marketing messages, decide what links to publish publicly, and choose whether to make a profile visible on the public web, only to signed-in members, or not broadly visible at all.",
    ],
  },
  {
    id: "us-state-disclosures",
    title: "12. California and U.S. State Privacy Disclosures",
    summary: "CoFoundry is built to stay aligned with U.S. privacy-policy and notice expectations as the platform scales.",
    paragraphs: [
      "CoFoundry aims to describe its data practices clearly enough to support U.S. state privacy-policy expectations, including disclosures about categories of information collected, how information is shared, how visibility works, and how members can request changes or deletion.",
      "CoFoundry's current product configuration does not use cross-context behavioral advertising or sell personal information for that purpose. If CoFoundry later introduces targeted advertising, sale or sharing concepts, or additional state-law opt-out rights, CoFoundry will update this policy and any notice-at-collection or opt-out controls required before the change goes live.",
      "If CoFoundry becomes subject to broader state-law rights or threshold-based obligations, it may expand this section or add a supplemental U.S. state privacy notice describing category-based retention, rights procedures, and preference-signal handling in more detail.",
    ],
  },
  {
    id: "international-transfers",
    title: "13. International Users and Cross-Border Transfers",
    summary: "CoFoundry is currently structured around a U.S.-first service posture, with additional notices required if broader regional support is enabled.",
    paragraphs: [
      "CoFoundry is currently organized around a U.S.-based operating model. If CoFoundry later makes the service broadly available in the EU, UK, or other regions with additional privacy requirements, CoFoundry may provide supplemental notices describing lawful bases, international transfer safeguards, cookie consent controls, and regional rights.",
      "When live third-party providers process information for CoFoundry, data may be stored or accessed in the United States or other countries where those providers operate. If CoFoundry expands into jurisdictions that require transfer safeguards, CoFoundry will implement the appropriate measures before offering those flows there.",
    ],
  },
  {
    id: "children",
    title: "14. Children and Age Restrictions",
    summary: "CoFoundry is intended for adults who are old enough to enter startup collaborations.",
    paragraphs: [
      "CoFoundry is not directed to children, and members must be at least 18 years old to use the service.",
      "If CoFoundry learns that it has collected personal information from someone who is not allowed to use the service, CoFoundry may suspend the account and delete or restrict the related data as appropriate.",
    ],
  },
  {
    id: "investment-features",
    title: "15. Optional Investment Workspace",
    summary: "Fundraising planning and program review use separate applicant, staff, and third-party visibility boundaries.",
    paragraphs: [
      "The investment workspace is feature-flagged and disabled by default. When enabled, it stores fundraising readiness, round planning, applicant-owned outreach, data-room materials, program applications, diligence, staff review, decisions, consent history, and regulated-partner handoffs separately from ordinary founder matching.",
      "Applicant-created investor prospects, contact details, notes, and interaction history are not available in program-staff projections. Review staff receive the application, readiness, and round snapshot captured for the latest submitted revision, and only the data-room records and founder updates that the applicant marks for program sharing.",
      "Applicants do not receive staff-only review notes, risk flags, internal decision rationale, reviewer identities that are not needed for the workflow, or internal partner-preparation notes. Account exports follow the same applicant projection rather than exporting staff-only material.",
      "CoFoundry records separate consent before staff can prepare a regulated-partner handoff. The handoff is limited to applicant-shared records selected for that partner. Withdrawing consent stops future unsent sharing but cannot recall information a partner already received or override that partner's independent legal retention duties.",
      "Uploaded investment documents remain in private storage, are subject to file-scan controls, and are delivered through authenticated or short-lived download access. CoFoundry does not make data-room files publicly available.",
    ],
  },
  {
    id: "changes-contact",
    title: "16. Changes to This Policy and Contact Information",
    summary: "CoFoundry may update this policy as the product, vendor stack, or legal posture changes.",
    paragraphs: [
      "CoFoundry may update this Privacy Policy from time to time to reflect changes in features, service providers, legal requirements, matching logic, or tracking posture.",
      "If CoFoundry makes a material change, it may provide notice through the site, application, email, or another reasonable method before or when the updated policy becomes effective.",
      "Questions, rights requests, or escalation notices can be sent through CoFoundry's support channels.",
    ],
  },
]
