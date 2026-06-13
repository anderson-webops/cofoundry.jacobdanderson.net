import { describe, expect, it } from "vitest"
import { reactive } from "vue"
import { workspaceSeed } from "../../shared/data/seed"
import { cloneValue } from "../../shared/utils/clone"
import {
  addRelationshipDecisionTransition,
  canUserRespondToConnectRequest,
  collaborationContractNeedsUserSignature,
  collaborationProposalNeedsUserResponse,
  createConnectRequestTransition,
  createProposalTransition,
  isConnectRequestParticipant,
  isContractParticipant,
  isConversationParticipant,
  isNotificationOwnedByUser,
  isProposalParticipant,
  isRelationshipParticipant,
  markConversationReadTransition,
  markNotificationReadTransition,
  respondToConnectRequestTransition,
  sendMessageTransition,
} from "../../shared/utils/collaboration"
import { getCurrentContractVersion, getCurrentProposalVersion, getProposalById } from "../../shared/utils/workspace"

describe("collaboration helpers", () => {
  it("creates a structured intro and matching notification", () => {
    const transition = createConnectRequestTransition(
      workspaceSeed,
      "user_noah",
      "user_sofia",
      {
        note: "",
        structuredIntro: {
          context: "opportunity",
          roleContext: "Founding designer for SignalDeck",
          whyFit: "Design system depth plus B2B trust UX is the main gap.",
          whyNow: "Pilot traction already exists, so the role definition matters now.",
          proposedNextStep: "intro_call",
        },
      },
      "2026-04-16T12:00:00.000Z",
      {
        connectRequestId: "connect_noah_sofia",
        connectRequestNotificationId: "notification_noah_sofia",
      },
    )

    expect(transition.request.id).toBe("connect_noah_sofia")
    expect(transition.seed.connectRequests[0]?.structuredIntro.roleContext).toBe("Founding designer for SignalDeck")
    expect(transition.seed.notifications[0]).toMatchObject({
      id: "notification_noah_sofia",
      type: "match",
      userId: "user_sofia",
    })
  })

  it("accepts and declines connect requests with the correct downstream artifacts", () => {
    const accepted = respondToConnectRequestTransition(
      workspaceSeed,
      "connect_arjun_noah",
      "accepted",
      "2026-04-16T13:00:00.000Z",
      null,
      {
        conversationId: "conversation_arjun_noah",
        matchId: "match_arjun_noah",
        systemMessageId: "message_arjun_noah_system",
      },
    )

    expect(accepted.conversationId).toBe("conversation_arjun_noah")
    expect(accepted.seed.matches.some(match => match.id === "match_arjun_noah")).toBe(true)
    expect(accepted.seed.conversations.some(conversation => conversation.id === "conversation_arjun_noah")).toBe(true)
    expect(accepted.seed.messages.some(message => message.id === "message_arjun_noah_system")).toBe(true)

    const declined = respondToConnectRequestTransition(
      workspaceSeed,
      "connect_arjun_noah",
      "declined",
      "2026-04-16T13:30:00.000Z",
      "timing",
    )

    const declinedRequest = declined.seed.connectRequests.find(request => request.id === "connect_arjun_noah")
    expect(declined.conversationId).toBeNull()
    expect(declinedRequest?.status).toBe("declined")
    expect(declinedRequest?.declineReason).toBe("timing")
  })

  it("tracks unread conversation work and read-state transitions", () => {
    const withMessage = sendMessageTransition(
      workspaceSeed,
      "conversation_emma_sofia",
      "user_emma",
      "New update on the pilot workflow.",
      [],
      "2026-04-16T14:00:00.000Z",
      "user",
      { messageId: "message_emma_followup" },
    )

    const unreadConversation = withMessage.seed.conversations.find(conversation => conversation.id === "conversation_emma_sofia")
    expect(unreadConversation?.unreadCountByUser.user_sofia).toBe(1)

    const cleared = markConversationReadTransition(withMessage.seed, "conversation_emma_sofia", "user_sofia")
    const clearedConversation = cleared.conversations.find(conversation => conversation.id === "conversation_emma_sofia")
    expect(clearedConversation?.unreadCountByUser.user_sofia).toBe(0)
  })

  it("handles reactive workspace state when clearing unread conversations", () => {
    const reactiveSeed = reactive(cloneValue(workspaceSeed))

    const cleared = markConversationReadTransition(reactiveSeed, "conversation_olivia_malik", "user_olivia")
    const clearedConversation = cleared.conversations.find(conversation => conversation.id === "conversation_olivia_malik")

    expect(clearedConversation?.unreadCountByUser.user_olivia).toBe(0)
  })

  it("detects when proposals and contracts still require the member", () => {
    const proposal = getProposalById(workspaceSeed, "proposal_ledgerloop_cto")
    const contract = workspaceSeed.contracts.find(item => item.id === "contract_ledgerloop")

    expect(proposal).toBeDefined()
    expect(contract).toBeDefined()
    expect(collaborationProposalNeedsUserResponse(proposal!, getCurrentProposalVersion(workspaceSeed, proposal!), "user_malik")).toBe(true)
    expect(collaborationContractNeedsUserSignature(workspaceSeed, contract!, getCurrentContractVersion(workspaceSeed, contract!), workspaceSeed.signatures, "user_malik")).toBe(true)

    const newProposal = createProposalTransition(
      workspaceSeed,
      "user_emma",
      "user_sofia",
      "conversation_emma_sofia",
      "opp_trialwire",
      "Trialwire founding designer proposal",
      {
        relationshipType: "founding_team",
        roleTitle: "Founding Designer",
        responsibilities: ["Own trust-heavy onboarding and enterprise UX"],
        weeklyTimeCommitment: 40,
        startDate: "2026-05-01",
        fullTimeTrigger: "Pilot conversion",
        ceoDecision: "Emma remains CEO.",
        trialScope: "Two-week sprint",
        trialIpHandling: "Company-specific work stays confidential.",
        cashCompensation: "$8,000 monthly consulting retainer",
        equity: "6.5% option grant",
        vestingSchedule: "48 months monthly vesting",
        cliff: "12 months",
        decisionRights: "Design system ownership with founder review.",
        ipAssignmentRequired: true,
        confidentiality: "Mutual confidentiality.",
        exitTerms: "30-day written notice.",
        notes: "Structured as a founding design conversation.",
      },
      "2026-04-16T14:30:00.000Z",
      {
        proposalId: "proposal_trialwire_followup",
        proposalVersionId: "proposal_trialwire_followup_v1",
      },
    )

    const createdProposal = newProposal.seed.proposals.find(item => item.id === "proposal_trialwire_followup")
    expect(createdProposal).toBeDefined()
    expect(collaborationProposalNeedsUserResponse(createdProposal!, getCurrentProposalVersion(newProposal.seed, createdProposal!), "user_sofia")).toBe(true)
  })

  it("orders notifications newest-first and only marks the owner copy as read", () => {
    const seed = cloneValue(workspaceSeed)
    seed.notifications.unshift({
      id: "notification_newest",
      userId: "user_emma",
      type: "proposal",
      title: "Fresh update",
      body: "A new proposal comment landed.",
      href: "/app/proposals/proposal_trialwire_design",
      readAt: null,
      createdAt: "2026-04-16T15:00:00.000Z",
    })

    const marked = markNotificationReadTransition(seed, "notification_newest", "user_emma", "2026-04-16T15:05:00.000Z")
    expect(marked.changed).toBe(true)
    expect(marked.seed.notifications[0]?.id).toBe("notification_newest")
    expect(marked.seed.notifications[0]?.readAt).toBe("2026-04-16T15:05:00.000Z")

    const outsider = markNotificationReadTransition(seed, "notification_newest", "user_sofia", "2026-04-16T15:06:00.000Z")
    expect(outsider.changed).toBe(false)
    expect(outsider.seed.notifications.find(item => item.id === "notification_newest")?.readAt).toBeNull()
  })

  it("records relationship-level decisions only for match participants", () => {
    const transition = addRelationshipDecisionTransition(
      workspaceSeed,
      "match_olivia_malik",
      "user_olivia",
      "Investor update ownership",
      "Olivia owns the investor narrative; Malik reviews claims that depend on technical feasibility.",
      "documented",
      "2026-04-16T16:00:00.000Z",
      {
        relationshipDecisionId: "relationship_decision_investors",
        relationshipDecisionNotificationId: "notification_relationship_decision_investors",
      },
    )

    expect(transition.decision).toMatchObject({
      id: "relationship_decision_investors",
      matchId: "match_olivia_malik",
      status: "documented",
    })
    expect(transition.seed.relationshipDecisions[0]?.id).toBe("relationship_decision_investors")
    expect(transition.seed.notifications[0]).toMatchObject({
      id: "notification_relationship_decision_investors",
      href: "/app/relationships/match_olivia_malik",
      userId: "user_malik",
    })

    const rejected = addRelationshipDecisionTransition(
      workspaceSeed,
      "match_olivia_malik",
      "user_sofia",
      "Outside decision",
      "This should not be recorded because Sofia is not part of this match.",
      "open",
      "2026-04-16T16:05:00.000Z",
    )

    expect(rejected.decision).toBeNull()
    expect(rejected.seed.relationshipDecisions).toEqual(workspaceSeed.relationshipDecisions)
  })

  it("enforces ownership predicates before workflow actions run", () => {
    const request = workspaceSeed.connectRequests.find(item => item.id === "connect_arjun_noah")
    const conversation = workspaceSeed.conversations.find(item => item.id === "conversation_olivia_malik")
    const proposal = workspaceSeed.proposals.find(item => item.id === "proposal_ledgerloop_cto")
    const contract = workspaceSeed.contracts.find(item => item.id === "contract_ledgerloop")
    const notification = workspaceSeed.notifications.find(item => item.id === "notification_1")

    expect(request).toBeDefined()
    expect(conversation).toBeDefined()
    expect(proposal).toBeDefined()
    expect(contract).toBeDefined()
    expect(notification).toBeDefined()

    expect(isConnectRequestParticipant(request!, "user_noah")).toBe(true)
    expect(canUserRespondToConnectRequest(request!, "user_noah")).toBe(true)
    expect(canUserRespondToConnectRequest(request!, "user_arjun")).toBe(false)
    expect(isConversationParticipant(conversation!, "user_olivia")).toBe(true)
    expect(isConversationParticipant(conversation!, "user_emma")).toBe(false)
    expect(isProposalParticipant(proposal!, "user_malik")).toBe(true)
    expect(isProposalParticipant(proposal!, "user_emma")).toBe(false)
    expect(isContractParticipant(workspaceSeed, contract!, "user_malik")).toBe(true)
    expect(isContractParticipant(workspaceSeed, contract!, "user_sofia")).toBe(false)
    expect(isRelationshipParticipant(workspaceSeed, "match_olivia_malik", "user_olivia")).toBe(true)
    expect(isRelationshipParticipant(workspaceSeed, "match_olivia_malik", "user_sofia")).toBe(false)
    expect(isNotificationOwnedByUser(notification!, "user_olivia")).toBe(true)
    expect(isNotificationOwnedByUser(notification!, "user_malik")).toBe(false)
  })
})
