import type { ContractLegalReviewerType, ContractLegalReviewScope, ContractLegalReviewStatus, SearchFilters, StartupStage } from "./domain"

export type OrganizationKind = "startup_team" | "venture_studio"
export type OrganizationStatus = "active" | "archived"
export type OrganizationMemberRole = "owner" | "operator" | "member" | "reviewer" | "billing" | "counsel"
export type OrganizationInvitationStatus = "pending" | "accepted" | "declined" | "revoked" | "expired"
export type OrganizationVentureStatus = "incubating" | "active" | "paused" | "graduated" | "archived"
export type OrganizationProjectStatus = "planned" | "active" | "blocked" | "completed" | "archived"
export type OrganizationTaskStatus = "todo" | "in_progress" | "blocked" | "done"
export type OrganizationDecisionStatus = "proposed" | "approved" | "superseded"
export type OrganizationApprovalStatus = "pending" | "approved" | "changes_requested" | "rejected" | "canceled"
export type OrganizationApprovalTargetType = "contract" | "proposal" | "venture" | "project" | "opportunity" | "investment_application" | "policy_exception"
export type OrganizationResourceType = "relationship" | "proposal" | "contract" | "opportunity" | "investment_application"

export interface Organization {
  id: string
  name: string
  slug: string
  kind: OrganizationKind
  status: OrganizationStatus
  description: string
  website: string
  ownerUserId: string
  billingOwnerUserId: string
  seatLimit: number
  dataRetentionDays: number
  allowOperatorInvites: boolean
  createdAt: string
  updatedAt: string
}

export interface OrganizationMembership {
  id: string
  organizationId: string
  userId: string
  email: string
  displayName: string
  title: string
  role: OrganizationMemberRole
  joinedAt: string
  createdAt: string
  updatedAt: string
}

export interface OrganizationInvitation {
  id: string
  organizationId: string
  email: string
  displayName: string
  title: string
  role: Exclude<OrganizationMemberRole, "owner">
  status: OrganizationInvitationStatus
  invitedByUserId: string
  expiresAt: string
  respondedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface OrganizationVenture {
  id: string
  organizationId: string
  opportunityId: string | null
  name: string
  summary: string
  stage: StartupStage
  status: OrganizationVentureStatus
  leadUserId: string | null
  createdAt: string
  updatedAt: string
}

export interface OrganizationProject {
  id: string
  organizationId: string
  ventureId: string | null
  title: string
  description: string
  status: OrganizationProjectStatus
  ownerUserId: string | null
  dueAt: string | null
  createdAt: string
  updatedAt: string
}

export interface OrganizationTask {
  id: string
  organizationId: string
  projectId: string
  title: string
  status: OrganizationTaskStatus
  assigneeUserId: string | null
  dueAt: string | null
  createdByUserId: string
  createdAt: string
  updatedAt: string
}

export interface OrganizationDecision {
  id: string
  organizationId: string
  ventureId: string | null
  projectId: string | null
  title: string
  context: string
  decision: string
  status: OrganizationDecisionStatus
  ownerUserId: string
  approvedByUserId: string | null
  decidedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface OrganizationAgreementPolicy {
  id: string
  organizationId: string
  name: string
  description: string
  requiredClauses: string[]
  requiresInternalApproval: boolean
  requiresLegalReview: boolean
  allowOutsideCounsel: boolean
  approvalRoles: OrganizationMemberRole[]
  separationOfDuties: boolean
  isDefault: boolean
  createdByUserId: string
  createdAt: string
  updatedAt: string
}

export interface OrganizationApprovalRequest {
  id: string
  organizationId: string
  targetType: OrganizationApprovalTargetType
  targetId: string
  targetVersionId: string | null
  policyId: string | null
  title: string
  summary: string
  status: OrganizationApprovalStatus
  requestedByUserId: string
  decidedByUserId: string | null
  decisionNote: string | null
  decidedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface OrganizationSharedSearch {
  id: string
  organizationId: string
  sourceSavedSearchId: string | null
  label: string
  scope: "profiles" | "opportunities"
  filters: SearchFilters
  sharedByUserId: string
  createdAt: string
  updatedAt: string
}

export interface OrganizationResourceLink {
  id: string
  organizationId: string
  resourceType: OrganizationResourceType
  resourceId: string
  label: string
  policyId: string | null
  linkedByUserId: string
  createdAt: string
  updatedAt: string
}

export interface OrganizationAuditEvent {
  id: string
  organizationId: string
  actorUserId: string
  action: string
  targetType: string
  targetId: string
  summary: string
  createdAt: string
}

export interface OrganizationWorkspaceDocument {
  version: number
  organization: Organization
  memberships: OrganizationMembership[]
  invitations: OrganizationInvitation[]
  ventures: OrganizationVenture[]
  projects: OrganizationProject[]
  tasks: OrganizationTask[]
  decisions: OrganizationDecision[]
  agreementPolicies: OrganizationAgreementPolicy[]
  approvalRequests: OrganizationApprovalRequest[]
  sharedSearches: OrganizationSharedSearch[]
  resourceLinks: OrganizationResourceLink[]
  auditEvents: OrganizationAuditEvent[]
}

export interface OrganizationLegalReviewQueueItem {
  id: string
  organizationId: string
  contractId: string
  contractVersionId: string
  reviewerType: ContractLegalReviewerType
  reviewerName: string
  reviewerOrganization: string
  scope: ContractLegalReviewScope[]
  status: ContractLegalReviewStatus
  requestedByUserId: string
  createdAt: string
  expiresAt: string
  reviewUrl: string
}

export interface OrganizationWorkspaceSnapshot {
  workspaces: OrganizationWorkspaceDocument[]
  legalReviewQueue: OrganizationLegalReviewQueueItem[]
}

export type OrganizationMutation
  = | { action: "update_organization", description: string, name: string, website: string }
    | { action: "update_settings", allowOperatorInvites: boolean, dataRetentionDays: number, seatLimit: number }
    | { action: "archive_organization" }
    | { action: "invite_member", displayName: string, email: string, role: Exclude<OrganizationMemberRole, "owner">, title: string }
    | { action: "respond_invitation", invitationId: string, response: "accepted" | "declined" }
    | { action: "revoke_invitation", invitationId: string }
    | { action: "update_member", membershipId: string, role: Exclude<OrganizationMemberRole, "owner">, title: string }
    | { action: "remove_member", membershipId: string }
    | { action: "transfer_ownership", membershipId: string }
    | { action: "create_venture", leadUserId: string | null, name: string, opportunityId: string | null, stage: StartupStage, summary: string }
    | { action: "update_venture", leadUserId: string | null, stage: StartupStage, status: OrganizationVentureStatus, summary: string, ventureId: string }
    | { action: "create_project", description: string, dueAt: string | null, ownerUserId: string | null, title: string, ventureId: string | null }
    | { action: "update_project", description: string, dueAt: string | null, ownerUserId: string | null, projectId: string, status: OrganizationProjectStatus, title: string }
    | { action: "create_task", assigneeUserId: string | null, dueAt: string | null, projectId: string, title: string }
    | { action: "update_task", assigneeUserId: string | null, dueAt: string | null, status: OrganizationTaskStatus, taskId: string, title: string }
    | { action: "create_decision", context: string, decision: string, ownerUserId: string, projectId: string | null, title: string, ventureId: string | null }
    | { action: "resolve_decision", decisionId: string, decision: string, status: "approved" | "superseded" }
    | { action: "create_policy", allowOutsideCounsel: boolean, approvalRoles: OrganizationMemberRole[], description: string, isDefault: boolean, name: string, requiredClauses: string[], requiresInternalApproval: boolean, requiresLegalReview: boolean, separationOfDuties: boolean }
    | { action: "update_policy", allowOutsideCounsel: boolean, approvalRoles: OrganizationMemberRole[], description: string, isDefault: boolean, name: string, policyId: string, requiredClauses: string[], requiresInternalApproval: boolean, requiresLegalReview: boolean, separationOfDuties: boolean }
    | { action: "request_approval", policyId: string | null, summary: string, targetId: string, targetType: OrganizationApprovalTargetType, targetVersionId: string | null, title: string }
    | { action: "resolve_approval", approvalId: string, decisionNote: string, status: "approved" | "changes_requested" | "rejected" }
    | { action: "cancel_approval", approvalId: string }
    | { action: "share_search", filters: SearchFilters, label: string, scope: "profiles" | "opportunities", sourceSavedSearchId: string | null }
    | { action: "remove_shared_search", sharedSearchId: string }
    | { action: "link_resource", label: string, policyId: string | null, resourceId: string, resourceType: OrganizationResourceType }
    | { action: "unlink_resource", resourceLinkId: string }

export interface OrganizationMutationEnvelope {
  expectedVersion: number
  mutation: OrganizationMutation
}

export interface OrganizationContractGovernanceRequirement {
  organizationId: string
  organizationName: string
  policyId: string
  policyName: string
  requiresInternalApproval: boolean
  requiresLegalReview: boolean
  allowOutsideCounsel: boolean
  approvalStatus: OrganizationApprovalStatus | "missing"
  approvedLegalReview: boolean
  blockers: string[]
}
