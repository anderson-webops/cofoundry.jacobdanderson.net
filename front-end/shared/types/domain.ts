export type AppRole = "founder" | "collaborator" | "admin" | "investor_admin"
export type AuthProvider = "email" | "google" | "github"
export type RemotePreference = "remote" | "hybrid" | "in_person"
export type StartupStage = "idea" | "prototype" | "mvp" | "revenue" | "growth"
export type CompensationPreference = "equity_only" | "cash_and_equity" | "cash_only" | "advisory"
export type CommitmentLevel = "nights_weekends" | "part_time" | "full_time"
export type PrivacyLevel = "public" | "members" | "private"
export type SkillLevel = "working" | "strong" | "expert"
export type ConnectRequestStatus = "pending" | "accepted" | "declined"
export type ConnectDeclineReason = "timing" | "domain_mismatch" | "commitment_mismatch" | "values_mismatch" | "role_mismatch"
export type ConnectRequestNextStep = "intro_call" | "working_session" | "trial_sprint" | "async_exchange"
export type ConnectRequestContext = "profile" | "opportunity"
export type MessageType = "user" | "system"
export type ProposalStatus = "draft" | "sent" | "viewed" | "countered" | "accepted" | "rejected"
export type ProposalRelationshipType = "cofounder" | "founding_team" | "advisor"
export type ProposalSectionKey = "partnership" | "scope" | "trial" | "economics" | "decision_rights" | "ip_confidentiality" | "exit"
export type ProposalSectionState = "proposed" | "countered" | "agreed"
export type ContractStatus = "draft" | "pending_signature" | "signed"
export type SubscriptionPlan = "free" | "pro" | "team"
export type SubscriptionStatus = "inactive" | "trialing" | "active" | "past_due" | "canceled"
export type BillingCycle = "monthly" | "annual"
export type ReportReason = "spam" | "misrepresentation" | "harassment" | "off_platform_solicitation" | "scam_fraud" | "impersonation" | "data_harvesting" | "privacy_violation"
export type ReportStatus = "open" | "reviewed" | "resolved"
export type ReportPriority = "standard" | "high"
export type AdminActionType = "suspend_user" | "reinstate_user" | "warn_user" | "remove_content" | "review_report" | "resolve_report"
export type AdminActionTargetType = "user" | "report" | "profile" | "message" | "opportunity"
export type InvestmentApplicationStatus = "draft" | "submitted" | "under_review" | "accepted" | "declined"
export type NotificationType = "match" | "message" | "proposal" | "contract" | "billing" | "admin"
export type BookmarkTargetType = "profile" | "opportunity"
export type SavedSearchScope = "profiles" | "opportunities"
export type StartTimeline = "immediately" | "30_days" | "90_days" | "exploring"
export type TrialStatus = "draft" | "active" | "completed"
export type ContactRevealStage = "matches" | "proposal_accepted" | "contract_generated"
export type TrustTier = "level_a" | "level_b" | "level_c"
export type OpportunityVerificationMethod = "none" | "work_email" | "domain" | "github_org"
export type OpportunityVerificationStatus = "unverified" | "owner_verified" | "domain_verified" | "manual_review"
export type RunwayBucket = "under_3_months" | "3_to_6_months" | "6_to_12_months" | "12_plus_months" | "undisclosed"
export type CurrentWorkStatus = "full_time_employed" | "consulting_part_time" | "between_roles" | "full_time_on_startup" | "exploring"
export type EquityPhilosophy = "equal_unless_strong_reason" | "contribution_weighted" | "dynamic_over_time"
export type LeadershipPreference = "wants_ceo_role" | "open_to_ceo_role" | "prefers_non_ceo_role"
export type DecisionModelPreference = "ceo_decides_with_input" | "area_owner_decides" | "consensus_for_big_bets"
export type DeadlockPreference = "advisor_tiebreaker" | "rotating_decider" | "board_mediator" | "neutral_operator"
export type PriorObligationStatus = "none_known" | "possible_constraints" | "confirmed_constraints"

export interface SessionUser {
  id: string
  email: string
  name: string
  role: AppRole
  onboardingCompleted: boolean
  subscriptionPlan: SubscriptionPlan
}

export interface AuthAccount {
  email: string
  password: string
  providers: AuthProvider[]
  userId: string
}

export interface User {
  id: string
  email: string
  role: AppRole
  createdAt: string
  linkedProviders: AuthProvider[]
  verifiedEmail: boolean
  onboardingCompleted: boolean
  suspendedAt: string | null
}

export interface ProfilePrivacySettings {
  profileVisibility: PrivacyLevel
  portfolioVisibility: PrivacyLevel
  opportunityVisibility: PrivacyLevel
  contactDetailsVisibleToMatchesOnly: boolean
  contactRevealStage: ContactRevealStage
}

export interface VerificationBadges {
  profileComplete: boolean
  emailVerified: boolean
  linkedAccounts: boolean
}

export interface IntentProfile {
  startTimeline: StartTimeline
  companyPreferences: string[]
  nonNegotiables: string[]
  introCapacity: string
}

export interface CommitmentProfile {
  weeklyAvailabilityHours: number
  fullTimeBy: string
  runwayBucket: RunwayBucket
  currentStatus: CurrentWorkStatus
}

export interface GovernancePreferences {
  equityPhilosophy: EquityPhilosophy
  leadershipPreference: LeadershipPreference
  decisionModelPreference: DecisionModelPreference
  deadlockPreference: DeadlockPreference
}

export interface RoleScopeProfile {
  primaryRole: string
  nonResponsibilities: string[]
  accountabilityMilestones: string[]
}

export interface IpReadinessProfile {
  existingAssets: string[]
  existingAssetsNotes: string
  priorObligations: PriorObligationStatus
  readyToAssignIp: boolean
}

export interface ExternalLinks {
  linkedin: string
  github: string
  portfolio: string
  website: string
}

export interface PortfolioProject {
  id: string
  name: string
  summary: string
  url: string
  role: string
  outcome: string
}

export interface ProofOfWorkArtifact {
  id: string
  title: string
  summary: string
  url: string
  outcome: string
}

export interface TrustSignals {
  replyRatePercent: number
  medianReplyHours: number
  lastActiveAt: string
  identityVerified: boolean
  workHistoryVerified: boolean
  phoneVerified: boolean
  linkedInVerified: boolean
  githubVerified: boolean
  workDomainVerified: boolean
  websiteVerified: boolean
  governmentIdVerified: boolean
  builderProofs: ProofOfWorkArtifact[]
}

export interface AssociatedVentureSummary {
  id: string
  name: string
  role: string
  stage: StartupStage
}

export interface Profile {
  id: string
  userId: string
  displayName: string
  photoUrl: string
  headline: string
  bio: string
  location: string
  remotePreference: RemotePreference
  roles: string[]
  yearsExperience: number
  industries: string[]
  startupStagePreferences: StartupStage[]
  compensationPreferences: CompensationPreference[]
  equityExpectationRange: string
  timeCommitment: CommitmentLevel
  commitmentProfile: CommitmentProfile
  governancePreferences: GovernancePreferences
  roleScope: RoleScopeProfile
  ipReadiness: IpReadinessProfile
  links: ExternalLinks
  hasIdea: boolean
  wantsToJoinIdea: boolean
  values: string[]
  workStylePreferences: string[]
  privacy: ProfilePrivacySettings
  verificationBadges: VerificationBadges
  intent: IntentProfile
  trustSignals: TrustSignals
  availability: string
  portfolio: PortfolioProject[]
  ventures: AssociatedVentureSummary[]
  summaryHighlights: string[]
}

export interface Skill {
  id: string
  label: string
  category: string
}

export interface ProfileSkill {
  id: string
  profileId: string
  skillId: string
  level: SkillLevel
  years: number
}

export interface StartupOpportunity {
  id: string
  ownerUserId: string
  startupName: string
  slug: string
  oneLinePitch: string
  problem: string
  targetUsers: string
  stage: StartupStage
  traction: string
  rolesNeeded: string[]
  expectedCommitment: CommitmentLevel
  compensationStructure: CompensationPreference
  equityRange: string
  industries: string[]
  location: string
  remotePreference: RemotePreference
  officialWebsite: string
  verificationMethod: OpportunityVerificationMethod
  verificationStatus: OpportunityVerificationStatus
  riskFlags: string[]
  createdAt: string
  updatedAt: string
  isOpen: boolean
}

export interface OpportunityRole {
  id: string
  opportunityId: string
  title: string
  summary: string
  skills: string[]
  commitment: CommitmentLevel
  compensationType: CompensationPreference
  equityRange: string
  priority: "core" | "important" | "advisory"
}

export interface Bookmark {
  id: string
  userId: string
  targetType: BookmarkTargetType
  targetId: string
  createdAt: string
}

export interface StructuredIntro {
  context: ConnectRequestContext
  roleContext: string
  whyFit: string
  whyNow: string
  proposedNextStep: ConnectRequestNextStep
}

export interface ConnectRequestPayload {
  note: string
  structuredIntro: StructuredIntro
}

export interface ConnectRequest {
  id: string
  fromUserId: string
  toUserId: string
  note: string
  structuredIntro: StructuredIntro
  status: ConnectRequestStatus
  declineReason: ConnectDeclineReason | null
  createdAt: string
  respondedAt: string | null
}

export interface Match {
  id: string
  participantIds: [string, string]
  source: "connect_request" | "opportunity_interest"
  conversationId: string
  createdAt: string
}

export interface MessageAttachment {
  id: string
  name: string
  url: string
  sizeLabel: string
}

export interface Conversation {
  id: string
  participantIds: string[]
  lastMessageAt: string
  unreadCountByUser: Record<string, number>
  typingByUserIds: string[]
}

export interface Message {
  id: string
  conversationId: string
  senderUserId: string | null
  type: MessageType
  body: string
  attachments: MessageAttachment[]
  createdAt: string
}

export interface Proposal {
  id: string
  conversationId: string
  opportunityId: string | null
  createdByUserId: string
  recipientUserId: string
  title: string
  currentVersionId: string
  status: ProposalStatus
  createdAt: string
  updatedAt: string
}

export interface ProposalVersion {
  id: string
  proposalId: string
  versionNumber: number
  relationshipType: ProposalRelationshipType
  roleTitle: string
  responsibilities: string[]
  weeklyTimeCommitment: number
  startDate: string
  fullTimeTrigger: string
  ceoDecision: string
  trialScope: string
  trialIpHandling: string
  cashCompensation: string
  equity: string
  vestingSchedule: string
  cliff: string
  decisionRights: string
  ipAssignmentRequired: boolean
  confidentiality: string
  exitTerms: string
  notes: string
  summary: string
  createdByUserId: string
  createdAt: string
}

export interface ProposalComment {
  id: string
  proposalId: string
  proposalVersionId: string
  authorUserId: string
  section: ProposalSectionKey
  body: string
  createdAt: string
}

export interface ProposalPayload {
  relationshipType: ProposalRelationshipType
  roleTitle: string
  responsibilities: string[]
  weeklyTimeCommitment: number
  startDate: string
  fullTimeTrigger: string
  ceoDecision: string
  trialScope: string
  trialIpHandling: string
  cashCompensation: string
  equity: string
  vestingSchedule: string
  cliff: string
  decisionRights: string
  ipAssignmentRequired: boolean
  confidentiality: string
  exitTerms: string
  notes: string
}

export interface Contract {
  id: string
  proposalId: string
  title: string
  status: ContractStatus
  currentVersionId: string
  disclaimerAcknowledged: boolean
  createdAt: string
  updatedAt: string
}

export interface ContractVersion {
  id: string
  contractId: string
  versionNumber: number
  parties: string[]
  roleTitle: string
  scope: string
  timeCommitment: string
  compensation: string
  equity: string
  vesting: string
  ipAssignment: string
  confidentiality: string
  decisionMaking: string
  termination: string
  disputeResolution: string
  notes: string
  generatedFromProposalVersionId: string | null
  createdAt: string
}

export interface Signature {
  id: string
  contractId: string
  contractVersionId: string
  userId: string
  typedName: string
  signedAt: string
}

export interface TrialCollaboration {
  id: string
  matchId: string
  createdByUserId: string
  title: string
  objective: string
  scope: string
  weeklyHours: number
  durationWeeks: number
  checkInCadence: string
  deliverables: string[]
  successSignals: string[]
  status: TrialStatus
  acknowledgedByUserIds: string[]
  nextCheckInAt: string
  createdAt: string
  updatedAt: string
}

export interface Subscription {
  id: string
  userId: string
  plan: SubscriptionPlan
  status: SubscriptionStatus
  billingCycle: BillingCycle
  renewsAt: string | null
  cancelAtPeriodEnd: boolean
  visibilityBoost: boolean
  unlimitedMessaging: boolean
  proposalWorkflow: boolean
  contractBuilder: boolean
}

export interface Report {
  id: string
  reporterUserId: string
  targetType: "profile" | "message" | "opportunity"
  targetId: string
  reason: ReportReason
  priority: ReportPriority
  details: string
  status: ReportStatus
  reviewNotes: string | null
  reviewedAt: string | null
  reviewedByUserId: string | null
  resolutionNotes: string | null
  resolvedAt: string | null
  resolvedByUserId: string | null
  createdAt: string
}

export interface AdminAction {
  id: string
  adminUserId: string
  type: AdminActionType
  targetId: string
  targetType: AdminActionTargetType
  notes: string
  createdAt: string
}

export interface InvestmentApplication {
  id: string
  opportunityId: string
  applicantUserId: string
  status: InvestmentApplicationStatus
  raiseAmount: string
  traction: string
  deckLink: string
  teamSummary: string
  reason: string
  createdAt: string
}

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  title: string
  body: string
  href: string
  readAt: string | null
  createdAt: string
}

export interface SearchFilters {
  query: string
  roles: string[]
  skills: string[]
  industries: string[]
  location: string
  remotePreference: RemotePreference | "any"
  stage: StartupStage | "any"
  timeCommitment: CommitmentLevel | "any"
  compensationType: CompensationPreference | "any"
  minimumWeeklyHours: string
  runwayBucket: RunwayBucket | "any"
  equityPhilosophy: EquityPhilosophy | "any"
  equityExpectationRange: string
}

export interface SavedSearch {
  id: string
  userId: string
  label: string
  scope: SavedSearchScope
  filters: SearchFilters
  createdAt: string
}

export interface MemberWorkspaceState {
  user: User
  profile: Profile
  subscription: Subscription
  opportunities: StartupOpportunity[]
  bookmarks: Bookmark[]
  savedSearches: SavedSearch[]
}

export interface MemberWorkspaceWritePayload {
  onboardingCompleted: boolean
  profile: Profile
  opportunities: StartupOpportunity[]
  bookmarks: Bookmark[]
  savedSearches: SavedSearch[]
}

export interface WorkspaceSeed {
  version: string
  users: User[]
  profiles: Profile[]
  skills: Skill[]
  profileSkills: ProfileSkill[]
  opportunities: StartupOpportunity[]
  opportunityRoles: OpportunityRole[]
  bookmarks: Bookmark[]
  connectRequests: ConnectRequest[]
  matches: Match[]
  conversations: Conversation[]
  messages: Message[]
  proposals: Proposal[]
  proposalVersions: ProposalVersion[]
  proposalComments: ProposalComment[]
  contracts: Contract[]
  contractVersions: ContractVersion[]
  signatures: Signature[]
  trialCollaborations: TrialCollaboration[]
  subscriptions: Subscription[]
  reports: Report[]
  adminActions: AdminAction[]
  investmentApplications: InvestmentApplication[]
  notifications: Notification[]
  savedSearches: SavedSearch[]
  authAccounts: AuthAccount[]
}

export interface PricingTier {
  id: SubscriptionPlan
  name: string
  priceLabel: string
  description: string
  ctaLabel: string
  highlighted: boolean
  features: string[]
}

export interface Testimonial {
  id: string
  quote: string
  author: string
  role: string
  company: string
}

export interface MarketingStat {
  label: string
  value: string
  context: string
}
