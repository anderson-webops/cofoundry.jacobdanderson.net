import type { H3Event } from "h3"
import type { SessionUser, WorkspaceSeed } from "~/shared/types/domain"
import { randomUUID } from "node:crypto"
import { isContactMailConfigured, sendPlainTextEmail } from "./contact"
import { recordLocalNotificationDelivery } from "./local-operations-store"
import { createSupabaseAdminClient, isSupabaseEnabled } from "./supabase"

export interface NotificationDeliveryResult {
  configured: boolean
  delivered: boolean
  error: string | null
  subject: string
  suppressed?: boolean
  unreadCount: number
}

export interface UnreadNotificationDigestOptions {
  respectPreferences?: boolean
}

export function buildDigestSubject(unreadCount: number) {
  return unreadCount === 1
    ? "CoFoundry: 1 workspace item needs attention"
    : `CoFoundry: ${unreadCount} workspace items need attention`
}

export function isScheduledDigestEmailEnabled(seed: WorkspaceSeed, userId: string) {
  return seed.users.find(user => user.id === userId)?.notificationPreferences?.unreadDigestEmail === true
}

function buildDigestBody(seed: WorkspaceSeed, session: SessionUser) {
  const unreadNotifications = seed.notifications
    .filter(notification => notification.userId === session.id && !notification.readAt)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())

  const lines = [
    `Hi ${session.name},`,
    "",
    unreadNotifications.length
      ? "These CoFoundry workspace items still need attention:"
      : "Your CoFoundry workspace queue is clear right now.",
    "",
    ...unreadNotifications.slice(0, 10).flatMap(notification => [
      `- ${notification.title}`,
      `  ${notification.body}`,
      `  ${notification.href}`,
    ]),
    "",
    "Open your workspace to handle the queue:",
    "/app/inbox",
    "",
    "CoFoundry",
  ]

  return {
    body: lines.join("\n"),
    unreadNotifications,
  }
}

export async function recordNotificationDelivery(event: H3Event, session: SessionUser, result: NotificationDeliveryResult) {
  if (!isSupabaseEnabled(event))
    return recordLocalNotificationDelivery(session, result)

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

  const { error } = await adminClient
    .from("notification_deliveries")
    .insert({
      id: randomUUID(),
      user_id: session.id,
      channel: "email",
      status: result.delivered ? "sent" : result.configured ? "failed" : "skipped",
      subject: result.subject,
      recipient: session.email,
      notification_count: result.unreadCount,
      error: result.error,
      delivered_at: result.delivered ? new Date().toISOString() : null,
    })

  if (error)
    throw error
}

export async function sendUnreadNotificationDigest(event: H3Event, seed: WorkspaceSeed, session: SessionUser, options: UnreadNotificationDigestOptions = {}) {
  const { body, unreadNotifications } = buildDigestBody(seed, session)
  const subject = buildDigestSubject(unreadNotifications.length)

  if (options.respectPreferences && !isScheduledDigestEmailEnabled(seed, session.id)) {
    const result: NotificationDeliveryResult = {
      configured: false,
      delivered: false,
      error: "Scheduled digest email is disabled for this member.",
      subject,
      suppressed: true,
      unreadCount: unreadNotifications.length,
    }
    await recordNotificationDelivery(event, session, result)
    return result
  }

  if (!isContactMailConfigured()) {
    const result: NotificationDeliveryResult = {
      configured: false,
      delivered: false,
      error: null,
      subject,
      unreadCount: unreadNotifications.length,
    }
    await recordNotificationDelivery(event, session, result)
    return result
  }

  try {
    await sendPlainTextEmail({
      body,
      subject,
      toEmail: session.email,
    })

    const result: NotificationDeliveryResult = {
      configured: true,
      delivered: true,
      error: null,
      subject,
      unreadCount: unreadNotifications.length,
    }
    await recordNotificationDelivery(event, session, result)
    return result
  }
  catch (error) {
    const result: NotificationDeliveryResult = {
      configured: true,
      delivered: false,
      error: error instanceof Error ? error.message : "Email delivery failed",
      subject,
      unreadCount: unreadNotifications.length,
    }
    await recordNotificationDelivery(event, session, result)
    return result
  }
}
