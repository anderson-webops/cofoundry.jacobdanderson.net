import type { H3Event } from "h3"
import type { Contract, WorkspaceSeed } from "../../shared/types/domain"
import { randomUUID } from "node:crypto"
import { cloneValue } from "../../shared/utils/clone"
import { getContractParticipantIds } from "../../shared/utils/collaboration"
import { persistServerCollaborationState } from "./member-collaboration"
import { emitWorkspaceRealtimeChange } from "./workspace-realtime"

export async function notifyContractLegalReviewParticipants(
  event: H3Event,
  seed: WorkspaceSeed,
  contract: Contract,
  input: {
    body: string
    excludeUserId?: string
    title: string
  },
) {
  const participantIds = getContractParticipantIds(seed, contract)
  const recipientIds = participantIds.filter(userId => userId !== input.excludeUserId)
  if (!recipientIds.length)
    return

  const nextSeed = cloneValue(seed)
  const createdAt = new Date().toISOString()
  nextSeed.notifications = [
    ...recipientIds.map(userId => ({
      body: input.body,
      createdAt,
      href: `/app/contracts/${contract.id}`,
      id: randomUUID(),
      readAt: null,
      title: input.title,
      type: "contract" as const,
      userId,
    })),
    ...nextSeed.notifications,
  ]

  await persistServerCollaborationState(event, participantIds, nextSeed, { expectedSeed: seed })
  await emitWorkspaceRealtimeChange(participantIds, {
    metadata: {
      action: "contract_legal_review_updated",
      contractId: contract.id,
    },
    source: "contract.legal-review",
  })
}
