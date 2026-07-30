import { requireAuthenticatedSession } from "~/server/utils/auth"
import { isConversationParticipant } from "~/shared/utils/collaboration"
import { typingPresenceSchema } from "~/shared/utils/validation"
import { loadMemberWorkspaceState } from "../../utils/member-workspace"
import { assertRateLimit, buildRateLimitKey } from "../../utils/rate-limit"
import { emitWorkspaceTypingPresence } from "../../utils/workspace-realtime"

export default defineEventHandler(async (event) => {
  const session = await requireAuthenticatedSession(event)
  assertRateLimit(event, {
    key: buildRateLimitKey(event, session.id),
    limit: 180,
    scope: "workspace:typing",
    windowMs: 60 * 1000,
  })

  const payload = typingPresenceSchema.parse(await readBody(event))
  const conversationId = payload.conversationId

  const workspace = await loadMemberWorkspaceState(event, {
    email: session.email,
    id: session.id,
    name: session.name,
    onboardingCompleted: session.onboardingCompleted,
    role: session.role,
    subscriptionPlan: session.subscriptionPlan,
  })
  const conversation = workspace.seed.conversations.find(item => item.id === conversationId)

  if (!conversation)
    throw createError({ statusCode: 404, statusMessage: "Conversation not found." })
  if (!isConversationParticipant(conversation, session.id))
    throw createError({ statusCode: 403, statusMessage: "You are not part of this conversation." })

  const recipients = conversation.participantIds.filter(userId => userId !== session.id)
  const delivered = await emitWorkspaceTypingPresence(recipients, {
    conversationId,
    isTyping: payload.isTyping === true,
    userId: session.id,
  })

  return {
    delivered,
    ok: true,
  }
})
