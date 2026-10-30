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
  close?: () => Promise<void> | void
  push: (_message: WorkspaceRealtimePushMessage) => Promise<void> | void
}

export interface WorkspaceRealtimeSinkState {
  closed: boolean
}

export interface WorkspaceRealtimePushMessage {
  data: string
  event: string
  id?: string
  retry?: number
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
const maxFanoutMessages = 500
const maxRealtimeDataLength = 16_384
const maxRealtimeSubscribersPerUser = 5
const maxRealtimeSubscribersPerProcess = 1_000
const realtimeSinkPushTimeoutMs = 1_000

function isBoundedString(value: unknown, maximum: number, minimum = 1): value is string {
  return typeof value === "string" && value.length >= minimum && value.length <= maximum
}

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

export function resolveWorkspaceRealtimeFanoutDestination(
  env: Record<string, string | undefined> = process.env,
) {
  const value = env.COFOUNDRY_REALTIME_FANOUT_URL?.trim() || ""
  if (!value)
    return null

  let url: URL
  try {
    url = new URL(value)
  }
  catch {
    throw new Error("COFOUNDRY_REALTIME_FANOUT_URL must be an absolute HTTP(S) URL.")
  }

  const localHost = ["localhost", "127.0.0.1", "::1"].includes(url.hostname)
  if (
    !["http:", "https:"].includes(url.protocol)
    || !url.host
    || url.username
    || url.password
    || url.hash
    || (!localHost && url.protocol !== "https:")
  ) {
    throw new Error("COFOUNDRY_REALTIME_FANOUT_URL must be a credential-free HTTPS URL, except for local development.")
  }

  const configuredAppUrl = env.NUXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000"
  const sameOrigin = new URL(configuredAppUrl).origin === url.origin
  const token = (
    sameOrigin
      ? env.COFOUNDRY_OPERATIONS_TOKEN || env.OPERATIONS_WORKER_TOKEN
      : env.COFOUNDRY_REALTIME_FANOUT_TOKEN
  )?.trim() || ""

  if (token.length < 32) {
    throw new Error(
      sameOrigin
        ? "A strong COFOUNDRY_OPERATIONS_TOKEN is required for same-origin realtime fanout."
        : "A distinct COFOUNDRY_REALTIME_FANOUT_TOKEN is required for cross-origin realtime fanout.",
    )
  }

  return {
    token,
    url: url.toString(),
  }
}

function readFanoutTimeoutMs() {
  const value = Number.parseInt(process.env.COFOUNDRY_REALTIME_FANOUT_TIMEOUT_MS || "", 10)
  return Number.isFinite(value) && value > 0
    ? Math.min(value, 30_000)
    : 5_000
}

function readFanoutProvider() {
  return process.env.COFOUNDRY_REALTIME_FANOUT_PROVIDER?.trim() || (readFanoutUrl()
    ? "webhook"
    : "")
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

  if (
    !isBoundedString(envelope.createdAt, 80)
    || !Number.isFinite(Date.parse(envelope.createdAt))
    || !isBoundedString(envelope.idScope, 240)
    || !isBoundedString(envelope.sourceInstanceId, 160)
  ) {
    return null
  }

  if (
    !Array.isArray(envelope.messages)
    || !envelope.messages.length
    || envelope.messages.length > maxFanoutMessages
  ) {
    return null
  }

  const messages: WorkspaceRealtimeFanoutEnvelope["messages"] = []
  for (const item of envelope.messages) {
    if (!item || typeof item !== "object")
      return null

    const candidate = item as { message?: Partial<WorkspaceRealtimeMessage>, userId?: unknown }
    const message = candidate.message
    if (!message || !isBoundedString(candidate.userId, 160))
      return null

    if (
      message.event !== eventType
      || !isBoundedString(message.data, maxRealtimeDataLength)
      || !isBoundedString(message.id, 500)
      || (message.retry !== undefined && (
        !Number.isInteger(message.retry)
        || message.retry < 1_000
        || message.retry > 60_000
      ))
    ) {
      return null
    }

    messages.push({
      message: {
        data: message.data,
        event: message.event,
        id: message.id,
        retry: message.retry ?? 5000,
      },
      userId: candidate.userId,
    })
  }

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

  const currentUserSubscriptions = subscribers.get(normalizedUserId)?.size || 0
  if (
    currentUserSubscriptions >= maxRealtimeSubscribersPerUser
    || getWorkspaceRealtimeSubscriberCount() >= maxRealtimeSubscribersPerProcess
  ) {
    throw Object.assign(new Error("Realtime connection capacity has been reached."), {
      statusCode: 429,
      statusMessage: "Too many realtime connections are open. Close another session and try again.",
    })
  }

  const subscriptionId = randomUUID()
  const group = getSubscriberGroup(normalizedUserId)
  group.set(subscriptionId, sink)

  return () => {
    group.delete(subscriptionId)

    if (!group.size)
      subscribers.delete(normalizedUserId)
  }
}

export async function safePushWorkspaceRealtimeSink(
  sink: WorkspaceRealtimeSink,
  message: WorkspaceRealtimePushMessage,
  state?: WorkspaceRealtimeSinkState,
) {
  if (state?.closed)
    return false

  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      Promise.resolve(sink.push(message)),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error("Realtime sink push timed out.")), realtimeSinkPushTimeoutMs)
      }),
    ])
    return true
  }
  catch {
    if (state)
      state.closed = true

    if (sink.close) {
      Promise.resolve(sink.close()).catch(() => undefined)
    }

    return false
  }
  finally {
    if (timeout)
      clearTimeout(timeout)
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
  buildPayload: (_userId: string) => WorkspaceRealtimePayload | WorkspaceTypingRealtimePayload,
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
      if (await safePushWorkspaceRealtimeSink(sink, message)) {
        delivered += 1
        continue
      }

      group.delete(subscriptionId)
    }

    if (!group.size)
      subscribers.delete(userId)
  }

  return delivered
}

async function publishWorkspaceRealtimeFanout(envelope: WorkspaceRealtimeFanoutEnvelope) {
  try {
    const destination = resolveWorkspaceRealtimeFanoutDestination()
    if (!destination)
      return

    await fetch(destination.url, {
      body: JSON.stringify(envelope),
      headers: {
        "Authorization": `Bearer ${destination.token}`,
        "Content-Type": "application/json",
        "X-CoFoundry-Realtime-Instance": instanceId,
      },
      method: "POST",
      redirect: "error",
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
