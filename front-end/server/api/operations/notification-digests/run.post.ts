import type { User } from "~/shared/types/domain"
import { workspaceSeed } from "~/shared/data/seed"
import { operationsDigestRunSchema } from "~/shared/utils/validation"
import { buildSessionUser } from "~/shared/utils/workspace"
import { loadMemberWorkspaceState } from "../../../utils/member-workspace"
import { buildDigestSubject, recordNotificationDelivery, sendUnreadNotificationDigest } from "../../../utils/notification-delivery"
import { requireOperationsWorker } from "../../../utils/operations-auth"
import { assertRateLimit, buildRateLimitKey } from "../../../utils/rate-limit"
import { createSupabaseAdminClient, isSupabaseEnabled } from "../../../utils/supabase"

interface DigestUserRow {
  email: string
  id: string
  onboarding_completed: boolean
  role: User["role"]
}

function displayNameForEmail(email: string) {
  return email.split("@")[0] || "CoFoundry member"
}

function unreadCountForUser(userId: string) {
  return workspaceSeed.notifications.filter(notification => notification.userId === userId && !notification.readAt).length
}

function selectMockDigestSessions(options: { maxUsers: number, onlyWithUnread: boolean, userId?: string }) {
  return workspaceSeed.users
    .filter(user => !options.userId || user.id === options.userId)
    .map(user => buildSessionUser(workspaceSeed, user.id))
    .filter((session): session is NonNullable<typeof session> => Boolean(session))
    .filter(session => !options.onlyWithUnread || unreadCountForUser(session.id) > 0)
    .slice(0, options.maxUsers)
}

async function selectUnreadUserIds(adminClient: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, maxUsers: number) {
  const { data, error } = await adminClient
    .from("notifications")
    .select("user_id")
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(maxUsers * 10)

  if (error)
    throw error

  return [...new Set((data || []).map(row => String(row.user_id)).filter(Boolean))].slice(0, maxUsers)
}

async function selectDigestUsers(
  adminClient: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  options: { maxUsers: number, onlyWithUnread: boolean, userId?: string },
) {
  const userIds = options.userId
    ? [options.userId]
    : options.onlyWithUnread
      ? await selectUnreadUserIds(adminClient, options.maxUsers)
      : []

  if (options.onlyWithUnread && !userIds.length)
    return [] as DigestUserRow[]

  const query = adminClient
    .from("users")
    .select("id,email,role,onboarding_completed")
    .order("created_at", { ascending: true })
    .limit(options.maxUsers)

  const { data, error } = userIds.length
    ? await query.in("id", userIds)
    : await query

  if (error)
    throw error

  return (data || []) as DigestUserRow[]
}

export default defineEventHandler(async (event) => {
  requireOperationsWorker(event)

  assertRateLimit(event, {
    key: buildRateLimitKey(event, "operations-worker"),
    limit: 20,
    scope: "operations:notification-digests",
    windowMs: 60 * 60 * 1000,
  })

  const payload = operationsDigestRunSchema.parse(await readBody(event))

  if (!isSupabaseEnabled(event)) {
    const sessions = selectMockDigestSessions(payload)
    const results = []

    for (const session of sessions) {
      const unreadCount = unreadCountForUser(session.id)
      const reason = payload.dryRun ? "dry_run" : "mock_mode"

      await recordNotificationDelivery(event, session, {
        configured: false,
        delivered: false,
        error: reason === "dry_run" ? "Dry run; no email sent." : "Mock mode records scheduled digest runs without sending email.",
        subject: buildDigestSubject(unreadCount),
        unreadCount,
      })

      results.push({
        delivered: false,
        reason,
        unreadCount,
        userId: session.id,
      })
    }

    if (!sessions.length) {
      await recordNotificationDelivery(event, {
        email: "operations-worker@cofoundry.local",
        id: "operations-worker",
        name: "Operations worker",
        onboardingCompleted: true,
        role: "admin",
        subscriptionPlan: "free",
      }, {
        configured: false,
        delivered: false,
        error: "No mock users matched the scheduled digest criteria.",
        subject: "CoFoundry: scheduled digest run",
        unreadCount: 0,
      })
    }

    return {
      dryRun: payload.dryRun,
      failures: [],
      mode: "mock",
      processed: sessions.length,
      results,
      sent: 0,
      skipped: sessions.length || 1,
    }
  }

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

  const users = await selectDigestUsers(adminClient, payload)
  const results = []
  const failures = []

  for (const user of users) {
    try {
      const workspace = await loadMemberWorkspaceState(event, {
        email: user.email,
        id: user.id,
        name: displayNameForEmail(user.email),
        onboardingCompleted: user.onboarding_completed,
        role: user.role,
        subscriptionPlan: "free",
      })
      const unreadCount = workspace.seed.notifications.filter(notification => notification.userId === workspace.session.id && !notification.readAt).length

      if (payload.onlyWithUnread && !unreadCount) {
        results.push({
          delivered: false,
          reason: "no_unread_notifications",
          unreadCount,
          userId: user.id,
        })
        continue
      }

      if (payload.dryRun) {
        results.push({
          delivered: false,
          reason: "dry_run",
          unreadCount,
          userId: user.id,
        })
        continue
      }

      const delivery = await sendUnreadNotificationDigest(event, workspace.seed, workspace.session)
      results.push({
        configured: delivery.configured,
        delivered: delivery.delivered,
        reason: delivery.delivered ? "sent" : delivery.configured ? "delivery_failed" : "mail_not_configured",
        unreadCount: delivery.unreadCount,
        userId: user.id,
      })
    }
    catch (error) {
      failures.push({
        error: error instanceof Error ? error.message : "Digest processing failed.",
        userId: user.id,
      })
    }
  }

  return {
    dryRun: payload.dryRun,
    failed: failures.length,
    failures,
    mode: "supabase",
    processed: users.length,
    results,
    sent: results.filter(result => result.delivered).length,
    skipped: results.filter(result => !result.delivered).length,
  }
})
