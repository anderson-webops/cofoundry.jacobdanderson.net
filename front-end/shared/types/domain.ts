export type AppRole = "founder" | "collaborator" | "admin" | "investor_admin"
export type AuthProvider = "email" | "google" | "github"
export type RemotePreference = "remote" | "hybrid" | "in_person"
export type StartupStage = "idea" | "prototype" | "mvp" | "revenue" | "growth"
export type CompensationPreference = "equity_only" | "cash_and_equity" | "cash_only" | "advisory"
export type CommitmentLevel = "nights_weekends" | "part_time" | "full_time"
export type PrivacyLevel = "public" | "members" | "private"
export type SkillLevel = "working" | "strong" | "expert"
export type ConnectRequestStatus = "pending" | "accepted" | "declined"
export type MessageType = "user" | "system"
export type ProposalStatus = "draft" | "sent" | "viewed" | "countered" | "accepted" | "rejected"
export type ContractStatus = "draft" | "pending_signature" | "signed"
export type SubscriptionPlan = "free" | "pro" | "team"
export type SubscriptionStatus = "inactive" | "trialing" | "active" | "past_due" | "canceled"
export type BillingCycle = "monthly" | "annual"
export type ReportReason = "spam" | "misrepresentation" | "harassment" | "off_platform_solicitation"
export type ReportStatus = "open" | "reviewed" | "resolved"
export type AdminActionType = "suspend_user" | "reinstate_user" | "warn_user" | "remove_content" | "resolve_report"
export type InvestmentApplicationStatus = "draft" | "submitted" | "under_review" | "accepted" | "declined"
export type NotificationType = "match" | "message" | "proposal" | "contract" | "billing" | "admin"
export type BookmarkTargetType = "profile" | "opportunity"
export type SavedSearchScope = "profiles" | "opportunities"

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
}

export interface VerificationBadges {
  profileComplete: boolean
  emailVerified: boolean
  linkedAccounts: boolean
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
  links: ExternalLinks
  hasIdea: boolean
  wantsToJoinIdea: boolean
  values: string[]
  workStylePreferences: string[]
  privacy: ProfilePrivacySettings
  verificationBadges: VerificationBadges
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

export interface ConnectRequest {
  id: string
  fromUserId: string
  toUserId: string
  note: string
  status: ConnectRequestStatus
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
  roleTitle: string
  responsibilities: string[]
  weeklyTimeCommitment: number
  startDate: string
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
  section: string
  body: string
  createdAt: string
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

export interface Subscription {
  id: string
  userId: string
  plan: SubscriptionPlan
  status: SubscriptionStatus
  billingCycle: BillingCycle
  renewsAt: string | null
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
  details: string
  status: ReportStatus
  createdAt: string
}

export interface AdminAction {
  id: string
  adminUserId: string
  type: AdminActionType
  targetId: string
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
