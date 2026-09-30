import type { H3Event } from "h3"
import type { StartupOpportunity } from "../../shared/types/domain"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import process from "node:process"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { listAdminSecurityUsers, persistAdminUserSecurityAction, persistOpportunityVerificationAction } from "../../server/utils/admin-persistence"
import { persistMockCheckoutSubscription, updateMockSubscriptionRenewal } from "../../server/utils/billing-persistence"
import { applyCollaborationMutation } from "../../server/utils/collaboration-workflow"
import { clearLocalAdminAuditStoreForTests } from "../../server/utils/local-admin-audit"
import { clearLocalCollaborationStoreForTests, loadLocalCollaborationState, persistLocalCollaborationStateForUsers } from "../../server/utils/local-collaboration-store"
import { clearLocalMemberWorkspaceStoreForTests, persistLocalMemberWorkspaceState } from "../../server/utils/local-member-workspace"
import { extractUsersCollaborationState } from "../../server/utils/member-collaboration"
import { listAdminOpportunityWorkspaceSlice, loadMemberWorkspaceState, persistMemberWorkspaceWritePayload } from "../../server/utils/member-workspace"
import { workspaceSeed } from "../../shared/data/seed"
import { buildSessionUser } from "../../shared/utils/workspace"
import { projectWorkspaceForSession } from "../../shared/utils/workspace-authorization"

let dataDirectory: string

const event = {} as H3Event
const identity = {
  email: "local-member@example.com",
  id: "user_local_member",
  name: "Local Member",
  onboardingCompleted: false,
  role: "founder" as const,
  subscriptionPlan: "free" as const,
}

describe("local member workspace persistence", () => {
  beforeEach(async () => {
    dataDirectory = await mkdtemp(join(tmpdir(), "cofoundry-member-workspace-"))
    process.env.COFOUNDRY_LOCAL_DATA_DIR = dataDirectory
    vi.stubGlobal("useRuntimeConfig", () => ({
      public: {
        backendMode: "mock",
        billingMode: "mock",
      },
    }))
    await clearLocalAdminAuditStoreForTests()
    await clearLocalCollaborationStoreForTests()
    await clearLocalMemberWorkspaceStoreForTests()
  })

  afterEach(async () => {
    await clearLocalAdminAuditStoreForTests()
    await clearLocalCollaborationStoreForTests()
    await clearLocalMemberWorkspaceStoreForTests()
    await rm(dataDirectory, { force: true, recursive: true })
    delete process.env.COFOUNDRY_LOCAL_DATA_DIR
    delete process.env.COFOUNDRY_COLLABORATION_RETENTION_LIMIT
    vi.unstubAllGlobals()
  })

  it("persists member-owned workspace state in mock mode", async () => {
    const initial = await loadMemberWorkspaceState(event, identity)

    const saved = await persistMemberWorkspaceWritePayload(event, identity, {
      bookmarks: [],
      notificationPreferences: {
        unreadDigestEmail: true,
        workflowEmail: true,
      },
      onboardingCompleted: true,
      opportunities: [],
      profile: {
        ...initial.state.profile,
        bio: "This profile was persisted by the local member workspace store for production-facing mock mode.",
        headline: "Server-persisted local member profile",
      },
      savedSearches: [],
    })

    const reloaded = await loadMemberWorkspaceState(event, identity)

    expect(saved.session).toMatchObject({
      id: identity.id,
      onboardingCompleted: false,
    })
    expect(reloaded.state.profile).toMatchObject({
      headline: "Server-persisted local member profile",
    })
    expect(reloaded.state.user.notificationPreferences.unreadDigestEmail).toBe(true)
    expect(reloaded.state.user.notificationPreferences.workflowEmail).toBe(true)
  })

  it("uses authoritative counterparty billing state for agreement sponsorship", async () => {
    const oliviaSession = buildSessionUser(workspaceSeed, "user_olivia")!
    const oliviaWorkspace = await loadMemberWorkspaceState(event, oliviaSession)
    await persistLocalMemberWorkspaceState({
      ...oliviaWorkspace.state,
      subscription: {
        ...oliviaWorkspace.state.subscription,
        status: "canceled",
      },
    })

    const malikSession = buildSessionUser(workspaceSeed, "user_malik")!
    const unsponsoredWorkspace = await loadMemberWorkspaceState(event, malikSession)
    const unsponsoredProjection = projectWorkspaceForSession(unsponsoredWorkspace.seed, unsponsoredWorkspace.session)
    expect(unsponsoredProjection.contracts.find(contract => contract.id === "contract_ledgerloop")?.workflowSponsored).toBe(false)
    expect(unsponsoredProjection.subscriptions.map(subscription => subscription.userId)).toEqual([malikSession.id])

    await persistLocalMemberWorkspaceState({
      ...oliviaWorkspace.state,
      subscription: {
        ...oliviaWorkspace.state.subscription,
        status: "active",
      },
    })
    const sponsoredWorkspace = await loadMemberWorkspaceState(event, malikSession)
    const sponsoredProjection = projectWorkspaceForSession(sponsoredWorkspace.seed, sponsoredWorkspace.session)
    expect(sponsoredProjection.contracts.find(contract => contract.id === "contract_ledgerloop")?.workflowSponsored).toBe(true)
    expect(sponsoredProjection.subscriptions.map(subscription => subscription.userId)).toEqual([malikSession.id])
  })

  it("does not bootstrap an unprovisioned member when bootstrap is disabled", async () => {
    await expect(loadMemberWorkspaceState(event, {
      ...identity,
      email: "direct-auth-signup@example.com",
      id: "user_direct_auth_signup",
    }, {
      allowUserBootstrap: false,
    })).rejects.toMatchObject({
      statusCode: 403,
    })
  })

  it("allows atomic admin security actions on dynamically provisioned local members", async () => {
    const initial = await loadMemberWorkspaceState(event, identity)
    await persistMemberWorkspaceWritePayload(event, identity, {
      bookmarks: [],
      notificationPreferences: initial.state.user.notificationPreferences,
      onboardingCompleted: false,
      opportunities: [],
      profile: initial.state.profile,
      savedSearches: [],
    })

    expect(await listAdminSecurityUsers(event)).toContainEqual(expect.objectContaining({
      id: identity.id,
      role: "founder",
      suspendedAt: null,
    }))

    const createdAt = "2026-07-29T20:00:00.000Z"
    await persistAdminUserSecurityAction(event, {
      action: {
        adminUserId: "user_ava",
        createdAt,
        id: "admin_action_suspend_dynamic_member",
        metadata: {
          nextSuspendedAt: createdAt,
          previousSuspendedAt: null,
        },
        notes: "Suspended after reviewing the dynamic member security case.",
        targetId: identity.id,
        targetType: "user",
        type: "suspend_user",
      },
      mutation: {
        action: "suspend",
        kind: "change_status",
      },
    })

    expect(await listAdminSecurityUsers(event)).toContainEqual(expect.objectContaining({
      id: identity.id,
      suspendedAt: createdAt,
    }))
  })

  it("lists all local member opportunities for admin review", async () => {
    const ownerIdentity = {
      ...identity,
      email: "casey-founder@example.com",
      id: "user_casey_founder",
      name: "Casey Founder",
      onboardingCompleted: true,
    }
    const initial = await loadMemberWorkspaceState(event, ownerIdentity)
    const createdAt = "2026-06-13T12:00:00.000Z"
    const opportunity: StartupOpportunity = {
      ...workspaceSeed.opportunities[0]!,
      createdAt,
      id: "opp_casey_manual_review",
      officialWebsite: "https://casey.example.com",
      ownerUserId: ownerIdentity.id,
      riskFlags: ["Ownership claim requires operator review."],
      slug: "casey-manual-review",
      startupName: "CaseyOps",
      updatedAt: createdAt,
      verificationMethod: "domain",
      verificationStatus: "manual_review",
    }

    await persistMemberWorkspaceWritePayload(event, ownerIdentity, {
      bookmarks: [],
      notificationPreferences: {
        unreadDigestEmail: true,
        workflowEmail: true,
      },
      onboardingCompleted: true,
      opportunities: [opportunity],
      profile: {
        ...initial.state.profile,
        displayName: "Casey Founder",
        headline: "Founder with a startup listing awaiting operator review.",
      },
      savedSearches: [],
    })

    let slice = await listAdminOpportunityWorkspaceSlice(event)
    const pendingOpportunity = slice.opportunities.find(item =>
      item.ownerUserId === ownerIdentity.id
      && item.startupName === opportunity.startupName,
    )

    expect(pendingOpportunity).toMatchObject({
      ownerUserId: ownerIdentity.id,
      verificationStatus: "manual_review",
    })
    expect(pendingOpportunity?.id).not.toBe(opportunity.id)
    expect(slice.users.find(user => user.id === ownerIdentity.id)).toMatchObject({
      email: ownerIdentity.email,
    })
    expect(slice.profiles.find(profile => profile.userId === ownerIdentity.id)).toMatchObject({
      displayName: "Casey Founder",
    })

    await persistOpportunityVerificationAction(event, {
      action: {
        adminUserId: "user_ava",
        createdAt: "2026-06-13T12:30:00.000Z",
        id: "admin_action_caseyops_verification",
        notes: "Verified CaseyOps domain evidence from the admin queue.",
        targetId: pendingOpportunity!.id,
        targetType: "opportunity",
        type: "review_evidence",
      },
      expectedUpdatedAt: pendingOpportunity!.updatedAt,
      status: "domain_verified",
    })

    slice = await listAdminOpportunityWorkspaceSlice(event)

    expect(slice.opportunities.find(item => item.id === pendingOpportunity!.id)).toMatchObject({
      updatedAt: "2026-06-13T12:30:00.000Z",
      verificationStatus: "domain_verified",
    })
  })

  it("persists mock collaboration mutations through the server route helpers", async () => {
    const session = buildSessionUser(workspaceSeed, "user_malik")
    if (!session)
      throw new Error("Expected seeded Malik review account.")

    const conversation = workspaceSeed.conversations.find(item =>
      item.participantIds.includes(session.id)
      && (item.unreadCountByUser[session.id] || 0) > 0,
    )
    if (!conversation)
      throw new Error("Expected a seeded unread conversation for Malik.")

    await applyCollaborationMutation(event, session, {
      action: "mark_conversation_read",
      conversationId: conversation.id,
    })

    const reloaded = await loadMemberWorkspaceState(event, {
      email: session.email,
      id: session.id,
      name: session.name,
      onboardingCompleted: session.onboardingCompleted,
      role: session.role,
      subscriptionPlan: session.subscriptionPlan,
    })

    expect(reloaded.seed.conversations.find(item => item.id === conversation.id)?.unreadCountByUser[session.id]).toBe(0)
  })

  it("rejects only a new agreement revision beyond the local per-agreement limit", async () => {
    process.env.COFOUNDRY_COLLABORATION_RETENTION_LIMIT = "100"
    const userIds = ["user_olivia", "user_malik"]
    const expected = extractUsersCollaborationState(workspaceSeed, userIds)
    const state = structuredClone(expected)
    const sourceVersion = state.contractVersions.find(version => version.contractId === "contract_ledgerloop")!
    state.contractVersions.push(...Array.from({ length: 98 }, (_, index) => ({
      ...sourceVersion,
      id: `contract_version_ledgerloop_${index + 2}`,
      versionNumber: index + 2,
      createdAt: "2026-09-29T12:00:00.000Z",
    })))
    state.contracts.find(contract => contract.id === "contract_ledgerloop")!.currentVersionId = "contract_version_ledgerloop_99"
    await persistLocalCollaborationStateForUsers(userIds, state, { expectedState: expected })

    const session = buildSessionUser(workspaceSeed, "user_malik")!
    const payload = {
      roleTitle: sourceVersion.roleTitle,
      scope: sourceVersion.scope,
      timeCommitment: sourceVersion.timeCommitment,
      compensation: sourceVersion.compensation,
      equity: sourceVersion.equity,
      vesting: sourceVersion.vesting,
      ipAssignment: sourceVersion.ipAssignment,
      confidentiality: sourceVersion.confidentiality,
      decisionMaking: sourceVersion.decisionMaking,
      termination: sourceVersion.termination,
      disputeResolution: sourceVersion.disputeResolution,
      notes: sourceVersion.notes,
    }
    const allowed = await applyCollaborationMutation(event, session, {
      action: "update_contract_version",
      contractId: "contract_ledgerloop",
      payload,
    })
    expect(allowed.result.contractVersionId).toEqual(expect.any(String))

    await expect(applyCollaborationMutation(event, session, {
      action: "update_contract_version",
      contractId: "contract_ledgerloop",
      payload,
    })).rejects.toMatchObject({ statusCode: 409 })
    const saved = await loadLocalCollaborationState(session.id)
    expect(saved?.contractVersions).toHaveLength(100)
    expect(saved?.contracts.find(contract => contract.id === "contract_ledgerloop")?.currentVersionId).toBe(allowed.result.contractVersionId)
  })

  it("keeps proposal comments open during negotiation and contracts gated on acceptance", async () => {
    const emma = buildSessionUser(workspaceSeed, "user_emma")!
    const sofia = buildSessionUser(workspaceSeed, "user_sofia")!

    await expect(applyCollaborationMutation(event, emma, {
      action: "create_contract_from_proposal",
      proposalId: "proposal_trialwire_design",
    })).rejects.toMatchObject({
      statusCode: 409,
    })

    const response = await applyCollaborationMutation(event, sofia, {
      action: "add_proposal_comment",
      body: "Please make the customer-research decision boundary explicit before acceptance.",
      proposalId: "proposal_trialwire_design",
      proposalVersionId: "proposal_version_trialwire_2",
      section: "decision_rights",
    })

    expect(response.result.commentId).toEqual(expect.any(String))
  })

  it("persists mock billing checkout and renewal changes", async () => {
    const initial = await loadMemberWorkspaceState(event, identity)
    const checkout = await persistMockCheckoutSubscription(event, initial.session, "pro", "annual")

    expect(checkout?.state.subscription).toMatchObject({
      billingCycle: "annual",
      cancelAtPeriodEnd: false,
      plan: "pro",
      status: "active",
    })
    expect(checkout?.state.subscription.stripeCheckoutSessionId).toMatch(/^mock_checkout_/)

    const cancel = await updateMockSubscriptionRenewal(event, checkout!.session, "cancel_at_period_end")
    expect(cancel?.state.subscription.cancelAtPeriodEnd).toBe(true)

    const resume = await updateMockSubscriptionRenewal(event, cancel!.session, "resume")
    expect(resume?.state.subscription.cancelAtPeriodEnd).toBe(false)

    const reloaded = await loadMemberWorkspaceState(event, identity)
    expect(reloaded.state.subscription).toMatchObject({
      billingCycle: "annual",
      cancelAtPeriodEnd: false,
      plan: "pro",
    })
  })
})
