import type { H3Event } from "h3"
import type { User } from "~/shared/types/domain"
import { workspaceSeed } from "~/shared/data/seed"
import { operationsLifecycleNotificationSchema } from "~/shared/utils/validation"
import { loadMemberWorkspaceState } from "../../../utils/member-workspace"
import { sendLifecycleNotification } from "../../../utils/notification-delivery"
import { requireOperationsWorker } from "../../../utils/operations-auth"
import { assertRateLimit, buildRateLimitKey } from "../../../utils/rate-limit"
import { createSupabaseAdminClient, isSupabaseEnabled } from "../../../utils/supabase"

interface LifecycleUserRow {
  email: string
  id: string
  onboarding_completed: boolean
  role: User["role"]
}

function displayNameForEmail(email: string) {
  return email.split("@")[0] || "CoFoundry member"
}

async function loadLifecycleWorkspace(event: H3Event, userId: string) {
  if (!isSupabaseEnabled(event))
    return workspaceSeed

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

  const { data, error } = await adminClient
    .from("users")
    .select("id,email,role,onboarding_completed")
    .eq("id", userId)
    .maybeSingle()

  if (error)
    throw error

  const user = data as LifecycleUserRow | null
  if (!user)
    throw createError({ statusCode: 404, statusMessage: "Lifecycle notification user was not found." })

  const workspace = await loadMemberWorkspaceState(event, {
    email: user.email,
    id: user.id,
    name: displayNameForEmail(user.email),
    onboardingCompleted: user.onboarding_completed,
    role: user.role,
    subscriptionPlan: "free",
  })

  return workspace.seed
}

export default defineEventHandler(async (event) => {
  requireOperationsWorker(event)

  assertRateLimit(event, {
    key: buildRateLimitKey(event, "operations-worker"),
    limit: 60,
    scope: "operations:lifecycle-notifications",
    windowMs: 60 * 60 * 1000,
  })

  const payload = operationsLifecycleNotificationSchema.parse(await readBody(event))
  const seed = await loadLifecycleWorkspace(event, payload.userId)
  const result = await sendLifecycleNotification(event, seed, payload, {
    dryRun: payload.dryRun,
    forceRecordOnlyReason: isSupabaseEnabled(event)
      ? undefined
      : "mock_mode",
  })

  return {
    delivered: result.delivery.delivered,
    eventType: result.plan.eventType,
    mode: isSupabaseEnabled(event)
      ? "supabase"
      : "mock",
    reason: result.delivery.reason,
    skipped: result.delivery.skipped === true,
    subject: result.plan.subject,
    targetId: result.plan.targetId,
    targetType: result.plan.targetType,
    userId: result.plan.userId,
  }
})
