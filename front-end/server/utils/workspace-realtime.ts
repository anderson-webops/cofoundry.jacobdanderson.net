import { randomUUID } from "node:crypto"
import process from "node:process"

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

export interface WorkspaceRealtimeMessage {
  data: string
  event: WorkspaceRealtimeEventType
  id: string
  retry: number
}

export interface WorkspaceRealtimeFanoutEnvelope {
  createdAt: string
  eventType: WorkspaceRealtimeEventType
  idScope: string
  messages: Array<{
    message: WorkspaceRealtimeMessage
    userId: string
  }>
  sourceInstanceId: string
  version: 1
}

export interface WorkspaceRealtimeFanoutStatus {
  configured: boolean
  instanceId: string
  provider: string
  timeoutMs: number
  urlConfigured: boolean
}

const subscribers = new Map<string, Map<string, WorkspaceRealtimeSink>>()
const recentMessageIds = new Map<string, number>()
const instanceId = process.env.COFOUNDRY_INSTANCE_ID?.trim() || randomUUID()
const recentMessageTtlMs = 2 * 60 * 1000
const recentMessageLimit = 2_000

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

function readFanoutUrl() {
  return process.env.COFOUNDRY_REALTIME_FANOUT_URL?.trim() || ""
}

function readFanoutTimeoutMs() {
  const value = Number.parseInt(process.env.COFOUNDRY_REALTIME_FANOUT_TIMEOUT_MS || "", 10)
  return Number.isFinite(value) && value > 0 ? Math.min(value, 30_000) : 5_000
}

function readFanoutProvider() {
  return process.env.COFOUNDRY_REALTIME_FANOUT_PROVIDER?.trim() || (readFanoutUrl() ? "webhook" : "")
}

function rememberMessageId(messageId: string, now = Date.now()) {
  recentMessageIds.set(messageId, now)

  if (recentMessageIds.size <= recentMessageLimit)
    return

  const expiresBefore = now - recentMessageTtlMs
  for (const [id, seenAt] of recentMessageIds.entries()) {
    if (seenAt < expiresBefore || recentMessageIds.size > recentMessageLimit)
      recentMessageIds.delete(id)
  }
}

function hasSeenMessageId(messageId: string, now = Date.now()) {
  const seenAt = recentMessageIds.get(messageId)
  if (!seenAt)
    return false

  if (now - seenAt > recentMessageTtlMs) {
    recentMessageIds.delete(messageId)
    return false
  }

  return true
}

function normalizeFanoutEnvelope(value: unknown): WorkspaceRealtimeFanoutEnvelope | null {
  if (!value || typeof value !== "object")
    return null

  const envelope = value as Partial<WorkspaceRealtimeFanoutEnvelope>
  const eventType = envelope.eventType
  if (envelope.version !== 1 || (eventType !== "typing" && eventType !== "workspace-change"))
    return null

  if (typeof envelope.createdAt !== "string" || typeof envelope.idScope !== "string" || typeof envelope.sourceInstanceId !== "string")
    return null

  if (!Array.isArray(envelope.messages))
    return null

  const messages = envelope.messages
    .map((item) => {
      if (!item || typeof item !== "object")
        return null

      const candidate = item as { message?: Partial<WorkspaceRealtimeMessage>, userId?: unknown }
      const message = candidate.message
      if (!message || typeof candidate.userId !== "string")
        return null

      if (message.event !== eventType || typeof message.data !== "string" || typeof message.id !== "string")
        return null

      return {
        message: {
          data: message.data,
          event: message.event,
          id: message.id,
          retry: typeof message.retry === "number" && Number.isFinite(message.retry) ? message.retry : 5000,
        },
        userId: candidate.userId,
      }
    })
    .filter((item): item is WorkspaceRealtimeFanoutEnvelope["messages"][number] => Boolean(item))

  if (!messages.length)
    return null

  return {
    createdAt: envelope.createdAt,
    eventType,
    idScope: envelope.idScope,
    messages,
    sourceInstanceId: envelope.sourceInstanceId,
    version: 1,
  }
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

export function getWorkspaceRealtimeFanoutStatus(): WorkspaceRealtimeFanoutStatus {
  const fanoutUrl = readFanoutUrl()

  return {
    configured: Boolean(fanoutUrl),
    instanceId,
    provider: readFanoutProvider(),
    timeoutMs: readFanoutTimeoutMs(),
    urlConfigured: Boolean(fanoutUrl),
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
  const messages = normalizedUserIds.map((userId) => {
    const message = {
      data: JSON.stringify(buildPayload(userId)),
      event: eventType,
      id: `${createdAt}:${userId}:${idScope}`,
      retry: 5000,
    } satisfies WorkspaceRealtimeMessage

    return {
      message,
      userId,
    }
  })

  if (!messages.length)
    return 0

  const envelope = {
    createdAt,
    eventType,
    idScope,
    messages,
    sourceInstanceId: instanceId,
    version: 1,
  } satisfies WorkspaceRealtimeFanoutEnvelope
  const delivered = await deliverWorkspaceRealtimeEnvelope(envelope)
  void publishWorkspaceRealtimeFanout(envelope)

  return delivered
}

export async function deliverWorkspaceRealtimeEnvelope(value: unknown) {
  const envelope = normalizeFanoutEnvelope(value)
  if (!envelope)
    return 0

  let delivered = 0

  for (const { message, userId } of envelope.messages) {
    if (hasSeenMessageId(message.id))
      continue

    rememberMessageId(message.id)

    const group = subscribers.get(userId)
    if (!group?.size)
      continue

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

async function publishWorkspaceRealtimeFanout(envelope: WorkspaceRealtimeFanoutEnvelope) {
  const fanoutUrl = readFanoutUrl()
  if (!fanoutUrl)
    return

  const operationsToken = process.env.COFOUNDRY_OPERATIONS_TOKEN?.trim() || process.env.OPERATIONS_WORKER_TOKEN?.trim() || ""
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-CoFoundry-Realtime-Instance": instanceId,
  }

  if (operationsToken)
    headers.Authorization = `Bearer ${operationsToken}`

  try {
    await fetch(fanoutUrl, {
      body: JSON.stringify(envelope),
      headers,
      method: "POST",
      signal: AbortSignal.timeout(readFanoutTimeoutMs()),
    })
  }
  catch {
    // Realtime fanout must not make the authoritative workspace write fail.
  }
}

export function getWorkspaceRealtimeSubscriberCount(userId?: string) {
  if (userId)
    return subscribers.get(userId)?.size || 0

  return Array.from(subscribers.values()).reduce((total, group) => total + group.size, 0)
}

export function clearWorkspaceRealtimeSubscribersForTests() {
  subscribers.clear()
  recentMessageIds.clear()
}
