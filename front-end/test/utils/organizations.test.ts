import type { SessionUser } from "../../shared/types/domain"
import type { OrganizationMutation, OrganizationWorkspaceDocument } from "../../shared/types/organizations"
import { describe, expect, it } from "vitest"
import {
  applyOrganizationMutation,
  createOrganizationWorkspaceDocument,
  getOrganizationContractGovernanceRequirements,
  projectOrganizationWorkspaceForSession,
} from "../../shared/utils/organizations"

const owner: SessionUser = {
  email: "owner@example.com",
  id: "user_owner",
  name: "Owner Example",
  onboardingCompleted: true,
  role: "founder",
  subscriptionPlan: "team",
}

const reviewer: SessionUser = {
  email: "reviewer@example.com",
  id: "user_reviewer",
  name: "Review Person",
  onboardingCompleted: true,
  role: "collaborator",
  subscriptionPlan: "free",
}

function idFactory() {
  let index = 0
  return (prefix: string) => `${prefix}_${++index}`
}

function createDocument() {
  return createOrganizationWorkspaceDocument(owner, {
    description: "A complete organization workspace used for transition tests.",
    kind: "venture_studio",
    name: "Example Studio",
    slug: "example-studio",
    website: "https://example.com",
  }, {
    createId: idFactory(),
    now: "2026-08-08T12:00:00.000Z",
  })
}

function apply(document: OrganizationWorkspaceDocument, session: SessionUser, mutation: OrganizationMutation, minute: number) {
  return applyOrganizationMutation(document, session, mutation, {
    createId: idFactory(),
    now: `2026-08-08T12:${String(minute).padStart(2, "0")}:00.000Z`,
  })
}

function inviteAndAccept(document: OrganizationWorkspaceDocument) {
  const invited = apply(document, owner, {
    action: "invite_member",
    displayName: reviewer.name,
    email: reviewer.email,
    role: "reviewer",
    title: "Agreement reviewer",
  }, 1)
  const invitation = invited.invitations[0]!
  return apply(invited, reviewer, {
    action: "respond_invitation",
    invitationId: invitation.id,
    response: "accepted",
  }, 2)
}

describe("organization workspaces", () => {
  it("creates an owner seat, default policy, and audit history", () => {
    const document = createDocument()

    expect(document.organization.ownerUserId).toBe(owner.id)
    expect(document.organization.seatLimit).toBe(25)
    expect(document.memberships).toMatchObject([
      { role: "owner", userId: owner.id }
    ])
    expect(document.agreementPolicies).toMatchObject([
      { isDefault: true, requiresInternalApproval: true }
    ])
    expect(document.auditEvents[0]?.action).toBe("organization.created")
  })

  it("accepts an email-bound invitation without requiring the invited member to own a Team plan", () => {
    const document = inviteAndAccept(createDocument())

    expect(document.memberships.find(item => item.userId === reviewer.id)).toMatchObject({
      email: reviewer.email,
      role: "reviewer",
    })
    expect(document.invitations[0]).toMatchObject({ status: "accepted" })
  })

  it("does not expose workspace operations to a pending invitee", () => {
    const invited = apply(createDocument(), owner, {
      action: "invite_member",
      displayName: reviewer.name,
      email: reviewer.email,
      role: "reviewer",
      title: "Agreement reviewer",
    }, 1)
    invited.projects.push({
      createdAt: "2026-08-08T12:00:00.000Z",
      description: "Private operating project",
      dueAt: null,
      id: "project_private",
      organizationId: invited.organization.id,
      ownerUserId: owner.id,
      status: "active",
      title: "Private project",
      updatedAt: "2026-08-08T12:00:00.000Z",
      ventureId: null,
    })

    const projected = projectOrganizationWorkspaceForSession(invited, reviewer)!

    expect(projected.invitations).toHaveLength(1)
    expect(projected.memberships).toEqual([])
    expect(projected.projects).toEqual([])
    expect(projected.auditEvents).toEqual([])
  })

  it("enforces seat limits and owner-only role administration", () => {
    const document = inviteAndAccept(createDocument())
    const reviewerMembership = document.memberships.find(item => item.userId === reviewer.id)!
    const limited = apply(document, owner, {
      action: "update_settings",
      allowOperatorInvites: true,
      dataRetentionDays: 365,
      seatLimit: 2,
    }, 3)

    expect(() => apply(limited, owner, {
      action: "invite_member",
      displayName: "Third Member",
      email: "third@example.com",
      role: "member",
      title: "Member",
    }, 4)).toThrow("seat limit")

    expect(() => apply(limited, reviewer, {
      action: "update_member",
      membershipId: reviewerMembership.id,
      role: "operator",
      title: "Operator",
    }, 4)).toThrow("Only the organization owner")
  })

  it("requires a separate eligible reviewer when the policy says so", () => {
    const document = inviteAndAccept(createDocument())
    const policy = document.agreementPolicies[0]!
    const requested = apply(document, owner, {
      action: "request_approval",
      policyId: policy.id,
      summary: "Review the current agreement before either participant signs it.",
      targetId: "contract_1",
      targetType: "contract",
      targetVersionId: "contract_version_1",
      title: "Founder agreement",
    }, 3)
    const approval = requested.approvalRequests[0]!

    expect(() => apply(requested, owner, {
      action: "resolve_approval",
      approvalId: approval.id,
      decisionNote: "Owner self approval should not pass.",
      status: "approved",
    }, 4)).toThrow("different organization member")

    const approved = apply(requested, reviewer, {
      action: "resolve_approval",
      approvalId: approval.id,
      decisionNote: "Reviewed against the organization policy.",
      status: "approved",
    }, 4)
    expect(approved.approvalRequests[0]).toMatchObject({
      decidedByUserId: reviewer.id,
      status: "approved",
    })
  })

  it("builds version-specific contract blockers from linked policies", () => {
    const document = inviteAndAccept(createDocument())
    const policy = document.agreementPolicies[0]!
    const linked = apply(document, owner, {
      action: "link_resource",
      label: "Founder agreement",
      policyId: policy.id,
      resourceId: "contract_1",
      resourceType: "contract",
    }, 3)

    const missing = getOrganizationContractGovernanceRequirements(
      [linked],
      "contract_1",
      "contract_version_1",
      new Set(),
    )
    expect(missing[0]).toMatchObject({ approvalStatus: "missing" })
    expect(missing[0]?.blockers).toContain("Internal approval has not been requested for this version.")

    const requested = apply(linked, owner, {
      action: "request_approval",
      policyId: policy.id,
      summary: "Review the current agreement before either participant signs it.",
      targetId: "contract_1",
      targetType: "contract",
      targetVersionId: "contract_version_1",
      title: "Founder agreement",
    }, 4)
    const approved = apply(requested, reviewer, {
      action: "resolve_approval",
      approvalId: requested.approvalRequests[0]!.id,
      decisionNote: "Approved for signatures.",
      status: "approved",
    }, 5)
    const satisfied = getOrganizationContractGovernanceRequirements(
      [approved],
      "contract_1",
      "contract_version_1",
      new Set(),
    )
    expect(satisfied[0]).toMatchObject({ approvalStatus: "approved", blockers: [] })
  })

  it("does not let policy-less self-approval satisfy a linked contract", () => {
    const document = inviteAndAccept(createDocument())
    const policy = document.agreementPolicies[0]!
    const requested = apply(document, reviewer, {
      action: "request_approval",
      policyId: null,
      summary: "Review this agreement before either participant signs it.",
      targetId: "contract_1",
      targetType: "contract",
      targetVersionId: "contract_version_1",
      title: "Founder agreement",
    }, 3)
    const selfApproved = apply(requested, reviewer, {
      action: "resolve_approval",
      approvalId: requested.approvalRequests[0]!.id,
      decisionNote: "Approved without a policy or independent review.",
      status: "approved",
    }, 4)
    const linked = apply(selfApproved, owner, {
      action: "link_resource",
      label: "Founder agreement",
      policyId: policy.id,
      resourceId: "contract_1",
      resourceType: "contract",
    }, 5)

    expect(getOrganizationContractGovernanceRequirements([linked], "contract_1", "contract_version_1", new Set())[0])
      .toMatchObject({
        approvalStatus: "missing",
        blockers: ["Internal approval has not been requested for this version."]
      })

    const validRequest = apply(linked, owner, {
      action: "request_approval",
      policyId: policy.id,
      summary: "Request independent review under the linked agreement policy.",
      targetId: "contract_1",
      targetType: "contract",
      targetVersionId: "contract_version_1",
      title: "Founder agreement",
    }, 6)
    const approved = apply(validRequest, reviewer, {
      action: "resolve_approval",
      approvalId: validRequest.approvalRequests[0]!.id,
      decisionNote: "Independently reviewed under the linked policy.",
      status: "approved",
    }, 7)
    expect(getOrganizationContractGovernanceRequirements([approved], "contract_1", "contract_version_1", new Set())[0])
      .toMatchObject({ approvalStatus: "approved", blockers: [] })
    expect(getOrganizationContractGovernanceRequirements([approved], "contract_1", "contract_version_2", new Set())[0])
      .toMatchObject({ approvalStatus: "missing" })
  })

  it("rejects requests for a linked contract under no policy or a different policy", () => {
    const document = createDocument()
    const otherPolicyDocument = apply(document, owner, {
      action: "create_policy",
      allowOutsideCounsel: true,
      approvalRoles: ["owner"],
      description: "Alternate policy for another agreement workflow.",
      isDefault: false,
      name: "Alternate agreement policy",
      requiredClauses: [],
      requiresInternalApproval: true,
      requiresLegalReview: false,
      separationOfDuties: false,
    }, 1)
    const linked = apply(otherPolicyDocument, owner, {
      action: "link_resource",
      label: "Founder agreement",
      policyId: document.agreementPolicies[0]!.id,
      resourceId: "contract_1",
      resourceType: "contract",
    }, 2)
    const request = (policyId: string | null): OrganizationMutation => ({
      action: "request_approval",
      policyId,
      summary: "Review this agreement before either participant signs it.",
      targetId: "contract_1",
      targetType: "contract",
      targetVersionId: "contract_version_1",
      title: "Founder agreement",
    })

    expect(() => apply(linked, owner, request(null), 3)).toThrow("linked agreement policy")
    expect(() => apply(linked, owner, request(otherPolicyDocument.agreementPolicies[0]!.id), 3)).toThrow("linked agreement policy")
    expect(() => apply(linked, owner, request(document.agreementPolicies[0]!.id), 3)).not.toThrow()
    expect(() => apply(linked, owner, {
      ...request(null),
      targetType: "venture"
    }, 3)).not.toThrow()

    const defaultLinked = apply(document, owner, {
      action: "link_resource",
      label: "Founder agreement",
      policyId: null,
      resourceId: "contract_1",
      resourceType: "contract",
    }, 1)
    expect(() => apply(defaultLinked, owner, request(null), 2)).toThrow("linked agreement policy")
    expect(() => apply(defaultLinked, owner, request(document.agreementPolicies[0]!.id), 2)).not.toThrow()
  })

  it("lets a linked contract replace a legacy pending policy-less request", () => {
    const document = createDocument()
    const oldRequest = apply(document, owner, {
      action: "request_approval",
      policyId: null,
      summary: "Old request without a linked policy selection.",
      targetId: "contract_1",
      targetType: "contract",
      targetVersionId: "contract_version_1",
      title: "Founder agreement",
    }, 1)
    const linked = apply(oldRequest, owner, {
      action: "link_resource",
      label: "Founder agreement",
      policyId: document.agreementPolicies[0]!.id,
      resourceId: "contract_1",
      resourceType: "contract",
    }, 2)
    const newRequest = apply(linked, owner, {
      action: "request_approval",
      policyId: document.agreementPolicies[0]!.id,
      summary: "New request under the linked agreement policy.",
      targetId: "contract_1",
      targetType: "contract",
      targetVersionId: "contract_version_1",
      title: "Founder agreement",
    }, 3)

    expect(newRequest.approvalRequests).toMatchObject([
      { policyId: document.agreementPolicies[0]!.id, status: "pending" },
      { policyId: null, status: "pending" },
    ])
    expect(getOrganizationContractGovernanceRequirements([newRequest], "contract_1", "contract_version_1", new Set())[0])
      .toMatchObject({ approvalStatus: "pending" })
  })

  it("ignores an approval granted under a different policy before linking", () => {
    const document = createDocument()
    const withAlternatePolicy = apply(document, owner, {
      action: "create_policy",
      allowOutsideCounsel: true,
      approvalRoles: ["owner"],
      description: "Independent policy for a different agreement.",
      isDefault: false,
      name: "Alternate policy",
      requiredClauses: [],
      requiresInternalApproval: true,
      requiresLegalReview: false,
      separationOfDuties: false,
    }, 1)
    const requested = apply(withAlternatePolicy, owner, {
      action: "request_approval",
      policyId: withAlternatePolicy.agreementPolicies[0]!.id,
      summary: "Approve this agreement under the alternate policy.",
      targetId: "contract_1",
      targetType: "contract",
      targetVersionId: "contract_version_1",
      title: "Founder agreement",
    }, 2)
    const approved = apply(requested, owner, {
      action: "resolve_approval",
      approvalId: requested.approvalRequests[0]!.id,
      decisionNote: "Self approval is allowed under the alternate policy.",
      status: "approved",
    }, 3)
    const linked = apply(approved, owner, {
      action: "link_resource",
      label: "Founder agreement",
      policyId: document.agreementPolicies[0]!.id,
      resourceId: "contract_1",
      resourceType: "contract",
    }, 4)

    expect(getOrganizationContractGovernanceRequirements([linked], "contract_1", "contract_version_1", new Set())[0])
      .toMatchObject({
        approvalStatus: "missing",
        blockers: ["Internal approval has not been requested for this version."]
      })
  })

  it("keeps signing blocked when a linked contract loses its default policy", () => {
    const document = createDocument()
    const policy = document.agreementPolicies[0]!
    const linked = apply(document, owner, {
      action: "link_resource",
      label: "Founder agreement",
      policyId: null,
      resourceId: "contract_1",
      resourceType: "contract",
    }, 1)
    const withoutDefault = apply(linked, owner, {
      action: "update_policy",
      allowOutsideCounsel: policy.allowOutsideCounsel,
      approvalRoles: policy.approvalRoles,
      description: policy.description,
      isDefault: false,
      name: policy.name,
      policyId: policy.id,
      requiredClauses: policy.requiredClauses,
      requiresInternalApproval: policy.requiresInternalApproval,
      requiresLegalReview: policy.requiresLegalReview,
      separationOfDuties: policy.separationOfDuties,
    }, 2)

    expect(getOrganizationContractGovernanceRequirements([withoutDefault], "contract_1", "contract_version_1", new Set())[0])
      .toMatchObject({
        approvalStatus: "missing",
        blockers: ["The linked agreement policy is unavailable. An organization owner must restore it before signing."]
      })
    expect(() => apply(withoutDefault, owner, {
      action: "request_approval",
      policyId: null,
      summary: "Review the agreement while its policy is missing.",
      targetId: "contract_1",
      targetType: "contract",
      targetVersionId: "contract_version_1",
      title: "Founder agreement",
    }, 3)).toThrow("linked agreement policy is unavailable")

    const staleExplicitLink = structuredClone(linked)
    staleExplicitLink.resourceLinks[0]!.policyId = "organization_policy_unavailable"
    expect(getOrganizationContractGovernanceRequirements([staleExplicitLink], "contract_1", "contract_version_1", new Set())[0])
      .toMatchObject({
        policyId: "organization_policy_unavailable",
        blockers: ["The linked agreement policy is unavailable. An organization owner must restore it before signing."]
      })
  })

  it("requires a currently eligible independent approver under the linked policy", () => {
    const document = inviteAndAccept(createDocument())
    const policy = document.agreementPolicies[0]!
    const linked = apply(document, owner, {
      action: "link_resource",
      label: "Founder agreement",
      policyId: policy.id,
      resourceId: "contract_1",
      resourceType: "contract",
    }, 3)
    const requested = apply(linked, owner, {
      action: "request_approval",
      policyId: policy.id,
      summary: "Review the current agreement before either participant signs it.",
      targetId: "contract_1",
      targetType: "contract",
      targetVersionId: "contract_version_1",
      title: "Founder agreement",
    }, 4)
    const approved = apply(requested, reviewer, {
      action: "resolve_approval",
      approvalId: requested.approvalRequests[0]!.id,
      decisionNote: "Approved as an independent reviewer.",
      status: "approved",
    }, 5)
    const downgraded = apply(approved, owner, {
      action: "update_member",
      membershipId: approved.memberships.find(item => item.userId === reviewer.id)!.id,
      role: "member",
      title: "Team member",
    }, 6)
    expect(getOrganizationContractGovernanceRequirements([downgraded], "contract_1", "contract_version_1", new Set())[0])
      .toMatchObject({
        approvalStatus: "missing",
        blockers: ["Internal approval has not been requested for this version."]
      })

    const legacySelfApproved = structuredClone(approved)
    legacySelfApproved.approvalRequests[0]!.decidedByUserId = owner.id
    expect(getOrganizationContractGovernanceRequirements([legacySelfApproved], "contract_1", "contract_version_1", new Set())[0])
      .toMatchObject({ approvalStatus: "missing" })
  })
})
