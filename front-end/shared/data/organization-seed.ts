import type { OrganizationWorkspaceDocument } from "../types/organizations"

const createdAt = "2026-08-08T14:00:00.000Z"

export const organizationWorkspaceSeedDocuments: OrganizationWorkspaceDocument[] = [
  {
    agreementPolicies: [
      {
        allowOutsideCounsel: true,
        approvalRoles: [
          "owner",
          "operator",
          "reviewer",
          "counsel"
        ],
        createdAt,
        createdByUserId: "user_emma",
        description: "Founder and senior operator agreements require a second internal reviewer before signature.",
        id: "organization_policy_trialwire_founder",
        isDefault: true,
        name: "Founder agreement review",
        organizationId: "organization_trialwire_studio",
        requiredClauses: [
          "Roles and scope",
          "Equity and vesting",
          "IP assignment",
          "Decision rights",
          "Exit and termination"
        ],
        requiresInternalApproval: true,
        requiresLegalReview: false,
        separationOfDuties: true,
        updatedAt: createdAt,
      }
    ],
    approvalRequests: [
      {
        createdAt,
        decidedAt: null,
        decidedByUserId: null,
        decisionNote: null,
        id: "organization_approval_trialwire_design",
        organizationId: "organization_trialwire_studio",
        policyId: "organization_policy_trialwire_founder",
        requestedByUserId: "user_emma",
        status: "pending",
        summary: "Review role ownership, design-system scope, and milestone language before the proposal becomes an agreement.",
        targetId: "proposal_trialwire_design",
        targetType: "proposal",
        targetVersionId: "proposal_version_trialwire_2",
        title: "TrialWire founding designer proposal",
        updatedAt: createdAt,
      }
    ],
    auditEvents: [
      {
        action: "approval.requested",
        actorUserId: "user_emma",
        createdAt,
        id: "organization_audit_trialwire_approval",
        organizationId: "organization_trialwire_studio",
        summary: "Emma requested internal approval for the founding designer proposal.",
        targetId: "organization_approval_trialwire_design",
        targetType: "organization_approval",
      },
      {
        action: "organization.created",
        actorUserId: "user_emma",
        createdAt,
        id: "organization_audit_trialwire_created",
        organizationId: "organization_trialwire_studio",
        summary: "Emma created TrialWire Studio.",
        targetId: "organization_trialwire_studio",
        targetType: "organization",
      }
    ],
    decisions: [
      {
        approvedByUserId: "user_sofia",
        context: "Paid pilots need consistent implementation ownership before multi-site expansion.",
        createdAt,
        decidedAt: createdAt,
        decision: "Emma owns commercial commitments; Sofia owns product design and implementation standards for the pilot expansion.",
        id: "organization_decision_trialwire_ownership",
        organizationId: "organization_trialwire_studio",
        ownerUserId: "user_emma",
        projectId: "organization_project_trialwire_pilots",
        status: "approved",
        title: "Pilot expansion decision rights",
        updatedAt: createdAt,
        ventureId: "organization_venture_trialwire",
      }
    ],
    invitations: [],
    memberships: [
      {
        createdAt,
        displayName: "Emma Rodriguez",
        email: "emma@cofoundry.dev",
        id: "organization_membership_trialwire_emma",
        joinedAt: createdAt,
        organizationId: "organization_trialwire_studio",
        role: "owner",
        title: "Founder and studio lead",
        updatedAt: createdAt,
        userId: "user_emma",
      },
      {
        createdAt,
        displayName: "Sofia Patel",
        email: "sofia@cofoundry.dev",
        id: "organization_membership_trialwire_sofia",
        joinedAt: createdAt,
        organizationId: "organization_trialwire_studio",
        role: "operator",
        title: "Founding design operator",
        updatedAt: createdAt,
        userId: "user_sofia",
      }
    ],
    organization: {
      allowOperatorInvites: true,
      billingOwnerUserId: "user_emma",
      createdAt,
      dataRetentionDays: 365,
      description: "A focused operating workspace for TrialWire and future clinical-operations products.",
      id: "organization_trialwire_studio",
      kind: "venture_studio",
      name: "TrialWire Studio",
      ownerUserId: "user_emma",
      seatLimit: 25,
      slug: "trialwire-studio",
      status: "active",
      updatedAt: createdAt,
      website: "https://trialwire.health",
    },
    projects: [
      {
        createdAt,
        description: "Convert the current pilot cohort into repeatable multi-site deployments.",
        dueAt: "2026-10-31T17:00:00.000Z",
        id: "organization_project_trialwire_pilots",
        organizationId: "organization_trialwire_studio",
        ownerUserId: "user_emma",
        status: "active",
        title: "Multi-site pilot expansion",
        updatedAt: createdAt,
        ventureId: "organization_venture_trialwire",
      }
    ],
    resourceLinks: [
      {
        createdAt,
        id: "organization_resource_trialwire_proposal",
        label: "Founding designer proposal",
        linkedByUserId: "user_emma",
        organizationId: "organization_trialwire_studio",
        policyId: "organization_policy_trialwire_founder",
        resourceId: "proposal_trialwire_design",
        resourceType: "proposal",
        updatedAt: createdAt,
      }
    ],
    sharedSearches: [
      {
        createdAt,
        filters: {
          compensationType: "equity_only",
          equityExpectationRange: "",
          equityPhilosophy: "any",
          industries: ["Healthtech", "Clinical Operations"],
          location: "",
          minimumWeeklyHours: "20",
          query: "product design clinical workflows",
          remotePreference: "remote",
          roles: ["Founding Designer", "Product Designer"],
          runwayBucket: "any",
          skills: ["Product Design", "Design Systems"],
          stage: "mvp",
          timeCommitment: "part_time",
        },
        id: "organization_search_trialwire_design",
        label: "Clinical product design operators",
        organizationId: "organization_trialwire_studio",
        scope: "profiles",
        sharedByUserId: "user_emma",
        sourceSavedSearchId: null,
        updatedAt: createdAt,
      }
    ],
    tasks: [
      {
        assigneeUserId: "user_sofia",
        createdAt,
        createdByUserId: "user_emma",
        dueAt: "2026-08-21T17:00:00.000Z",
        id: "organization_task_trialwire_handoff",
        organizationId: "organization_trialwire_studio",
        projectId: "organization_project_trialwire_pilots",
        status: "in_progress",
        title: "Standardize the implementation handoff",
        updatedAt: createdAt,
      },
      {
        assigneeUserId: "user_emma",
        createdAt,
        createdByUserId: "user_emma",
        dueAt: "2026-08-28T17:00:00.000Z",
        id: "organization_task_trialwire_expansion",
        organizationId: "organization_trialwire_studio",
        projectId: "organization_project_trialwire_pilots",
        status: "todo",
        title: "Confirm expansion criteria with pilot sponsors",
        updatedAt: createdAt,
      }
    ],
    ventures: [
      {
        createdAt,
        id: "organization_venture_trialwire",
        leadUserId: "user_emma",
        name: "TrialWire",
        opportunityId: "opp_trialwire",
        organizationId: "organization_trialwire_studio",
        stage: "mvp",
        status: "active",
        summary: "Clinical operations software moving paid pilots toward repeatable multi-site contracts.",
        updatedAt: createdAt,
      }
    ],
    version: 1,
  }
]
