import type {
  CompensationPreference,
  ContactRevealStage,
  CurrentWorkStatus,
  DeadlockPreference,
  DecisionModelPreference,
  EquityPhilosophy,
  LeadershipPreference,
  OpportunityVerificationMethod,
  ReportReason,
  RunwayBucket,
  StartTimeline,
  StartupStage,
} from "../types/domain"

export const roleOptions = [
  "Founder",
  "CEO",
  "CTO",
  "Technical Co-Founder",
  "Founding Engineer",
  "Product",
  "Founding Designer",
  "Sales",
  "Growth",
  "Operations",
]

export const industryOptions = [
  "Fintech",
  "Healthtech",
  "Developer Tools",
  "AI",
  "Compliance",
  "B2B SaaS",
  "Logistics",
  "Operations",
  "Climate",
  "Consumer",
]

export const valueOptions = [
  "Candor",
  "High trust",
  "Bias to action",
  "Customer empathy",
  "Technical rigor",
  "Calm execution",
  "Default to transparency",
  "Long-term ownership",
]

export const workStyleOptions = [
  "Write before meetings",
  "Weekly written updates",
  "Async-first communication",
  "Tight feedback loops",
  "Customer calls every week",
  "Lean process",
  "Clear decision logs",
  "Fast prototyping",
]

export const stageOptions: { label: string, value: StartupStage }[] = [
  { label: "Idea", value: "idea" },
  { label: "Prototype", value: "prototype" },
  { label: "MVP", value: "mvp" },
  { label: "Revenue", value: "revenue" },
  { label: "Growth", value: "growth" },
]

export const remoteOptions = [
  { label: "Remote", value: "remote" },
  { label: "Hybrid", value: "hybrid" },
  { label: "In person", value: "in_person" },
]

export const commitmentOptions = [
  { label: "Nights & weekends", value: "nights_weekends" },
  { label: "Part-time", value: "part_time" },
  { label: "Full-time", value: "full_time" },
]

export const compensationOptions: CompensationPreference[] = [
  "equity_only",
  "cash_and_equity",
  "cash_only",
  "advisory",
]

export const startTimelineOptions: { label: string, value: StartTimeline }[] = [
  { label: "Ready now", value: "immediately" },
  { label: "Within 30 days", value: "30_days" },
  { label: "Within 90 days", value: "90_days" },
  { label: "Exploring carefully", value: "exploring" },
]

export const companyPreferenceOptions = [
  "Workflow software",
  "B2B SaaS",
  "Developer tools",
  "Applied AI",
  "Vertical software",
  "Marketplace",
  "Healthtech",
  "Fintech",
]

export const nonNegotiableOptions = [
  "Need clear decision rights",
  "Must be full-time soon",
  "Need direct customer exposure",
  "Must use founder vesting",
  "Need weekly written updates",
  "Need product and technical candor",
  "Must stay startup-team focused",
]

export const contactRevealStageOptions: { label: string, value: ContactRevealStage }[] = [
  { label: "After a mutual match", value: "matches" },
  { label: "After a proposal is accepted", value: "proposal_accepted" },
  { label: "After a contract draft exists", value: "contract_generated" },
]

export const opportunityVerificationOptions: { label: string, value: OpportunityVerificationMethod }[] = [
  { label: "No external proof yet", value: "none" },
  { label: "Verified company email", value: "work_email" },
  { label: "Domain control", value: "domain" },
  { label: "GitHub org ownership", value: "github_org" },
]

export const reportReasonOptions: { label: string, value: ReportReason }[] = [
  { label: "Spam", value: "spam" },
  { label: "Misrepresentation", value: "misrepresentation" },
  { label: "Harassment", value: "harassment" },
  { label: "Off-platform solicitation", value: "off_platform_solicitation" },
  { label: "Scam or fraud", value: "scam_fraud" },
  { label: "Impersonation", value: "impersonation" },
  { label: "Data harvesting", value: "data_harvesting" },
  { label: "Privacy violation", value: "privacy_violation" },
]

export const proposalRelationshipOptions = [
  { label: "Co-founder", value: "cofounder" },
  { label: "Founding team member", value: "founding_team" },
  { label: "Advisor", value: "advisor" },
]

export const runwayBucketOptions: { label: string, value: RunwayBucket }[] = [
  { label: "Under 3 months", value: "under_3_months" },
  { label: "3 to 6 months", value: "3_to_6_months" },
  { label: "6 to 12 months", value: "6_to_12_months" },
  { label: "12+ months", value: "12_plus_months" },
  { label: "Prefer not to say", value: "undisclosed" },
]

export const currentWorkStatusOptions: { label: string, value: CurrentWorkStatus }[] = [
  { label: "Full-time employed", value: "full_time_employed" },
  { label: "Consulting or part-time", value: "consulting_part_time" },
  { label: "Between roles", value: "between_roles" },
  { label: "Already full-time on startup", value: "full_time_on_startup" },
  { label: "Exploring", value: "exploring" },
]

export const equityPhilosophyOptions: { label: string, value: EquityPhilosophy }[] = [
  { label: "Equal unless there is a strong reason", value: "equal_unless_strong_reason" },
  { label: "Contribution-weighted", value: "contribution_weighted" },
  { label: "Dynamic over time", value: "dynamic_over_time" },
]

export const leadershipPreferenceOptions: { label: string, value: LeadershipPreference }[] = [
  { label: "I want the CEO / lead role", value: "wants_ceo_role" },
  { label: "I am open to the CEO / lead role", value: "open_to_ceo_role" },
  { label: "I prefer a non-CEO role", value: "prefers_non_ceo_role" },
]

export const decisionModelOptions: { label: string, value: DecisionModelPreference }[] = [
  { label: "CEO decides with input", value: "ceo_decides_with_input" },
  { label: "Area owners decide", value: "area_owner_decides" },
  { label: "Consensus for big bets", value: "consensus_for_big_bets" },
]

export const deadlockPreferenceOptions: { label: string, value: DeadlockPreference }[] = [
  { label: "Advisor tiebreaker", value: "advisor_tiebreaker" },
  { label: "Rotating decider", value: "rotating_decider" },
  { label: "Board or formal mediator", value: "board_mediator" },
  { label: "Neutral operator", value: "neutral_operator" },
]

export const priorObligationOptions = [
  { label: "No known constraints", value: "none_known" },
  { label: "Possible employer or invention constraints", value: "possible_constraints" },
  { label: "Confirmed constraints", value: "confirmed_constraints" },
]
