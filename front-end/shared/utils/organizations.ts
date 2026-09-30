import type { SessionUser } from "../types/domain"
import type {
  Organization,
  OrganizationAgreementPolicy,
  OrganizationApprovalRequest,
  OrganizationContractGovernanceRequirement,
  OrganizationMemberRole,
  OrganizationMembership,
  OrganizationMutation,
  OrganizationWorkspaceDocument,
} from "../types/organizations"
import { cloneValue } from "./clone"

export class OrganizationTransitionError extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message)
    this.name = "OrganizationTransitionError"
  }
}

interface TransitionOptions {
  createId: (prefix: string) => string
  now: string
}

interface CreateOrganizationInput {
  description: string
  kind: Organization["kind"]
  name: string
  slug: string
  website: string
}

const operatorRoles = new Set<OrganizationMemberRole>(["owner", "operator"])
const workingRoles = new Set<OrganizationMemberRole>(["owner", "operator", "member"])
const reviewingRoles = new Set<OrganizationMemberRole>(["owner", "operator", "reviewer", "counsel"])
const policyRoles = new Set<OrganizationMemberRole>(["owner", "operator", "counsel"])

function fail(message: string, statusCode = 400): never {
  throw new OrganizationTransitionError(message, statusCode)
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function activeMembership(document: OrganizationWorkspaceDocument, userId: string) {
  return document.memberships.find(membership => membership.userId === userId) || null
}

function requireMembership(document: OrganizationWorkspaceDocument, userId: string) {
  const membership = activeMembership(document, userId)
  if (!membership)
    fail("You are not an active member of this organization.", 403)
  return membership
}

function requireRole(membership: OrganizationMembership, roles: ReadonlySet<OrganizationMemberRole>, message: string) {
  if (!roles.has(membership.role))
    fail(message, 403)
}

function requireActiveOrganization(document: OrganizationWorkspaceDocument) {
  if (document.organization.status !== "active")
    fail("This organization is archived and cannot accept new changes.", 409)
}

function assertMemberReference(document: OrganizationWorkspaceDocument, userId: string | null, label: string) {
  if (userId && !activeMembership(document, userId))
    fail(`${label} must be an active organization member.`)
}

function audit(
  document: OrganizationWorkspaceDocument,
  actorUserId: string,
  action: string,
  targetType: string,
  targetId: string,
  summary: string,
  options: TransitionOptions,
) {
  document.auditEvents.unshift({
    action,
    actorUserId,
    createdAt: options.now,
    id: options.createId("organization_audit"),
    organizationId: document.organization.id,
    summary,
    targetId,
    targetType,
  })
  document.auditEvents = document.auditEvents.slice(0, 1000)
}

function finish(document: OrganizationWorkspaceDocument, options: TransitionOptions) {
  document.version += 1
  document.organization.updatedAt = options.now
  const auditCutoff = new Date(options.now).getTime() - document.organization.dataRetentionDays * 24 * 60 * 60 * 1000
  document.auditEvents = document.auditEvents.filter(event => new Date(event.createdAt).getTime() >= auditCutoff).slice(0, 1000)
  return document
}

function updateDefaultPolicy(document: OrganizationWorkspaceDocument, selectedPolicyId: string, updatedAt: string) {
  document.agreementPolicies = document.agreementPolicies.map(policy => ({
    ...policy,
    isDefault: policy.id === selectedPolicyId,
    updatedAt: policy.id === selectedPolicyId || policy.isDefault ? updatedAt : policy.updatedAt,
  }))
}

function getPolicy(document: OrganizationWorkspaceDocument, policyId: string | null) {
  if (!policyId)
    return null
  return document.agreementPolicies.find(policy => policy.id === policyId) || null
}

function requirePolicy(document: OrganizationWorkspaceDocument, policyId: string) {
  const policy = getPolicy(document, policyId)
  if (!policy)
    fail("The selected agreement policy is no longer available.", 404)
  return policy
}

function linkedAgreementPolicy(document: OrganizationWorkspaceDocument, policyId: string | null) {
  return policyId
    ? getPolicy(document, policyId)
    : document.agreementPolicies.find(policy => policy.isDefault) || null
}

function validateApprovalRoles(roles: OrganizationMemberRole[]) {
  const allowed = roles.filter(role => reviewingRoles.has(role))
  if (!allowed.length)
    fail("Choose at least one owner, operator, reviewer, or counsel approval role.")
  return Array.from(new Set(allowed))
}

function approvalPolicy(document: OrganizationWorkspaceDocument, approval: OrganizationApprovalRequest) {
  return approval.policyId ? getPolicy(document, approval.policyId) : null
}

export function createOrganizationWorkspaceDocument(
  session: SessionUser,
  input: CreateOrganizationInput,
  options: TransitionOptions,
): OrganizationWorkspaceDocument {
  const organizationId = options.createId("organization")
  const membershipId = options.createId("organization_membership")
  const organization: Organization = {
    allowOperatorInvites: true,
    billingOwnerUserId: session.id,
    createdAt: options.now,
    dataRetentionDays: 365,
    description: input.description,
    id: organizationId,
    kind: input.kind,
    name: input.name,
    ownerUserId: session.id,
    seatLimit: input.kind === "venture_studio" ? 25 : 12,
    slug: input.slug,
    status: "active",
    updatedAt: options.now,
    website: input.website,
  }
  const defaultPolicyId = options.createId("organization_policy")
  const document: OrganizationWorkspaceDocument = {
    agreementPolicies: [{
      allowOutsideCounsel: true,
      approvalRoles: ["owner", "operator", "reviewer", "counsel"],
      createdAt: options.now,
      createdByUserId: session.id,
      description: "Standard approval and legal-review controls for founder agreements.",
      id: defaultPolicyId,
      isDefault: true,
      name: "Founder agreement review",
      organizationId,
      requiredClauses: ["Roles and scope", "Equity and vesting", "IP assignment", "Decision rights", "Exit and termination"],
      requiresInternalApproval: true,
      requiresLegalReview: false,
      separationOfDuties: true,
      updatedAt: options.now,
    }],
    approvalRequests: [],
    auditEvents: [],
    decisions: [],
    invitations: [],
    memberships: [{
      createdAt: options.now,
      displayName: session.name,
      email: normalizeEmail(session.email),
      id: membershipId,
      joinedAt: options.now,
      organizationId,
      role: "owner",
      title: "Owner",
      updatedAt: options.now,
      userId: session.id,
    }],
    organization,
    projects: [],
    resourceLinks: [],
    sharedSearches: [],
    tasks: [],
    ventures: [],
    version: 1,
  }
  audit(document, session.id, "organization.created", "organization", organizationId, `${session.name} created ${organization.name}.`, options)
  return document
}

export function projectOrganizationWorkspaceForSession(
  source: OrganizationWorkspaceDocument,
  session: Pick<SessionUser, "email" | "id">,
  now = new Date().toISOString(),
) {
  const document = cloneValue(source)
  const membership = activeMembership(document, session.id)
  const email = normalizeEmail(session.email)
  const ownInvitations = document.invitations.filter(invitation => invitation.email === email && invitation.status === "pending")
    .map(invitation => new Date(invitation.expiresAt).getTime() <= new Date(now).getTime()
      ? { ...invitation, status: "expired" as const }
      : invitation)

  if (!membership) {
    if (!ownInvitations.length)
      return null

    return {
      ...document,
      agreementPolicies: [],
      approvalRequests: [],
      auditEvents: [],
      decisions: [],
      invitations: ownInvitations,
      memberships: [],
      projects: [],
      resourceLinks: [],
      sharedSearches: [],
      tasks: [],
      ventures: [],
    }
  }

  if (!operatorRoles.has(membership.role))
    document.invitations = ownInvitations

  if (!["owner", "operator", "billing"].includes(membership.role)) {
    document.organization.billingOwnerUserId = ""
    document.organization.dataRetentionDays = 0
  }

  return document
}

export function applyOrganizationMutation(
  source: OrganizationWorkspaceDocument,
  session: SessionUser,
  mutation: OrganizationMutation,
  options: TransitionOptions,
) {
  const document = cloneValue(source)
  const membership = activeMembership(document, session.id)

  if (mutation.action === "respond_invitation") {
    const invitation = document.invitations.find(item => item.id === mutation.invitationId)
    if (!invitation || invitation.status !== "pending" || normalizeEmail(invitation.email) !== normalizeEmail(session.email))
      fail("This invitation is no longer available.", 404)
    if (new Date(invitation.expiresAt).getTime() <= new Date(options.now).getTime())
      fail("This invitation has expired. Ask an organization owner for a new invitation.", 409)

    invitation.status = mutation.response
    invitation.respondedAt = options.now
    invitation.updatedAt = options.now
    if (mutation.response === "accepted") {
      if (!activeMembership(document, session.id)) {
        document.memberships.push({
          createdAt: options.now,
          displayName: invitation.displayName || session.name,
          email: normalizeEmail(session.email),
          id: options.createId("organization_membership"),
          joinedAt: options.now,
          organizationId: document.organization.id,
          role: invitation.role,
          title: invitation.title,
          updatedAt: options.now,
          userId: session.id,
        })
      }
      audit(document, session.id, "invitation.accepted", "organization_invitation", invitation.id, `${session.name} joined the organization.`, options)
    }
    else {
      audit(document, session.id, "invitation.declined", "organization_invitation", invitation.id, `${session.name} declined an organization invitation.`, options)
    }
    return finish(document, options)
  }

  if (!membership)
    fail("You are not an active member of this organization.", 403)

  if (mutation.action !== "archive_organization")
    requireActiveOrganization(document)

  switch (mutation.action) {
    case "update_organization": {
      requireRole(membership, operatorRoles, "Only an owner or operator can update organization details.")
      document.organization.name = mutation.name
      document.organization.description = mutation.description
      document.organization.website = mutation.website
      audit(document, session.id, "organization.updated", "organization", document.organization.id, `${session.name} updated organization details.`, options)
      break
    }
    case "update_settings": {
      requireRole(membership, new Set(["owner"]), "Only the organization owner can change seat and retention controls.")
      if (mutation.seatLimit < document.memberships.length)
        fail("The seat limit cannot be lower than the current active member count.", 409)
      document.organization.allowOperatorInvites = mutation.allowOperatorInvites
      document.organization.dataRetentionDays = mutation.dataRetentionDays
      document.organization.seatLimit = mutation.seatLimit
      audit(document, session.id, "organization.settings_updated", "organization", document.organization.id, `${session.name} updated seat and retention controls.`, options)
      break
    }
    case "archive_organization": {
      requireRole(membership, new Set(["owner"]), "Only the organization owner can archive this workspace.")
      document.organization.status = "archived"
      audit(document, session.id, "organization.archived", "organization", document.organization.id, `${session.name} archived the organization workspace.`, options)
      break
    }
    case "invite_member": {
      const canInvite = membership.role === "owner" || (membership.role === "operator" && document.organization.allowOperatorInvites)
      if (!canInvite)
        fail("Only an owner or authorized operator can invite members.", 403)
      const email = normalizeEmail(mutation.email)
      const pendingInvitations = document.invitations.filter(invitation => invitation.status === "pending" && new Date(invitation.expiresAt).getTime() > new Date(options.now).getTime())
      if (document.memberships.length + pendingInvitations.length >= document.organization.seatLimit)
        fail("This invitation would exceed the organization seat limit.", 409)
      if (document.memberships.some(item => normalizeEmail(item.email) === email))
        fail("That email already belongs to an active organization member.", 409)
      if (pendingInvitations.some(item => normalizeEmail(item.email) === email))
        fail("A pending invitation already exists for that email.", 409)
      const invitationId = options.createId("organization_invitation")
      document.invitations.unshift({
        createdAt: options.now,
        displayName: mutation.displayName,
        email,
        expiresAt: new Date(new Date(options.now).getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        id: invitationId,
        invitedByUserId: session.id,
        organizationId: document.organization.id,
        respondedAt: null,
        role: mutation.role,
        status: "pending",
        title: mutation.title,
        updatedAt: options.now,
      })
      audit(document, session.id, "invitation.created", "organization_invitation", invitationId, `${session.name} invited ${email} as ${mutation.role}.`, options)
      break
    }
    case "revoke_invitation": {
      requireRole(membership, operatorRoles, "Only an owner or operator can revoke invitations.")
      const invitation = document.invitations.find(item => item.id === mutation.invitationId)
      if (!invitation || invitation.status !== "pending")
        fail("This invitation is no longer pending.", 409)
      invitation.status = "revoked"
      invitation.respondedAt = options.now
      invitation.updatedAt = options.now
      audit(document, session.id, "invitation.revoked", "organization_invitation", invitation.id, `${session.name} revoked the invitation for ${invitation.email}.`, options)
      break
    }
    case "update_member": {
      requireRole(membership, new Set(["owner"]), "Only the organization owner can change member roles.")
      const target = document.memberships.find(item => item.id === mutation.membershipId)
      if (!target)
        fail("Organization member not found.", 404)
      if (target.role === "owner")
        fail("Transfer ownership before changing the owner's role.", 409)
      target.role = mutation.role
      target.title = mutation.title
      target.updatedAt = options.now
      audit(document, session.id, "membership.updated", "organization_membership", target.id, `${session.name} changed ${target.displayName}'s organization role.`, options)
      break
    }
    case "remove_member": {
      requireRole(membership, new Set(["owner"]), "Only the organization owner can remove members.")
      const target = document.memberships.find(item => item.id === mutation.membershipId)
      if (!target)
        fail("Organization member not found.", 404)
      if (target.role === "owner")
        fail("Transfer ownership before removing the owner.", 409)
      document.memberships = document.memberships.filter(item => item.id !== target.id)
      document.tasks = document.tasks.map(task => task.assigneeUserId === target.userId ? { ...task, assigneeUserId: null, updatedAt: options.now } : task)
      document.projects = document.projects.map(project => project.ownerUserId === target.userId ? { ...project, ownerUserId: null, updatedAt: options.now } : project)
      document.ventures = document.ventures.map(venture => venture.leadUserId === target.userId ? { ...venture, leadUserId: null, updatedAt: options.now } : venture)
      audit(document, session.id, "membership.removed", "organization_membership", target.id, `${session.name} removed ${target.displayName} from the organization.`, options)
      break
    }
    case "transfer_ownership": {
      requireRole(membership, new Set(["owner"]), "Only the current owner can transfer ownership.")
      const target = document.memberships.find(item => item.id === mutation.membershipId)
      if (!target || target.userId === session.id)
        fail("Choose another active member to become the owner.")
      const currentOwner = document.memberships.find(item => item.userId === document.organization.ownerUserId)
      if (!currentOwner)
        fail("The current owner membership is unavailable.", 409)
      currentOwner.role = "operator"
      currentOwner.updatedAt = options.now
      target.role = "owner"
      target.updatedAt = options.now
      document.organization.ownerUserId = target.userId
      if (document.organization.billingOwnerUserId === session.id)
        document.organization.billingOwnerUserId = target.userId
      audit(document, session.id, "ownership.transferred", "organization_membership", target.id, `${session.name} transferred ownership to ${target.displayName}.`, options)
      break
    }
    case "create_venture": {
      requireRole(membership, operatorRoles, "Only an owner or operator can add portfolio ventures.")
      assertMemberReference(document, mutation.leadUserId, "Venture lead")
      const ventureId = options.createId("organization_venture")
      document.ventures.unshift({
        createdAt: options.now,
        id: ventureId,
        leadUserId: mutation.leadUserId,
        name: mutation.name,
        opportunityId: mutation.opportunityId,
        organizationId: document.organization.id,
        stage: mutation.stage,
        status: "incubating",
        summary: mutation.summary,
        updatedAt: options.now,
      })
      audit(document, session.id, "venture.created", "organization_venture", ventureId, `${session.name} added ${mutation.name} to the portfolio.`, options)
      break
    }
    case "update_venture": {
      requireRole(membership, operatorRoles, "Only an owner or operator can update portfolio ventures.")
      assertMemberReference(document, mutation.leadUserId, "Venture lead")
      const venture = document.ventures.find(item => item.id === mutation.ventureId)
      if (!venture)
        fail("Portfolio venture not found.", 404)
      venture.leadUserId = mutation.leadUserId
      venture.stage = mutation.stage
      venture.status = mutation.status
      venture.summary = mutation.summary
      venture.updatedAt = options.now
      audit(document, session.id, "venture.updated", "organization_venture", venture.id, `${session.name} updated ${venture.name}.`, options)
      break
    }
    case "create_project": {
      requireRole(membership, workingRoles, "Your organization role cannot create projects.")
      assertMemberReference(document, mutation.ownerUserId, "Project owner")
      if (mutation.ventureId && !document.ventures.some(venture => venture.id === mutation.ventureId))
        fail("The selected portfolio venture is unavailable.", 404)
      const projectId = options.createId("organization_project")
      document.projects.unshift({
        createdAt: options.now,
        description: mutation.description,
        dueAt: mutation.dueAt,
        id: projectId,
        organizationId: document.organization.id,
        ownerUserId: mutation.ownerUserId,
        status: "planned",
        title: mutation.title,
        updatedAt: options.now,
        ventureId: mutation.ventureId,
      })
      audit(document, session.id, "project.created", "organization_project", projectId, `${session.name} created project ${mutation.title}.`, options)
      break
    }
    case "update_project": {
      requireRole(membership, workingRoles, "Your organization role cannot update projects.")
      assertMemberReference(document, mutation.ownerUserId, "Project owner")
      const project = document.projects.find(item => item.id === mutation.projectId)
      if (!project)
        fail("Project not found.", 404)
      project.description = mutation.description
      project.dueAt = mutation.dueAt
      project.ownerUserId = mutation.ownerUserId
      project.status = mutation.status
      project.title = mutation.title
      project.updatedAt = options.now
      audit(document, session.id, "project.updated", "organization_project", project.id, `${session.name} updated project ${project.title}.`, options)
      break
    }
    case "create_task": {
      requireRole(membership, workingRoles, "Your organization role cannot create tasks.")
      assertMemberReference(document, mutation.assigneeUserId, "Task assignee")
      if (!document.projects.some(project => project.id === mutation.projectId))
        fail("The selected project is unavailable.", 404)
      const taskId = options.createId("organization_task")
      document.tasks.unshift({
        assigneeUserId: mutation.assigneeUserId,
        createdAt: options.now,
        createdByUserId: session.id,
        dueAt: mutation.dueAt,
        id: taskId,
        organizationId: document.organization.id,
        projectId: mutation.projectId,
        status: "todo",
        title: mutation.title,
        updatedAt: options.now,
      })
      audit(document, session.id, "task.created", "organization_task", taskId, `${session.name} created task ${mutation.title}.`, options)
      break
    }
    case "update_task": {
      requireRole(membership, workingRoles, "Your organization role cannot update tasks.")
      assertMemberReference(document, mutation.assigneeUserId, "Task assignee")
      const task = document.tasks.find(item => item.id === mutation.taskId)
      if (!task)
        fail("Task not found.", 404)
      const ownsTask = task.assigneeUserId === session.id || task.createdByUserId === session.id
      if (!ownsTask && !operatorRoles.has(membership.role))
        fail("Only the task assignee, creator, owner, or operator can update this task.", 403)
      task.assigneeUserId = mutation.assigneeUserId
      task.dueAt = mutation.dueAt
      task.status = mutation.status
      task.title = mutation.title
      task.updatedAt = options.now
      audit(document, session.id, "task.updated", "organization_task", task.id, `${session.name} updated task ${task.title}.`, options)
      break
    }
    case "create_decision": {
      requireRole(membership, reviewingRoles, "Your organization role cannot create governance decisions.")
      assertMemberReference(document, mutation.ownerUserId, "Decision owner")
      const decisionId = options.createId("organization_decision")
      document.decisions.unshift({
        approvedByUserId: null,
        context: mutation.context,
        createdAt: options.now,
        decidedAt: null,
        decision: mutation.decision,
        id: decisionId,
        organizationId: document.organization.id,
        ownerUserId: mutation.ownerUserId,
        projectId: mutation.projectId,
        status: "proposed",
        title: mutation.title,
        updatedAt: options.now,
        ventureId: mutation.ventureId,
      })
      audit(document, session.id, "decision.created", "organization_decision", decisionId, `${session.name} proposed decision ${mutation.title}.`, options)
      break
    }
    case "resolve_decision": {
      requireRole(membership, reviewingRoles, "Your organization role cannot resolve governance decisions.")
      const decision = document.decisions.find(item => item.id === mutation.decisionId)
      if (!decision)
        fail("Governance decision not found.", 404)
      decision.decision = mutation.decision
      decision.status = mutation.status
      decision.approvedByUserId = session.id
      decision.decidedAt = options.now
      decision.updatedAt = options.now
      audit(document, session.id, `decision.${mutation.status}`, "organization_decision", decision.id, `${session.name} marked ${decision.title} ${mutation.status}.`, options)
      break
    }
    case "create_policy": {
      requireRole(membership, policyRoles, "Only owners, operators, or counsel can create agreement policies.")
      const policyId = options.createId("organization_policy")
      const policy: OrganizationAgreementPolicy = {
        allowOutsideCounsel: mutation.allowOutsideCounsel,
        approvalRoles: validateApprovalRoles(mutation.approvalRoles),
        createdAt: options.now,
        createdByUserId: session.id,
        description: mutation.description,
        id: policyId,
        isDefault: mutation.isDefault,
        name: mutation.name,
        organizationId: document.organization.id,
        requiredClauses: Array.from(new Set(mutation.requiredClauses)),
        requiresInternalApproval: mutation.requiresInternalApproval,
        requiresLegalReview: mutation.requiresLegalReview,
        separationOfDuties: mutation.separationOfDuties,
        updatedAt: options.now,
      }
      document.agreementPolicies.unshift(policy)
      if (policy.isDefault)
        updateDefaultPolicy(document, policy.id, options.now)
      audit(document, session.id, "policy.created", "organization_policy", policy.id, `${session.name} created agreement policy ${policy.name}.`, options)
      break
    }
    case "update_policy": {
      requireRole(membership, policyRoles, "Only owners, operators, or counsel can update agreement policies.")
      const policy = requirePolicy(document, mutation.policyId)
      policy.allowOutsideCounsel = mutation.allowOutsideCounsel
      policy.approvalRoles = validateApprovalRoles(mutation.approvalRoles)
      policy.description = mutation.description
      policy.isDefault = mutation.isDefault
      policy.name = mutation.name
      policy.requiredClauses = Array.from(new Set(mutation.requiredClauses))
      policy.requiresInternalApproval = mutation.requiresInternalApproval
      policy.requiresLegalReview = mutation.requiresLegalReview
      policy.separationOfDuties = mutation.separationOfDuties
      policy.updatedAt = options.now
      if (policy.isDefault)
        updateDefaultPolicy(document, policy.id, options.now)
      audit(document, session.id, "policy.updated", "organization_policy", policy.id, `${session.name} updated agreement policy ${policy.name}.`, options)
      break
    }
    case "request_approval": {
      requireMembership(document, session.id)
      if (mutation.policyId)
        requirePolicy(document, mutation.policyId)
      const contractLink = mutation.targetType === "contract"
        ? document.resourceLinks.find(link => link.resourceType === "contract" && link.resourceId === mutation.targetId)
        : null
      const linkedPolicy = contractLink ? linkedAgreementPolicy(document, contractLink.policyId) : null
      if (contractLink && !linkedPolicy)
        fail("The linked agreement policy is unavailable.", 409)
      if (linkedPolicy && mutation.policyId !== linkedPolicy.id)
        fail("Contract approval must use the linked agreement policy.", 409)
      const duplicate = document.approvalRequests.some(approval =>
        approval.targetType === mutation.targetType
        && approval.targetId === mutation.targetId
        && approval.targetVersionId === mutation.targetVersionId
        && (!linkedPolicy || approval.policyId === linkedPolicy.id)
        && approval.status === "pending",
      )
      if (duplicate)
        fail("A pending approval already exists for this exact item and version.", 409)
      const approvalId = options.createId("organization_approval")
      document.approvalRequests.unshift({
        createdAt: options.now,
        decidedAt: null,
        decidedByUserId: null,
        decisionNote: null,
        id: approvalId,
        organizationId: document.organization.id,
        policyId: mutation.policyId,
        requestedByUserId: session.id,
        status: "pending",
        summary: mutation.summary,
        targetId: mutation.targetId,
        targetType: mutation.targetType,
        targetVersionId: mutation.targetVersionId,
        title: mutation.title,
        updatedAt: options.now,
      })
      audit(document, session.id, "approval.requested", "organization_approval", approvalId, `${session.name} requested approval for ${mutation.title}.`, options)
      break
    }
    case "resolve_approval": {
      const approval = document.approvalRequests.find(item => item.id === mutation.approvalId)
      if (!approval || approval.status !== "pending")
        fail("This approval request is no longer pending.", 409)
      const policy = approvalPolicy(document, approval)
      const approvalRoles = new Set<OrganizationMemberRole>(policy?.approvalRoles || ["owner", "operator", "reviewer", "counsel"])
      requireRole(membership, approvalRoles, "Your organization role cannot resolve this approval request.")
      if (policy?.separationOfDuties && approval.requestedByUserId === session.id)
        fail("This policy requires a different organization member to resolve the approval.", 409)
      approval.status = mutation.status
      approval.decisionNote = mutation.decisionNote
      approval.decidedByUserId = session.id
      approval.decidedAt = options.now
      approval.updatedAt = options.now
      audit(document, session.id, `approval.${mutation.status}`, "organization_approval", approval.id, `${session.name} marked ${approval.title} ${mutation.status}.`, options)
      break
    }
    case "cancel_approval": {
      const approval = document.approvalRequests.find(item => item.id === mutation.approvalId)
      if (!approval || approval.status !== "pending")
        fail("This approval request is no longer pending.", 409)
      if (approval.requestedByUserId !== session.id && !operatorRoles.has(membership.role))
        fail("Only the requester, owner, or operator can cancel this approval.", 403)
      approval.status = "canceled"
      approval.decidedByUserId = session.id
      approval.decidedAt = options.now
      approval.updatedAt = options.now
      audit(document, session.id, "approval.canceled", "organization_approval", approval.id, `${session.name} canceled ${approval.title}.`, options)
      break
    }
    case "share_search": {
      requireRole(membership, workingRoles, "Your organization role cannot share searches.")
      const sharedSearchId = options.createId("organization_search")
      document.sharedSearches.unshift({
        createdAt: options.now,
        filters: cloneValue(mutation.filters),
        id: sharedSearchId,
        label: mutation.label,
        organizationId: document.organization.id,
        scope: mutation.scope,
        sharedByUserId: session.id,
        sourceSavedSearchId: mutation.sourceSavedSearchId,
        updatedAt: options.now,
      })
      audit(document, session.id, "search.shared", "organization_search", sharedSearchId, `${session.name} shared search ${mutation.label}.`, options)
      break
    }
    case "remove_shared_search": {
      const sharedSearch = document.sharedSearches.find(item => item.id === mutation.sharedSearchId)
      if (!sharedSearch)
        fail("Shared search not found.", 404)
      if (sharedSearch.sharedByUserId !== session.id && !operatorRoles.has(membership.role))
        fail("Only the search owner, organization owner, or operator can remove it.", 403)
      document.sharedSearches = document.sharedSearches.filter(item => item.id !== sharedSearch.id)
      audit(document, session.id, "search.removed", "organization_search", sharedSearch.id, `${session.name} removed shared search ${sharedSearch.label}.`, options)
      break
    }
    case "link_resource": {
      requireRole(membership, operatorRoles, "Only an owner or operator can link organization resources.")
      if (mutation.policyId)
        requirePolicy(document, mutation.policyId)
      const existing = document.resourceLinks.find(link => link.resourceType === mutation.resourceType && link.resourceId === mutation.resourceId)
      if (existing)
        fail("That resource is already linked to this organization.", 409)
      const resourceLinkId = options.createId("organization_resource")
      document.resourceLinks.unshift({
        createdAt: options.now,
        id: resourceLinkId,
        label: mutation.label,
        linkedByUserId: session.id,
        organizationId: document.organization.id,
        policyId: mutation.policyId,
        resourceId: mutation.resourceId,
        resourceType: mutation.resourceType,
        updatedAt: options.now,
      })
      audit(document, session.id, "resource.linked", "organization_resource", resourceLinkId, `${session.name} linked ${mutation.label}.`, options)
      break
    }
    case "unlink_resource": {
      requireRole(membership, operatorRoles, "Only an owner or operator can unlink organization resources.")
      const resource = document.resourceLinks.find(item => item.id === mutation.resourceLinkId)
      if (!resource)
        fail("Linked resource not found.", 404)
      document.resourceLinks = document.resourceLinks.filter(item => item.id !== resource.id)
      audit(document, session.id, "resource.unlinked", "organization_resource", resource.id, `${session.name} unlinked ${resource.label}.`, options)
      break
    }
    default: {
      const exhaustive: never = mutation
      return exhaustive
    }
  }

  return finish(document, options)
}

export function getOrganizationContractGovernanceRequirements(
  documents: OrganizationWorkspaceDocument[],
  contractId: string,
  contractVersionId: string,
  approvedLegalReviewVersionIds: ReadonlySet<string>,
): OrganizationContractGovernanceRequirement[] {
  return documents.flatMap((document) => {
    if (document.organization.status !== "active")
      return []
    const link = document.resourceLinks.find(resource => resource.resourceType === "contract" && resource.resourceId === contractId)
    if (!link)
      return []
    const policy = linkedAgreementPolicy(document, link.policyId)
    if (!policy) {
      return [{
        allowOutsideCounsel: false,
        approvalStatus: "missing",
        approvedLegalReview: approvedLegalReviewVersionIds.has(contractVersionId),
        blockers: ["The linked agreement policy is unavailable. An organization owner must restore it before signing."],
        organizationId: document.organization.id,
        organizationName: document.organization.name,
        policyId: link.policyId || "",
        policyName: "Unavailable agreement policy",
        requiresInternalApproval: false,
        requiresLegalReview: false,
      }]
    }
    const approval = document.approvalRequests
      .filter(item => item.targetType === "contract" && item.targetId === contractId && item.targetVersionId === contractVersionId && item.policyId === policy.id)
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())[0]
    const approvedLegalReview = approvedLegalReviewVersionIds.has(contractVersionId)
    const blockers: string[] = []
    const decidedBy = approval?.decidedByUserId ? activeMembership(document, approval.decidedByUserId) : null
    const approvalStatus = approval?.status === "approved" && (
      !decidedBy
      || !policy.approvalRoles.includes(decidedBy.role)
      || (policy.separationOfDuties && approval.requestedByUserId === decidedBy.userId)
    )
      ? "missing"
      : approval?.status || "missing"
    if (policy.requiresInternalApproval && approvalStatus !== "approved")
      blockers.push(approvalStatus === "missing" ? "Internal approval has not been requested for this version." : `Internal approval is ${approvalStatus.replaceAll("_", " ")}.`)
    if (policy.requiresLegalReview && !approvedLegalReview)
      blockers.push("The linked policy requires an approved legal review for this version.")

    return [{
      allowOutsideCounsel: policy.allowOutsideCounsel,
      approvalStatus,
      approvedLegalReview,
      blockers,
      organizationId: document.organization.id,
      organizationName: document.organization.name,
      policyId: policy.id,
      policyName: policy.name,
      requiresInternalApproval: policy.requiresInternalApproval,
      requiresLegalReview: policy.requiresLegalReview,
    }]
  })
}

export function formatOrganizationKind(kind: Organization["kind"]) {
  return kind === "venture_studio" ? "Venture studio" : "Startup team"
}

export function formatOrganizationMemberRole(role: OrganizationMemberRole) {
  return role === "counsel" ? "Counsel" : role.charAt(0).toUpperCase() + role.slice(1)
}

export function organizationMembershipFor(document: OrganizationWorkspaceDocument, userId: string) {
  return activeMembership(document, userId)
}

export function canManageOrganization(document: OrganizationWorkspaceDocument, userId: string) {
  const membership = activeMembership(document, userId)
  return Boolean(membership && operatorRoles.has(membership.role))
}

export function canResolveOrganizationApprovals(document: OrganizationWorkspaceDocument, userId: string) {
  const membership = activeMembership(document, userId)
  return Boolean(membership && reviewingRoles.has(membership.role))
}
