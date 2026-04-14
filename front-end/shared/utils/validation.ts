import { z } from "zod"

export const signInSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
})

export const signUpSchema = z.object({
  name: z.string().min(2, "Enter your full name."),
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
})

export const contactSchema = z.object({
  name: z.string().min(2, "Enter your name."),
  email: z.string().email("Enter a valid email."),
  company: z.string().optional(),
  subject: z.string().min(3, "Add a short subject."),
  message: z.string().min(20, "Please include enough detail for us to help."),
  website: z.string().trim().max(0).optional().or(z.literal("")),
})

export const minimumOnboardingSchema = z.object({
  intentMode: z.enum(["start", "join", "explore"]),
  displayName: z.string().min(2, "Name is required."),
  photoUrl: z.string().url("Add a valid profile photo URL."),
  headline: z.string().min(10, "Write a clearer one-line summary."),
  bio: z.string().min(40, "Describe what you want to build or join with enough detail to evaluate fit."),
  location: z.string().min(2, "Location is required."),
  remotePreference: z.enum(["remote", "hybrid", "in_person"]),
  primaryRole: z.string().min(2, "Choose the main role you want to be evaluated for."),
  roles: z.array(z.string()).min(1, "Choose at least one role."),
  industries: z.array(z.string()).min(1, "Choose at least one industry."),
  timeCommitment: z.enum(["nights_weekends", "part_time", "full_time"]),
  weeklyAvailabilityHours: z.number().min(1).max(80),
  startTimeline: z.enum(["immediately", "30_days", "90_days", "exploring"]),
  fullTimeBy: z.string().min(1, "Add the date by which this would need to become a serious full-time decision."),
  runwayBucket: z.enum(["under_3_months", "3_to_6_months", "6_to_12_months", "12_plus_months", "undisclosed"]),
  equityPhilosophy: z.enum(["equal_unless_strong_reason", "contribution_weighted", "dynamic_over_time"]),
  companyPreferences: z.array(z.string()).min(1, "Choose at least one company preference."),
  profileVisibility: z.enum(["public", "members", "private"]),
})

export const onboardingSchema = z.object({
  displayName: z.string().min(2, "Name is required."),
  photoUrl: z.string().url("Add a valid profile photo URL."),
  headline: z.string().min(10, "Write a clearer headline."),
  bio: z.string().min(60, "Tell people enough to understand your background."),
  location: z.string().min(2, "Location is required."),
  remotePreference: z.enum(["remote", "hybrid", "in_person"]),
  primaryRole: z.string().min(2, "Choose your primary role."),
  roles: z.array(z.string()).min(1, "Choose at least one role."),
  yearsExperience: z.number().min(0).max(40),
  industries: z.array(z.string()).min(1, "Choose at least one industry."),
  startupStagePreferences: z.array(z.enum(["idea", "prototype", "mvp", "revenue", "growth"])).min(1, "Choose at least one stage."),
  compensationPreferences: z.array(z.enum(["equity_only", "cash_and_equity", "cash_only", "advisory"])).min(1, "Choose at least one compensation preference."),
  equityExpectationRange: z.string().min(2, "Equity expectation is required."),
  timeCommitment: z.enum(["nights_weekends", "part_time", "full_time"]),
  weeklyAvailabilityHours: z.number().min(1).max(80),
  startTimeline: z.enum(["immediately", "30_days", "90_days", "exploring"]),
  fullTimeBy: z.string().min(1, "Add a full-time target date."),
  runwayBucket: z.enum(["under_3_months", "3_to_6_months", "6_to_12_months", "12_plus_months", "undisclosed"]),
  currentStatus: z.enum(["full_time_employed", "consulting_part_time", "between_roles", "full_time_on_startup", "exploring"]),
  equityPhilosophy: z.enum(["equal_unless_strong_reason", "contribution_weighted", "dynamic_over_time"]),
  leadershipPreference: z.enum(["wants_ceo_role", "open_to_ceo_role", "prefers_non_ceo_role"]),
  decisionModelPreference: z.enum(["ceo_decides_with_input", "area_owner_decides", "consensus_for_big_bets"]),
  deadlockPreference: z.enum(["advisor_tiebreaker", "rotating_decider", "board_mediator", "neutral_operator"]),
  companyPreferences: z.array(z.string()).min(1, "Choose at least one company preference."),
  nonNegotiables: z.array(z.string()).min(1, "Choose at least one non-negotiable."),
  introCapacity: z.string().min(6, "State how many serious conversations you can support right now."),
  nonResponsibilities: z.array(z.string()).min(1, "State at least one thing you do not want to own in the first year."),
  accountabilityMilestones: z.array(z.string()).min(1, "Add at least one accountability milestone."),
  existingAssets: z.array(z.string()).min(1, "Declare whether there is any pre-existing code, design, data, or domain ownership in play."),
  existingAssetsNotes: z.string().min(12, "Add enough detail for a future proposal or counsel review."),
  priorObligations: z.enum(["none_known", "possible_constraints", "confirmed_constraints"]),
  readyToAssignIp: z.boolean(),
  linkedin: z.string().url("Add a valid LinkedIn URL.").or(z.literal("")),
  github: z.string().url("Add a valid GitHub URL.").or(z.literal("")),
  portfolio: z.string().url("Add a valid portfolio URL.").or(z.literal("")),
  website: z.string().url("Add a valid personal site URL.").or(z.literal("")),
  hasIdea: z.boolean(),
  wantsToJoinIdea: z.boolean(),
  values: z.array(z.string()).min(1, "Add at least one value."),
  workStylePreferences: z.array(z.string()).min(1, "Add at least one work-style preference."),
  profileVisibility: z.enum(["public", "members", "private"]),
})

export const opportunitySchema = z.object({
  startupName: z.string().min(2, "Startup name is required."),
  oneLinePitch: z.string().min(12, "Write a clearer one-line pitch."),
  problem: z.string().min(50, "Describe the problem in more detail."),
  targetUsers: z.string().min(20, "Describe the target users."),
  stage: z.enum(["idea", "prototype", "mvp", "revenue", "growth"]),
  traction: z.string().min(20, "Add concrete traction or evidence."),
  expectedCommitment: z.enum(["nights_weekends", "part_time", "full_time"]),
  compensationStructure: z.enum(["equity_only", "cash_and_equity", "cash_only", "advisory"]),
  equityRange: z.string().min(2, "Equity range is required."),
  location: z.string().min(2, "Location is required."),
  remotePreference: z.enum(["remote", "hybrid", "in_person"]),
  officialWebsite: z.string().url("Add a valid company or project URL.").or(z.literal("")),
  verificationMethod: z.enum(["none", "work_email", "domain", "github_org"]),
  industries: z.array(z.string()).min(1, "Add at least one industry."),
  rolesNeeded: z.array(z.string()).min(1, "Add at least one role."),
})

export const proposalSchema = z.object({
  relationshipType: z.enum(["cofounder", "founding_team", "advisor"]),
  roleTitle: z.string().min(2, "Role title is required."),
  responsibilities: z.array(z.string()).min(2, "Add at least two concrete responsibilities."),
  weeklyTimeCommitment: z.number().min(1).max(80),
  startDate: z.string().min(1, "Start date is required."),
  fullTimeTrigger: z.string().min(10, "Explain what turns this into a full-time commitment."),
  ceoDecision: z.string().min(10, "Explain how the CEO / lead operator decision works."),
  trialScope: z.string().min(12, "Define the work trial before long-term terms lock in."),
  trialIpHandling: z.string().min(12, "Explain what happens to trial work if the relationship ends."),
  cashCompensation: z.string().min(2, "Describe the cash terms."),
  equity: z.string().min(2, "Describe the equity terms."),
  vestingSchedule: z.string().min(2, "Describe the vesting schedule."),
  cliff: z.string().min(2, "Describe the cliff."),
  decisionRights: z.string().min(10, "Explain how decision rights work."),
  ipAssignmentRequired: z.boolean(),
  confidentiality: z.string().min(10, "Explain confidentiality expectations."),
  exitTerms: z.string().min(10, "Explain exit terms."),
  notes: z.string().min(10, "Include additional context."),
})

export const contractSignatureSchema = z.object({
  typedName: z.string().min(2, "Type your full name to sign."),
})

export const profileSearchSchema = z.object({
  query: z.string(),
  roles: z.array(z.string()),
  skills: z.array(z.string()),
  industries: z.array(z.string()),
})

export const billingCheckoutSchema = z.object({
  plan: z.enum(["pro", "team"]),
  interval: z.enum(["monthly", "annual"]).default("monthly"),
})

export const reportSchema = z.object({
  reason: z.enum(["spam", "misrepresentation", "harassment", "off_platform_solicitation", "scam_fraud", "impersonation", "data_harvesting", "privacy_violation"]),
  details: z.string().min(12, "Add enough detail for moderation to understand the issue."),
})

export const adminUserModerationSchema = z.object({
  action: z.enum(["suspend", "reinstate"]),
  notes: z.string().trim().min(8, "Add a short moderation note.").max(300, "Keep the moderation note concise."),
})

export const adminReportStatusSchema = z.object({
  status: z.enum(["reviewed", "resolved"]),
  notes: z.string().trim().min(8, "Add a short moderation note.").max(500, "Keep the moderation note concise."),
})
