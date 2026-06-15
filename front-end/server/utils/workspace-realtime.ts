import { randomUUID } from "node:crypto"

export type WorkspaceRealtimeEventType = "typing" | "workspace-change"

export interface WorkspaceRealtimePayload {
  createdAt: string
  metadata?: Record<string, string | null | undefined>
  source: string
  userId: string
}

export interface WorkspaceTypingRealtimePayload {
  conversationId: string
  createdAt: string
  isTyping: boolean
  userId: string
}

export interface WorkspaceRealtimeSink {
  push: (message: { data: string, event: string, id?: string, retry?: number }) => Promise<void> | void
}

const subscribers = new Map<string, Map<string, WorkspaceRealtimeSink>>()

function getSubscriberGroup(userId: string) {
  let group = subscribers.get(userId)

  if (!group) {
    group = new Map()
    subscribers.set(userId, group)
  }

  return group
}

function normalizeUserIds(userIds: string[]) {
  return Array.from(new Set(userIds.map(userId => userId.trim()).filter(Boolean)))
}

export function subscribeWorkspaceRealtime(userId: string, sink: WorkspaceRealtimeSink) {
  const normalizedUserId = userId.trim()
  if (!normalizedUserId)
    return () => {}

  const subscriptionId = randomUUID()
  const group = getSubscriberGroup(normalizedUserId)
  group.set(subscriptionId, sink)

  return () => {
    group.delete(subscriptionId)

    if (!group.size)
      subscribers.delete(normalizedUserId)
  }
}

export async function emitWorkspaceRealtimeChange(
  userIds: string[],
  payload: Omit<WorkspaceRealtimePayload, "createdAt" | "userId"> & { createdAt?: string },
) {
  const createdAt = payload.createdAt || new Date().toISOString()
  return emitWorkspaceRealtimeEvent(userIds, "workspace-change", userId => ({
    createdAt,
    metadata: payload.metadata || {},
    source: payload.source,
    userId,
  } satisfies WorkspaceRealtimePayload), payload.source, createdAt)
}

export async function emitWorkspaceTypingPresence(
  userIds: string[],
  payload: Omit<WorkspaceTypingRealtimePayload, "createdAt"> & { createdAt?: string },
) {
  const createdAt = payload.createdAt || new Date().toISOString()
  return emitWorkspaceRealtimeEvent(userIds, "typing", () => ({
    conversationId: payload.conversationId,
    createdAt,
    isTyping: payload.isTyping,
    userId: payload.userId,
  } satisfies WorkspaceTypingRealtimePayload), `typing:${payload.conversationId}:${payload.userId}`, createdAt)
}

async function emitWorkspaceRealtimeEvent(
  userIds: string[],
  eventType: WorkspaceRealtimeEventType,
  buildPayload: (userId: string) => WorkspaceRealtimePayload | WorkspaceTypingRealtimePayload,
  idScope: string,
  createdAt: string,
) {
  const normalizedUserIds = normalizeUserIds(userIds)
  let delivered = 0

  for (const userId of normalizedUserIds) {
    const group = subscribers.get(userId)
    if (!group?.size)
      continue

    const message = {
      data: JSON.stringify(buildPayload(userId)),
      event: eventType,
      id: `${createdAt}:${userId}:${idScope}`,
      retry: 5000,
    }

    for (const [subscriptionId, sink] of group.entries()) {
      try {
        await sink.push(message)
        delivered += 1
      }
      catch {
        group.delete(subscriptionId)
      }
    }

    if (!group.size)
      subscribers.delete(userId)
  }

  return delivered
}

export function getWorkspaceRealtimeSubscriberCount(userId?: string) {
  if (userId)
    return subscribers.get(userId)?.size || 0

  return Array.from(subscribers.values()).reduce((total, group) => total + group.size, 0)
}

export function clearWorkspaceRealtimeSubscribersForTests() {
  subscribers.clear()
}
