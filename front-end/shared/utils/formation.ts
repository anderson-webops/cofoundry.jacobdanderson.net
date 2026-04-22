import type {
  ConnectDeclineReason,
  ConnectRequest,
  Message,
  OpportunityVerificationStatus,
  Profile,
  ReportPriority,
  ReportReason,
  StartupOpportunity,
  StructuredIntro,
  TrialCollaboration,
  TrustTier,
} from "../types/domain"
import {
  formatConnectRequestNextStep,
  formatCurrentWorkStatus,
  formatDecisionModelPreference,
  formatEquityPhilosophy,
  formatLeadershipPreference,
  formatRelativeDate,
  formatRunwayBucket,
  formatStartTimeline,
} from "./format"

const recentActivityWindowMs = 1000 * 60 * 60 * 24 * 7
const offPlatformRiskPattern = /\b(?:telegram|whatsapp|signal|text me|text us|wire|crypto|wallet|processing fee|application fee|pay to proceed|dm me|move this off-platform)\b/i
const investorRiskPattern = /\b(?:investor|angel|fund|venture|vc|limited partner|syndicate)\b/i
const highPriorityReportReasons = new Set<ReportReason>(["scam_fraud", "impersonation", "data_harvesting", "privacy_violation"])

export const firstCallAgenda = [
  {
    title: "Why now",
    body: "Compare urgency, current commitments, and what would make this a real build decision rather than a loose exploration.",
  },
  {
    title: "Company shape",
    body: "Pressure-test the customer, market, and startup shape each side actually wants to commit to for the next few years.",
  },
  {
    title: "Decision rights",
    body: "Get explicit about who should own product, technical, hiring, and company-level calls before chemistry hides the disagreement.",
  },
  {
    title: "Trial expectations",
    body: "Define the smallest useful trial project, the weekly cadence, and what a successful working sprint would look like.",
  },
]

const declineReasonLabels: Record<ConnectDeclineReason, string> = {
  timing: "Timing mismatch",
  domain_mismatch: "Domain mismatch",
  commitment_mismatch: "Commitment mismatch",
  values_mismatch: "Values mismatch",
  role_mismatch: "Role mismatch",
}

export function buildStructuredIntroNote(intro: StructuredIntro) {
  return `${intro.whyFit.trim()} ${intro.whyNow.trim()} Proposed next step: ${formatConnectRequestNextStep(intro.proposedNextStep)}.`.trim()
}

export function buildConnectRequestDueCopy(request: Pick<ConnectRequest, "createdAt" | "respondedAt" | "status">) {
  if (request.status !== "pending" || request.respondedAt)
    return "Closed"

  const dueAt = new Date(new Date(request.createdAt).getTime() + 1000 * 60 * 60 * 48).toISOString()
  return `Reply target ${formatRelativeDate(dueAt)}`
}

export function buildResponsivenessLabel(profile: Profile) {
  if (profile.trustSignals.replyRatePercent >= 85 && profile.trustSignals.medianReplyHours <= 24)
    return "Likely to reply quickly"

  if (profile.trustSignals.replyRatePercent >= 70 && profile.trustSignals.medianReplyHours <= 48)
    return "Usually replies within two days"

  if (profile.trustSignals.replyRatePercent >= 50)
    return "Response history is mixed"

  return "Reply history is still thin"
}

export interface ProfileReadinessItem {
  id: string
  title: string
  complete: boolean
  description: string
}

export interface ProfileReadinessState {
  checklist: ProfileReadinessItem[]
  completedCount: number
  totalCount: number
  percent: number
  trustChecklist: ProfileReadinessItem[]
  trustCompletedCount: number
  trustTotalCount: number
  trustPercent: number
  trustReady: boolean
  missingTrustItems: string[]
  profileComplete: boolean
  readyForOutreach: boolean
  missingOutreachItems: string[]
}

export interface AlignmentCheckItem {
  id: string
  title: string
  status: "aligned" | "review" | "missing"
  summary: string
}

function hasProofLink(profile: Profile) {
  return Boolean(
    profile.links.linkedin
    || profile.links.github
    || profile.links.portfolio
    || profile.links.website
    || profile.trustSignals.builderProofs.length,
  )
}

function hasProfessionalProofLink(profile: Profile) {
  return Boolean(
    profile.links.github
    || profile.links.portfolio
    || profile.links.website
    || profile.trustSignals.builderProofs.length,
  )
}

function hasRecognizableProfile(profile: Profile) {
  return Boolean(profile.photoUrl.trim() && profile.displayName.trim() && profile.location.trim())
}

export function buildVerifiedLinkCount(profile: Profile) {
  return [
    profile.trustSignals.linkedInVerified,
    profile.trustSignals.githubVerified,
    profile.trustSignals.workDomainVerified,
    profile.trustSignals.websiteVerified,
  ].filter(Boolean).length
}

function buildTrustReadinessChecklist(profile: Profile): ProfileReadinessItem[] {
  const verifiedLinkCount = buildVerifiedLinkCount(profile)
  const recognizableProfileComplete = hasRecognizableProfile(profile)
  const identityRailsComplete = Boolean(
    profile.verificationBadges.emailVerified
    && (profile.trustSignals.phoneVerified || profile.trustSignals.governmentIdVerified)
    && verifiedLinkCount >= 1,
  )
  const proofOfWorkComplete = hasProfessionalProofLink(profile)
  const roleContextComplete = Boolean(
    profile.roleScope.primaryRole
    && profile.roles.length
    && profile.yearsExperience >= 1
    && profile.headline.trim().length >= 10,
  )
  const availabilityComplete = Boolean(
    profile.location.trim()
    && profile.commitmentProfile.weeklyAvailabilityHours >= 1
    && profile.intent.startTimeline
    && profile.commitmentProfile.fullTimeBy,
  )
  const intentClarityComplete = Boolean(
    profile.intent.companyPreferences.length
    && profile.intent.introCapacity.trim().length >= 6,
  )

  return [
    {
      id: "recognizable_profile",
      title: "Recognizable profile",
      complete: recognizableProfileComplete,
      description: recognizableProfileComplete ? "Photo, name, and location are visible at scan speed." : "Add a clear profile photo, full name, and location or timezone.",
    },
    {
      id: "identity_rails",
      title: "Verified identity rails",
      complete: identityRailsComplete,
      description: identityRailsComplete
        ? `${verifiedLinkCount} verified professional link${verifiedLinkCount === 1 ? "" : "s"} plus phone or ID assurance.`
        : "Verify at least one professional link plus phone or ID so the profile is harder to fake.",
    },
    {
      id: "proof_of_work",
      title: "Proof of work",
      complete: proofOfWorkComplete,
      description: proofOfWorkComplete ? "A portfolio, repo, website, or evidence card is attached." : "Add a shipped product, repo, portfolio, or other inspectable proof link.",
    },
    {
      id: "role_context",
      title: "Role context",
      complete: roleContextComplete,
      description: roleContextComplete ? `${profile.roleScope.primaryRole} · ${profile.yearsExperience}+ years` : "State your primary role, headline, and experience so people know what you can really own.",
    },
    {
      id: "availability",
      title: "Availability and timing",
      complete: availabilityComplete,
      description: availabilityComplete
        ? `${profile.commitmentProfile.weeklyAvailabilityHours}h/week · ${formatStartTimeline(profile.intent.startTimeline)}`
        : "Declare hours per week, timing, and location so people can judge commitment quickly.",
    },
    {
      id: "intent_clarity",
      title: "Intent clarity",
      complete: intentClarityComplete,
      description: intentClarityComplete
        ? `${profile.intent.companyPreferences.slice(0, 2).join(", ")} · ${profile.intent.introCapacity}`
        : "Explain what kind of company you want and how many conversations you can support now.",
    },
  ]
}

function buildProfileReadinessChecklist(profile: Profile): ProfileReadinessItem[] {
  const identityComplete = Boolean(profile.displayName.trim() && profile.location.trim() && profile.privacy.profileVisibility)
  const roleSignalComplete = profile.roles.length > 0 && profile.headline.trim().length >= 10 && profile.bio.trim().length >= 40
  const companyFitComplete = profile.industries.length > 0 && profile.intent.companyPreferences.length > 0
  const commitmentComplete = Boolean(
    profile.remotePreference
    && profile.timeCommitment
    && profile.intent.startTimeline
    && profile.commitmentProfile.weeklyAvailabilityHours >= 1
    && profile.commitmentProfile.fullTimeBy
    && profile.commitmentProfile.runwayBucket,
  )
  const proofComplete = hasProofLink(profile)
  const outreachGuardrailsComplete = profile.intent.nonNegotiables.length > 0 && profile.intent.introCapacity.trim().length >= 6
  const collaborationStyleComplete = profile.values.length > 0 && profile.workStylePreferences.length > 0
  const compensationStageComplete = profile.compensationPreferences.length > 0 && profile.startupStagePreferences.length > 0 && profile.equityExpectationRange.trim().length >= 2
  const governanceComplete = Boolean(
    profile.governancePreferences.equityPhilosophy
    && profile.governancePreferences.leadershipPreference
    && profile.governancePreferences.decisionModelPreference
    && profile.governancePreferences.deadlockPreference,
  )
  const scopeComplete = Boolean(
    profile.roleScope.primaryRole
    && profile.roleScope.nonResponsibilities.length
    && profile.roleScope.accountabilityMilestones.length,
  )
  const ipReadinessComplete = Boolean(
    profile.ipReadiness.existingAssets.length
    && profile.ipReadiness.existingAssetsNotes.trim().length >= 12
    && profile.ipReadiness.priorObligations
    && profile.ipReadiness.readyToAssignIp,
  )

  return [
    {
      id: "identity",
      title: "Identity basics",
      complete: identityComplete,
      description: identityComplete ? `${profile.displayName} · ${profile.location}` : "Add a clear name, location, and profile visibility rule.",
    },
    {
      id: "role_signal",
      title: "Role signal",
      complete: roleSignalComplete,
      description: roleSignalComplete ? `${profile.roles.slice(0, 2).join(", ")} · ${profile.headline}` : "Add the role you want and a concise summary of what you are building or joining.",
    },
    {
      id: "company_fit",
      title: "Company fit",
      complete: companyFitComplete,
      description: companyFitComplete ? `${profile.industries.slice(0, 2).join(", ")} · ${profile.intent.companyPreferences.slice(0, 2).join(", ")}` : "Add industry and company preferences so CoFoundry can rank relevant matches.",
    },
    {
      id: "commitment",
      title: "Commitment plan",
      complete: commitmentComplete,
      description: commitmentComplete
        ? `${profile.commitmentProfile.weeklyAvailabilityHours}h/week · ${formatStartTimeline(profile.intent.startTimeline)} · full-time by ${profile.commitmentProfile.fullTimeBy}`
        : "Declare hours per week, full-time timing, and runway before people have to infer commitment.",
    },
    {
      id: "proof",
      title: "Proof and links",
      complete: proofComplete,
      description: proofComplete ? "External proof of work is attached." : "Add LinkedIn, GitHub, a portfolio, or another proof-of-work link.",
    },
    {
      id: "guardrails",
      title: "Outreach guardrails",
      complete: outreachGuardrailsComplete,
      description: outreachGuardrailsComplete ? `${profile.intent.nonNegotiables.slice(0, 2).join(" · ")} · ${profile.intent.introCapacity}` : "State your non-negotiables and how many conversations you can take right now.",
    },
    {
      id: "collaboration_style",
      title: "Collaboration style",
      complete: collaborationStyleComplete,
      description: collaborationStyleComplete ? `${profile.values.slice(0, 2).join(" · ")} · ${profile.workStylePreferences.slice(0, 2).join(" · ")}` : "Add values and work-style preferences so early conversations have useful constraints.",
    },
    {
      id: "compensation_stage",
      title: "Compensation and stage",
      complete: compensationStageComplete,
      description: compensationStageComplete ? `${profile.equityExpectationRange} · ${profile.startupStagePreferences.slice(0, 2).join(", ")}` : "Add stage, compensation, and equity expectations before proposals start.",
    },
    {
      id: "governance",
      title: "Governance preferences",
      complete: governanceComplete,
      description: governanceComplete
        ? `${formatEquityPhilosophy(profile.governancePreferences.equityPhilosophy)} · ${formatLeadershipPreference(profile.governancePreferences.leadershipPreference)}`
        : "State your equity philosophy, leadership preference, and decision model before a proposal forces the issue.",
    },
    {
      id: "role_scope",
      title: "Role boundaries",
      complete: scopeComplete,
      description: scopeComplete
        ? `${profile.roleScope.primaryRole} · ${profile.roleScope.nonResponsibilities[0]}`
        : "List your primary role, non-responsibilities, and accountability milestones.",
    },
    {
      id: "ip_readiness",
      title: "IP readiness",
      complete: ipReadinessComplete,
      description: ipReadinessComplete
        ? `${profile.ipReadiness.existingAssets.length} asset note${profile.ipReadiness.existingAssets.length === 1 ? "" : "s"} · ready for assignment`
        : "Disclose pre-existing assets and any employer constraints before the deal room opens.",
    },
  ]
}

export function isRecentlyActive(lastActiveAt: string) {
  return Date.now() - new Date(lastActiveAt).getTime() <= recentActivityWindowMs
}

export function buildProfileReadiness(profile: Profile): ProfileReadinessState {
  const checklist = buildProfileReadinessChecklist(profile)
  const completedCount = checklist.filter(item => item.complete).length
  const totalCount = checklist.length
  const trustChecklist = buildTrustReadinessChecklist(profile)
  const trustCompletedCount = trustChecklist.filter(item => item.complete).length
  const trustTotalCount = trustChecklist.length
  const trustRequiredItemIds = new Set(["recognizable_profile", "identity_rails", "proof_of_work", "role_context", "availability", "intent_clarity"])
  const missingTrustItems = trustChecklist
    .filter(item => trustRequiredItemIds.has(item.id) && !item.complete)
    .map(item => item.title)
  const outreachRequiredItemIds = new Set(["identity", "role_signal", "company_fit", "commitment", "proof", "guardrails", "governance", "ip_readiness"])
  const missingOutreachItems = checklist
    .filter(item => outreachRequiredItemIds.has(item.id) && !item.complete)
    .map(item => item.title)

  if (!profile.trustSignals.phoneVerified)
    missingOutreachItems.push("Phone verification")

  return {
    checklist,
    completedCount,
    totalCount,
    percent: Math.round((completedCount / totalCount) * 100),
    trustChecklist,
    trustCompletedCount,
    trustTotalCount,
    trustPercent: Math.round((trustCompletedCount / trustTotalCount) * 100),
    trustReady: missingTrustItems.length === 0,
    missingTrustItems,
    profileComplete: checklist.every(item => item.complete),
    readyForOutreach: missingOutreachItems.length === 0,
    missingOutreachItems,
  }
}

export function buildProfileTrustTier(profile: Profile): TrustTier {
  const readiness = buildProfileReadiness(profile)

  if (profile.trustSignals.governmentIdVerified ?? false)
    return "level_c"

  if (readiness.trustReady)
    return "level_b"

  return "level_a"
}

export function buildProfileTrustScore(profile: Profile) {
  const readiness = buildProfileReadiness(profile)
  let score = 0

  if (buildProfileTrustTier(profile) === "level_c")
    score += 3
  else if (buildProfileTrustTier(profile) === "level_b")
    score += 2

  score += Math.round(readiness.trustPercent / 20)

  if (hasRecognizableProfile(profile))
    score += 2
  if (profile.verificationBadges.profileComplete)
    score += 2
  if (profile.verificationBadges.emailVerified)
    score += 1
  if (profile.verificationBadges.linkedAccounts)
    score += 1
  if (profile.trustSignals.phoneVerified)
    score += 1
  if (profile.trustSignals.linkedInVerified)
    score += 1
  if (profile.trustSignals.githubVerified)
    score += 1
  if (profile.trustSignals.workDomainVerified)
    score += 1
  if (profile.trustSignals.websiteVerified)
    score += 1
  if (profile.trustSignals.identityVerified)
    score += 2
  if (profile.trustSignals.workHistoryVerified)
    score += 1

  score += Math.min(profile.trustSignals.builderProofs.length, 3) * 2

  if (profile.trustSignals.replyRatePercent >= 90)
    score += 2
  else if (profile.trustSignals.replyRatePercent >= 75)
    score += 1

  if (profile.trustSignals.medianReplyHours <= 24)
    score += 2
  else if (profile.trustSignals.medianReplyHours <= 72)
    score += 1

  if (isRecentlyActive(profile.trustSignals.lastActiveAt))
    score += 1

  return score
}

export function buildIntentChecklist(profile: Profile) {
  const readiness = buildProfileReadiness(profile)

  return [
    {
      id: "intent",
      title: "Intent profile",
      complete: Boolean(profile.intent.startTimeline && profile.intent.companyPreferences.length && profile.intent.nonNegotiables.length),
      description: `${formatStartTimeline(profile.intent.startTimeline)} · ${profile.intent.companyPreferences.slice(0, 2).join(", ")}`,
    },
    {
      id: "proof",
      title: "Proof of work",
      complete: profile.trustSignals.builderProofs.length > 0,
      description: profile.trustSignals.builderProofs.length
        ? `${profile.trustSignals.builderProofs.length} artifact${profile.trustSignals.builderProofs.length === 1 ? "" : "s"} attached`
        : "Add shipped work, case studies, or repos",
    },
    {
      id: "responsiveness",
      title: "Responsiveness",
      complete: profile.trustSignals.replyRatePercent >= 70,
      description: `${profile.trustSignals.replyRatePercent}% replies · median ${profile.trustSignals.medianReplyHours}h`,
    },
    {
      id: "capacity",
      title: "Conversation capacity",
      complete: Boolean(profile.intent.introCapacity),
      description: profile.intent.introCapacity || "Declare how many intros you can take right now",
    },
    {
      id: "commitment_profile",
      title: "Commitment profile",
      complete: profile.commitmentProfile.weeklyAvailabilityHours >= 1 && Boolean(profile.commitmentProfile.fullTimeBy),
      description: `${profile.commitmentProfile.weeklyAvailabilityHours}h/week · ${formatRunwayBucket(profile.commitmentProfile.runwayBucket)} · ${formatCurrentWorkStatus(profile.commitmentProfile.currentStatus)}`,
    },
    {
      id: "governance",
      title: "Governance defaults",
      complete: Boolean(profile.governancePreferences.equityPhilosophy && profile.governancePreferences.decisionModelPreference),
      description: `${formatEquityPhilosophy(profile.governancePreferences.equityPhilosophy)} · ${formatDecisionModelPreference(profile.governancePreferences.decisionModelPreference)}`,
    },
    {
      id: "activation",
      title: "Activation progress",
      complete: readiness.readyForOutreach,
      description: readiness.readyForOutreach ? "Outreach is unlocked." : `Need ${readiness.missingOutreachItems.join(", ")}`,
    },
  ]
}

export function getOutreachUnlockMessage(profile: Profile) {
  const readiness = buildProfileReadiness(profile)

  if (readiness.readyForOutreach)
    return "Outreach is unlocked."

  return `Complete ${readiness.missingOutreachItems.join(", ")} before sending new connect requests.`
}

function hasSharedWorkStyle(left: Profile, right: Profile) {
  return left.workStylePreferences.some(item => right.workStylePreferences.includes(item))
}

export function buildAlignmentCheck(left: Profile, right: Profile): AlignmentCheckItem[] {
  const roleOverlap = left.roles.some(role => right.roles.includes(role))
  const bothWantLead = left.governancePreferences.leadershipPreference === "wants_ceo_role"
    && right.governancePreferences.leadershipPreference === "wants_ceo_role"
  const ipBlocked = [left.ipReadiness.priorObligations, right.ipReadiness.priorObligations].includes("confirmed_constraints")

  return [
    {
      id: "commitment",
      title: "Commitment",
      status: left.commitmentProfile.weeklyAvailabilityHours && right.commitmentProfile.weeklyAvailabilityHours
        ? left.timeCommitment === right.timeCommitment ? "aligned" : "review"
        : "missing",
      summary: `${left.commitmentProfile.weeklyAvailabilityHours}h/week vs ${right.commitmentProfile.weeklyAvailabilityHours}h/week · ${formatRunwayBucket(left.commitmentProfile.runwayBucket)} vs ${formatRunwayBucket(right.commitmentProfile.runwayBucket)}`,
    },
    {
      id: "equity",
      title: "Equity philosophy",
      status: left.governancePreferences.equityPhilosophy && right.governancePreferences.equityPhilosophy
        ? left.governancePreferences.equityPhilosophy === right.governancePreferences.equityPhilosophy ? "aligned" : "review"
        : "missing",
      summary: `${formatEquityPhilosophy(left.governancePreferences.equityPhilosophy)} vs ${formatEquityPhilosophy(right.governancePreferences.equityPhilosophy)}`,
    },
    {
      id: "roles",
      title: "Role and scope",
      status: left.roleScope.primaryRole && right.roleScope.primaryRole
        ? roleOverlap ? "review" : "aligned"
        : "missing",
      summary: `${left.roleScope.primaryRole} vs ${right.roleScope.primaryRole}`,
    },
    {
      id: "governance",
      title: "Decision rights",
      status: left.governancePreferences.decisionModelPreference && right.governancePreferences.decisionModelPreference
        ? bothWantLead ? "review" : left.governancePreferences.decisionModelPreference === right.governancePreferences.decisionModelPreference ? "aligned" : "review"
        : "missing",
      summary: `${formatDecisionModelPreference(left.governancePreferences.decisionModelPreference)} · ${formatLeadershipPreference(left.governancePreferences.leadershipPreference)} / ${formatLeadershipPreference(right.governancePreferences.leadershipPreference)}`,
    },
    {
      id: "ip",
      title: "IP readiness",
      status: left.ipReadiness.readyToAssignIp && right.ipReadiness.readyToAssignIp
        ? ipBlocked ? "review" : "aligned"
        : "missing",
      summary: ipBlocked
        ? "One side has confirmed prior obligations that need counsel review."
        : `${left.ipReadiness.existingAssets.length + right.ipReadiness.existingAssets.length} pre-existing asset disclosures logged`,
    },
    {
      id: "communication",
      title: "Communication style",
      status: left.workStylePreferences.length && right.workStylePreferences.length
        ? hasSharedWorkStyle(left, right) ? "aligned" : "review"
        : "missing",
      summary: hasSharedWorkStyle(left, right)
        ? "There is at least one shared operating preference."
        : "No shared work-style preference is obvious yet.",
    },
  ]
}

export function canOpenProposalWorkflow(left: Profile, right: Profile) {
  return buildAlignmentCheck(left, right).every(item => item.status !== "missing")
}

export function getDeclineReasonLabel(reason?: ConnectDeclineReason | null) {
  return reason ? declineReasonLabels[reason] : "No reason recorded"
}

export function buildMessageRiskFlags(input: string) {
  const flags: string[] = []

  if (offPlatformRiskPattern.test(input))
    flags.push("This message contains off-platform or payment language commonly used in scam flows. Stay on CoFoundry until trust is established.")

  if (investorRiskPattern.test(input) && offPlatformRiskPattern.test(input))
    flags.push("Investor-related claims plus an off-platform move is a higher-risk pattern. Verify independently before sharing documents or money.")

  return flags
}

export function buildConversationRiskFlags(messages: Pick<Message, "body">[]) {
  return Array.from(new Set(messages.flatMap(message => buildMessageRiskFlags(message.body))))
}

export function buildOpportunityRiskFlags(opportunity: Pick<StartupOpportunity, "oneLinePitch" | "problem" | "targetUsers" | "traction">) {
  return buildConversationRiskFlags([
    { body: opportunity.oneLinePitch },
    { body: opportunity.problem },
    { body: opportunity.targetUsers },
    { body: opportunity.traction },
  ])
}

export function getOpportunityVerificationTone(status: OpportunityVerificationStatus) {
  return ({
    unverified: "warning",
    owner_verified: "accent",
    domain_verified: "success",
    manual_review: "warning",
  } as const)[status]
}

export function getReportPriority(reason: ReportReason): ReportPriority {
  return highPriorityReportReasons.has(reason) ? "high" : "standard"
}

export function buildTrialStatusCopy(trial: TrialCollaboration) {
  return `${trial.durationWeeks}-week sprint · ${trial.weeklyHours}h/week · next check-in ${formatRelativeDate(trial.nextCheckInAt)}`
}
