import type { H3Event } from "h3"
import type { SessionUser, WorkspaceSeed } from "~/shared/types/domain"
import { randomUUID } from "node:crypto"
import { buildInboxSnapshot } from "../../shared/utils/inbox"
import { isContactMailConfigured, sendPlainTextEmail } from "./contact"
import { recordLocalNotificationDelivery } from "./local-operations-store"
import { createSupabaseAdminClient, isSupabaseEnabled } from "./supabase"

export interface NotificationDeliveryResult {
  configured: boolean
  delivered: boolean
  error: string | null
  reason?: "email_digest_disabled" | "mail_not_configured" | "no_workspace_items" | "sent" | "delivery_failed"
  skipped?: boolean
  subject: string
  suppressed?: boolean
  unreadCount: number
}

export interface UnreadNotificationDigestOptions {
  respectPreferences?: boolean
  skipIfEmpty?: boolean
}

export function buildDigestSubject(unreadCount: number) {
  return unreadCount === 1
    ? "CoFoundry: 1 workspace item needs attention"
    : `CoFoundry: ${unreadCount} workspace items need attention`
}

export function isScheduledDigestEmailEnabled(seed: WorkspaceSeed, userId: string) {
  return seed.users.find(user => user.id === userId)?.notificationPreferences?.unreadDigestEmail === true
}

export function buildDigestContent(seed: WorkspaceSeed, session: SessionUser) {
  const snapshot = buildInboxSnapshot(seed, session.id)

  const lines = [
    `Hi ${session.name},`,
    "",
    snapshot.actions.length
      ? "These CoFoundry workspace items still need attention:"
      : "Your CoFoundry workspace queue is clear right now.",
    "",
    ...snapshot.actions.slice(0, 10).flatMap(item => [
      `- ${item.title}`,
      `  ${item.summary}`,
      `  ${item.href}`,
    ]),
    "",
    "Open your workspace to handle the queue:",
    "/app/inbox",
    "",
    "CoFoundry",
  ]

  return {
    body: lines.join("\n"),
    snapshot,
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
  const { body, snapshot } = buildDigestContent(seed, session)
  const subject = buildDigestSubject(snapshot.actions.length)

  if (options.skipIfEmpty && !snapshot.actions.length) {
    return {
      configured: isContactMailConfigured(),
      delivered: false,
      error: null,
      reason: "no_workspace_items",
      skipped: true,
      subject,
      unreadCount: 0,
    } satisfies NotificationDeliveryResult
  }

  if (options.respectPreferences && !isScheduledDigestEmailEnabled(seed, session.id)) {
    const result: NotificationDeliveryResult = {
      configured: false,
      delivered: false,
      error: "Scheduled digest email is disabled for this member.",
      reason: "email_digest_disabled",
      subject,
      suppressed: true,
      unreadCount: snapshot.actions.length,
    }
    await recordNotificationDelivery(event, session, result)
    return result
  }

  if (!isContactMailConfigured()) {
    const result: NotificationDeliveryResult = {
      configured: false,
      delivered: false,
      error: null,
      reason: "mail_not_configured",
      subject,
      unreadCount: snapshot.actions.length,
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
      reason: "sent",
      subject,
      unreadCount: snapshot.actions.length,
    }
    await recordNotificationDelivery(event, session, result)
    return result
  }
  catch (error) {
    const result: NotificationDeliveryResult = {
      configured: true,
      delivered: false,
      error: error instanceof Error ? error.message : "Email delivery failed",
      reason: "delivery_failed",
      subject,
      unreadCount: snapshot.actions.length,
    }
    await recordNotificationDelivery(event, session, result)
    return result
  }
}
