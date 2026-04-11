import type { H3Event } from "h3"
import { createClient } from "@supabase/supabase-js"

export function isSupabaseEnabled(event?: H3Event) {
  const runtimeConfig = useRuntimeConfig(event)
  return runtimeConfig.public.backendMode === "supabase"
}

export function createSupabaseServerClient(event?: H3Event) {
  if (!isSupabaseEnabled(event))
    return null

  const runtimeConfig = useRuntimeConfig(event)

  if (!runtimeConfig.public.supabaseUrl || !runtimeConfig.public.supabaseAnonKey) {
    throw createError({
      statusCode: 500,
      statusMessage: "Supabase mode is enabled but the public Supabase URL or anon key is missing from runtime config.",
    })
  }

  return createClient(
    runtimeConfig.public.supabaseUrl,
    runtimeConfig.public.supabaseAnonKey,
    {
      auth: {
        persistSession: false,
      },
    },
  )
}
