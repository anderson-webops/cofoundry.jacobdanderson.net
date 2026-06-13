import type { WorkspaceSeed } from "../../shared/types/domain"
import { describe, expect, it } from "vitest"
import { workspaceSeed } from "../../shared/data/seed"
import { addProposalCommentTransition, addRelationshipDecisionTransition } from "../../shared/utils/collaboration"
import {
  buildRelationshipSnapshot,
  getRelationshipHrefForContract,
  getRelationshipHrefForConversation,
  getRelationshipHrefForProposal,
} from "../../shared/utils/relationships"

describe("relationship snapshots", () => {
  it("aggregates the participant relationship workspace from one match id", () => {
    const snapshot = buildRelationshipSnapshot(workspaceSeed, "user_olivia", "match_olivia_malik")

    expect(snapshot?.counterpartProfile.userId).toBe("user_malik")
    expect(snapshot?.conversationId).toBe("conversation_olivia_malik")
    expect(snapshot?.latestMessages.length).toBeGreaterThan(0)
    expect(snapshot?.nextActions.length).toBeGreaterThan(0)
  })

  it("rejects non-participants", () => {
    expect(buildRelationshipSnapshot(workspaceSeed, "user_sofia", "match_olivia_malik")).toBeNull()
  })

  it("maps conversation, proposal, and contract records back to the same relationship workspace", () => {
    expect(getRelationshipHrefForConversation(workspaceSeed, "user_olivia", "conversation_olivia_malik")).toBe("/app/relationships/match_olivia_malik")
    expect(getRelationshipHrefForProposal(workspaceSeed, "user_malik", "proposal_ledgerloop_cto")).toBe("/app/relationships/match_olivia_malik")
    expect(getRelationshipHrefForContract(workspaceSeed, "user_olivia", "contract_ledgerloop")).toBe("/app/relationships/match_olivia_malik")
  })

  it("does not expose relationship hrefs to non-participants", () => {
    expect(getRelationshipHrefForConversation(workspaceSeed, "user_sofia", "conversation_olivia_malik")).toBeNull()
    expect(getRelationshipHrefForProposal(workspaceSeed, "user_sofia", "proposal_ledgerloop_cto")).toBeNull()
    expect(getRelationshipHrefForContract(workspaceSeed, "user_sofia", "contract_ledgerloop")).toBeNull()
  })

  it("prioritizes relationship actions that require the current member", () => {
    const snapshot = buildRelationshipSnapshot(workspaceSeed, "user_malik", "match_olivia_malik")

    expect(snapshot?.nextActions.map(action => action.id)).toContain("proposal:proposal_ledgerloop_cto")
    expect(snapshot?.nextActions.map(action => action.id)).toContain("contract:contract_ledgerloop")
  })

  it("builds a unified timeline from messages, proposal activity, agreement activity, trial work, and files", () => {
    const snapshot = buildRelationshipSnapshot(workspaceSeed, "user_olivia", "match_olivia_malik")
    const timeline = snapshot?.timeline || []
    const createdAtTimes = timeline.map(entry => new Date(entry.createdAt).getTime())
    const sortedTimes = [...createdAtTimes].sort((left, right) => right - left)

    expect(createdAtTimes).toEqual(sortedTimes)
    expect(timeline.map(entry => entry.kind)).toEqual(expect.arrayContaining([
      "comment",
      "contract",
      "file",
      "decision",
      "message",
      "proposal",
      "signature",
      "trial",
    ]))
    expect(timeline[0]?.id).toBe("message:message_5")
  })

  it("surfaces relationship files from shared message attachments", () => {
    const snapshot = buildRelationshipSnapshot(workspaceSeed, "user_olivia", "match_olivia_malik")

    expect(snapshot?.files).toEqual(expect.arrayContaining([
      expect.objectContaining({
        href: "/app/messages/conversation_olivia_malik",
        id: "att_1",
        name: "ledgerloop-customer-notes.pdf",
        scanStatus: "not_applicable",
        sourceLabel: "Message attachment",
        status: "shared",
      }),
    ]))
  })

  it("surfaces durable file uploads attached to relationship artifacts", () => {
    const seedWithUploads: WorkspaceSeed = {
      ...workspaceSeed,
      fileUploads: [{
        bucket: "cofoundry-private-files",
        createdAt: "2026-04-29T14:30:00.000Z",
        deletedAt: null,
        id: "upload_ledgerloop_terms",
        mimeType: "application/pdf",
        objectPath: "user_olivia/2026-04-29/upload-ledgerloop-terms.pdf",
        originalFilename: "ledgerloop-terms-review.pdf",
        ownerUserId: "user_olivia",
        purpose: "proposal_attachment",
        relatedId: "proposal_ledgerloop_cto",
        relatedType: "proposal",
        scanNotes: "Clean scanner result.",
        scanStatus: "clean",
        sizeBytes: 153600,
        status: "uploaded",
        updatedAt: "2026-04-29T14:31:00.000Z",
      }],
    }
    const snapshot = buildRelationshipSnapshot(seedWithUploads, "user_olivia", "match_olivia_malik")

    expect(snapshot?.files).toEqual(expect.arrayContaining([
      expect.objectContaining({
        href: "/app/proposals/proposal_ledgerloop_cto",
        id: "upload_ledgerloop_terms",
        name: "ledgerloop-terms-review.pdf",
        scanStatus: "clean",
        sizeLabel: "150 KB",
        sourceLabel: "Proposal upload",
        status: "uploaded",
      }),
    ]))
    expect(snapshot?.timeline).toEqual(expect.arrayContaining([
      expect.objectContaining({
        href: "/app/proposals/proposal_ledgerloop_cto",
        id: "file:upload_ledgerloop_terms",
        kind: "file",
        title: "Proposal upload",
      }),
    ]))
  })

  it("derives a decision log from proposal terms, decision-rights comments, contract clauses, and trial requirements", () => {
    const snapshot = buildRelationshipSnapshot(workspaceSeed, "user_olivia", "match_olivia_malik")
    const decisionIds = snapshot?.decisionLog.map(entry => entry.id)

    expect(decisionIds).toEqual(expect.arrayContaining([
      "contract-decision:contract_version_ledgerloop_1",
      "decision-comment:proposal_comment_1",
      "proposal-decision:proposal_version_ledgerloop_2",
      "relationship-decision:relationship_decision_ledgerloop_governance",
      "trial-decision-log:trial_olivia_malik",
    ]))
    expect(snapshot?.decisionLog.find(entry => entry.id === "relationship-decision:relationship_decision_ledgerloop_governance")?.status).toBe("documented")
    expect(snapshot?.decisionLog.find(entry => entry.id === "decision-comment:proposal_comment_1")?.status).toBe("open")
    expect(snapshot?.decisionLog.find(entry => entry.id === "contract-decision:contract_version_ledgerloop_1")?.status).toBe("documented")
  })

  it("adds relationship-level decision notes before another proposal version exists", () => {
    const transition = addRelationshipDecisionTransition(
      workspaceSeed,
      "match_olivia_malik",
      "user_malik",
      "Customer-call ownership",
      "Olivia owns customer agenda and pricing questions; Malik owns technical feasibility and integration follow-up.",
      "open",
      "2026-04-29T15:30:00.000Z",
      {
        relationshipDecisionId: "relationship_decision_customer_calls",
        relationshipDecisionNotificationId: "notification_relationship_decision",
      },
    )

    const snapshot = buildRelationshipSnapshot(transition.seed, "user_olivia", "match_olivia_malik")

    expect(snapshot?.decisionLog).toEqual(expect.arrayContaining([
      expect.objectContaining({
        href: "/app/relationships/match_olivia_malik",
        id: "relationship-decision:relationship_decision_customer_calls",
        ownerUserId: "user_malik",
        status: "open",
        summary: "Olivia owns customer agenda and pricing questions; Malik owns technical feasibility and integration follow-up.",
        title: "Customer-call ownership",
      }),
    ]))
    expect(snapshot?.timeline).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "relationship-decision:relationship_decision_customer_calls",
        kind: "decision",
        title: "Customer-call ownership",
      }),
    ]))
    expect(transition.seed.notifications).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "notification_relationship_decision",
        href: "/app/relationships/match_olivia_malik",
        type: "match",
        userId: "user_olivia",
      }),
    ]))
  })

  it("adds newly written decision-rights comments to the relationship decision log", () => {
    const transition = addProposalCommentTransition(
      workspaceSeed,
      "proposal_ledgerloop_cto",
      "proposal_version_ledgerloop_2",
      "user_olivia",
      "decision_rights",
      "Malik owns architecture decisions unless the choice changes financing, compliance, or company strategy.",
      "2026-04-29T15:00:00.000Z",
      {
        proposalCommentId: "proposal_comment_decision_note",
        proposalNotificationId: "notification_decision_note",
      },
    )

    const snapshot = buildRelationshipSnapshot(transition.seed, "user_olivia", "match_olivia_malik")

    expect(snapshot?.decisionLog).toEqual(expect.arrayContaining([
      expect.objectContaining({
        href: "/app/proposals/proposal_ledgerloop_cto",
        id: "decision-comment:proposal_comment_decision_note",
        ownerUserId: "user_olivia",
        status: "open",
        summary: "Malik owns architecture decisions unless the choice changes financing, compliance, or company strategy.",
        title: "Decision-rights question",
      }),
    ]))
    expect(snapshot?.timeline).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "proposal-comment:proposal_comment_decision_note",
        kind: "comment",
        title: "Proposal comment",
      }),
    ]))
  })
})
