import { z } from "zod"

export const signInSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
})

export const signUpSchema = z.object({
  name: z.string().min(2, "Enter your full name."),
  email: z.string().email("Enter a valid email address."),
  inviteToken: z.string().trim().min(20, "Invite token is incomplete.").max(200).optional(),
  password: z.string().min(8, "Password must be at least 8 characters."),
})

export const accessRequestSchema = z.object({
  company: z.string().trim().max(120, "Keep the company or project name concise.").optional().or(z.literal("")),
  companyStage: z.enum(["idea", "prototype", "mvp", "revenue", "growth", "not_sure"]),
  email: z.string().email("Enter a valid email."),
  name: z.string().trim().min(2, "Enter your name."),
  role: z.enum(["founder", "collaborator", "studio", "investor", "other"]),
  source: z.string().trim().max(120).optional().or(z.literal("")),
  timeline: z.enum(["now", "30_days", "90_days", "exploring"]),
  useCase: z.string().trim().min(40, "Add enough detail for an admin to evaluate the request.").max(1600, "Keep the request focused."),
  website: z.string().trim().max(0).optional().or(z.literal("")),
})

export const adminAccessRequestStatusSchema = z.object({
  notes: z.string().trim().min(8, "Add a short admin note.").max(1000, "Keep the admin note concise."),
  status: z.enum(["open", "approved", "denied"]),
})

export const adminAccessInviteSchema = z.object({
  notes: z.string().trim().min(8, "Add a short invite note.").max(1000, "Keep the invite note concise."),
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
  fullTimeBy: z.string().min(1, "Add the date by which this would need to become a full-time decision."),
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
  introCapacity: z.string().min(6, "State how many conversations you can support right now."),
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

export const billingSubscriptionMutationSchema = z.object({
  action: z.enum(["cancel_at_period_end", "resume"]),
})

export const fileUploadPolicySchema = z.object({
  filename: z.string().trim().min(1, "Filename is required.").max(180, "Filename is too long."),
  mimeType: z.string().trim().min(3, "File type is required.").max(120, "File type is too long."),
  purpose: z.enum(["message_attachment", "proposal_attachment", "contract_attachment", "trust_evidence"]),
  relatedType: z.enum(["message", "proposal", "contract", "profile", "opportunity"]).nullable().optional(),
  relatedId: z.string().trim().min(1).max(120).nullable().optional(),
  sizeBytes: z.number().int().positive("File size must be positive.").max(10 * 1024 * 1024, "Files must be 10MB or smaller."),
})

export const fileScanResultSchema = z.object({
  notes: z.string().trim().max(500, "Scan notes are too long.").nullable().optional(),
  scanStatus: z.enum(["clean", "flagged", "failed", "skipped"]),
  status: z.enum(["uploaded", "blocked", "deleted"]).optional(),
})

export const operationsBackupRunSchema = z.object({
  artifactUri: z.string().trim().max(500, "Artifact URI is too long.").nullable().optional(),
  completedAt: z.string().datetime("Use an ISO timestamp.").nullable().optional(),
  id: z.string().trim().min(1).max(120).optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  notes: z.string().trim().max(1000, "Backup notes are too long.").nullable().optional(),
  provider: z.string().trim().min(2).max(120).default("external"),
  startedAt: z.string().datetime("Use an ISO timestamp.").optional(),
  status: z.enum(["scheduled", "running", "succeeded", "failed"]),
})

export const operationsDigestRunSchema = z.object({
  dryRun: z.boolean().default(false),
  maxUsers: z.number().int().min(1).max(200).default(100),
  onlyWithUnread: z.boolean().default(true),
  userId: z.string().trim().min(1).max(120).optional(),
})

export const operationsMailSmokeSchema = z.object({
  dryRun: z.boolean().default(false),
  metadata: z.record(z.string(), z.unknown()).default({}),
  subject: z.string().trim().min(3).max(160).default("CoFoundry mail smoke test"),
  toEmail: z.string().trim().email().max(254).optional(),
})

export const operationsLifecycleNotificationSchema = z.object({
  dryRun: z.boolean().default(false),
  eventType: z.enum([
    "intro.received",
    "intro.accepted",
    "match.created",
    "message.unread",
    "proposal.received",
    "proposal.updated",
    "contract.signature_required",
    "report.reviewed",
    "billing.state_changed",
    "subscription.changed",
  ]),
  metadata: z.record(z.string(), z.unknown()).default({}),
  targetId: z.string().trim().min(1).max(160),
  targetType: z.enum(["connect_request", "match", "message", "conversation", "proposal", "contract", "report", "subscription"]).nullable().optional(),
  userId: z.string().trim().min(1).max(120),
})

export const operationsEmailSuppressionSchema = z.object({
  category: z.enum(["all", "digest", "workflow"]).default("all"),
  email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
  metadata: z.record(z.string(), z.unknown()).default({}),
  provider: z.string().trim().min(2).max(120).default("external"),
  reason: z.enum(["bounce", "complaint", "manual", "provider_suppression", "unsubscribe"]),
  sourceEventId: z.string().trim().min(1).max(200).nullable().optional(),
  suppressedAt: z.string().datetime("Use an ISO timestamp.").optional(),
})

export const operationsEventSchema = z.object({
  actorUserId: z.string().trim().min(1).max(120).nullable().optional(),
  eventType: z.string().trim().min(2).max(120),
  metadata: z.record(z.string(), z.unknown()).default({}),
  severity: z.enum(["info", "warning", "error"]).default("info"),
  source: z.string().trim().min(2).max(120),
  targetId: z.string().trim().min(1).max(120).nullable().optional(),
  targetType: z.string().trim().min(1).max(80).nullable().optional(),
})

export const reportSchema = z.object({
  reason: z.enum(["spam", "misrepresentation", "harassment", "off_platform_solicitation", "scam_fraud", "impersonation", "data_harvesting", "privacy_violation"]),
  details: z.string().min(12, "Add enough detail for moderation to understand the issue."),
})

export const adminUserModerationSchema = z.object({
  action: z.enum(["suspend", "reinstate"]),
  notes: z.string().trim().min(8, "Add a short moderation note.").max(300, "Keep the moderation note concise."),
})

export const adminUserRoleSchema = z.object({
  notes: z.string().trim().min(8, "Add a short role-change note.").max(500, "Keep the role-change note concise."),
  role: z.enum(["founder", "collaborator", "admin", "investor_admin"]),
})

export const adminUserEmailVerificationSchema = z.object({
  notes: z.string().trim().min(8, "Add a short email-verification note.").max(500, "Keep the email-verification note concise."),
})

export const adminReportStatusSchema = z.object({
  status: z.enum(["reviewed", "resolved"]),
  notes: z.string().trim().min(8, "Add a short moderation note.").max(500, "Keep the moderation note concise."),
})

export const adminOpportunityVerificationSchema = z.object({
  notes: z.string().trim().min(8, "Add a short opportunity-verification note.").max(500, "Keep the opportunity-verification note concise."),
  status: z.enum(["unverified", "owner_verified", "domain_verified"]),
})

export const adminCommandQueueActionSchema = z.object({
  action: z.enum(["assign", "escalate", "review_evidence"]),
  assignedAdminUserId: z.string().trim().min(1, "An assignee id is required.").max(120, "Assignee id is too long.").optional(),
  escalationQueue: z.enum(["trust_safety", "operations", "founder_success", "billing"]).optional(),
  notes: z.string().trim().min(8, "Add a short queue action note.").max(500, "Keep the queue action note concise."),
  targetId: z.string().trim().min(1, "A queue target id is required.").max(160, "Queue target id is too long."),
  targetType: z.enum(["access_request", "readiness_check", "file_upload", "report", "privacy_request", "opportunity"]),
})

export const privacyRequestSchema = z.object({
  details: z.string().trim().min(12, "Add enough detail for support to handle the request.").max(1000, "Keep the request concise."),
  type: z.enum(["data_export", "account_deletion", "correction", "visibility", "safety_privacy"]),
})
