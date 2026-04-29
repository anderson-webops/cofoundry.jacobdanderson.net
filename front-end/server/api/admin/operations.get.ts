import { requireAdminSession } from "../../utils/admin"
import { readLocalOperationsRows } from "../../utils/local-operations-store"
import { assertRateLimit, buildRateLimitKey } from "../../utils/rate-limit"
import { createSupabaseAdminClient, isSupabaseEnabled } from "../../utils/supabase"

async function selectRows(adminClient: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, table: string) {
  const { data, error } = await adminClient
    .from(table)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10)

  if (error)
    throw error

  return data || []
}

export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event)

  assertRateLimit(event, {
    key: buildRateLimitKey(event, session.id),
    limit: 30,
    scope: "admin:operations",
    windowMs: 60 * 1000,
  })

  if (!isSupabaseEnabled(event))
    return readLocalOperationsRows()

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

  const [backupRuns, fileUploads, notificationDeliveries, operationalEvents] = await Promise.all([
    selectRows(adminClient, "backup_runs"),
    selectRows(adminClient, "file_uploads"),
    selectRows(adminClient, "notification_deliveries"),
    selectRows(adminClient, "operational_events"),
  ])

  return {
    backupRuns,
    fileUploads,
    mode: "supabase",
    notificationDeliveries,
    operationalEvents,
  }
})
