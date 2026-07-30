import { describe, expect, it } from "vitest"
import { workspaceSeed } from "../../shared/data/seed"
import {
  buildInboxQueues,
  buildInboxSnapshot,
  contractNeedsUserSignature,
  getContractsNeedingSignature,
  getPendingIncomingConnectRequestsForUser,
  getProposalsNeedingResponse,
  getUnreadConversationsForUser,
  proposalNeedsUserResponse,
  sanitizeNotificationHref,
} from "../../shared/utils/inbox"

describe("inbox helpers", () => {
  it("surfaces pending intros for the targeted member", () => {
    const pendingForNoah = getPendingIncomingConnectRequestsForUser(workspaceSeed, "user_noah")

    expect(pendingForNoah).toHaveLength(1)
    expect(pendingForNoah[0]?.fromUserId).toBe("user_arjun")
  })

  it("finds proposal and contract actions that still need the member", () => {
    const proposal = workspaceSeed.proposals.find(item => item.id === "proposal_ledgerloop_cto")
    const contract = workspaceSeed.contracts.find(item => item.id === "contract_ledgerloop")

    expect(proposal).toBeDefined()
    expect(contract).toBeDefined()
    expect(proposalNeedsUserResponse(workspaceSeed, proposal!, "user_malik")).toBe(true)
    expect(contractNeedsUserSignature(workspaceSeed, contract!, "user_malik")).toBe(true)
    expect(getProposalsNeedingResponse(workspaceSeed, "user_malik")).toHaveLength(1)
    expect(getContractsNeedingSignature(workspaceSeed, "user_malik")).toHaveLength(1)
  })

  it("builds a sorted action queue for the current member", () => {
    const snapshot = buildInboxSnapshot(workspaceSeed, "user_malik")
    const queues = buildInboxQueues(workspaceSeed, "user_malik")

    expect(snapshot.counts.unreadConversations).toBe(1)
    expect(snapshot.counts.proposalsNeedingResponse).toBe(1)
    expect(snapshot.counts.contractsNeedingSignature).toBe(1)
    expect(queues.unreadConversations).toHaveLength(snapshot.counts.unreadConversations)
    expect(queues.proposalsNeedingResponse).toHaveLength(snapshot.counts.proposalsNeedingResponse)
    expect(queues.contractsNeedingSignature).toHaveLength(snapshot.counts.contractsNeedingSignature)
    expect(snapshot.actions[0]?.kind).toBe("message")
    expect(snapshot.actions.some(item => item.kind === "proposal")).toBe(true)
    expect(snapshot.actions.some(item => item.kind === "contract")).toBe(true)
  })

  it("keeps granular inbox queues aligned with aggregate counts", () => {
    const queues = buildInboxQueues(workspaceSeed, "user_noah")
    const snapshot = buildInboxSnapshot(workspaceSeed, "user_noah", queues)

    expect(snapshot.counts).toMatchObject({
      contractsNeedingSignature: queues.contractsNeedingSignature.length,
      pendingIntros: queues.pendingIncomingRequests.length,
      proposalsNeedingResponse: queues.proposalsNeedingResponse.length,
      unreadConversations: queues.unreadConversations.length,
      unreadNotifications: queues.unreadNotifications.length,
      waitingOnReplies: queues.pendingOutgoingRequests.length,
    })
    expect(queues.pendingIncomingRequests[0]?.id).toBe("connect_arjun_noah")
  })

  it("keeps notifications visible when they are not already represented by a deeper queue item", () => {
    const unreadForOlivia = buildInboxSnapshot(workspaceSeed, "user_olivia")
    const unreadForEmma = buildInboxSnapshot(workspaceSeed, "user_emma")

    expect(getUnreadConversationsForUser(workspaceSeed, "user_olivia")).toHaveLength(0)
    expect(unreadForOlivia.counts.unreadNotifications).toBe(1)
    expect(unreadForOlivia.actions.some(item => item.kind === "notification")).toBe(true)
    expect(unreadForEmma.actions.some(item => item.kind === "notification")).toBe(true)
  })

  it("limits stored notification links to normalized internal app routes", () => {
    expect(sanitizeNotificationHref("/app/proposals/proposal_1?tab=history#latest")).toBe("/app/proposals/proposal_1?tab=history#latest")
    expect(sanitizeNotificationHref("https://attacker.example/phish")).toBe("/app/inbox")
    expect(sanitizeNotificationHref("//attacker.example/phish")).toBe("/app/inbox")
    expect(sanitizeNotificationHref("/app/../../admin")).toBe("/app/inbox")
    expect(sanitizeNotificationHref("javascript:alert(1)")).toBe("/app/inbox")
  })

  it("sanitizes unsafe notification links before building member actions", () => {
    const seed = structuredClone(workspaceSeed)
    const notification = seed.notifications.find(item => item.userId === "user_olivia")!
    notification.href = "https://attacker.example/phish"

    const action = buildInboxSnapshot(seed, "user_olivia").actions.find(item => item.id === `notification:${notification.id}`)

    expect(action?.href).toBe("/app/inbox")
  })
})
