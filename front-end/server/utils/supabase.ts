import type { H3Event } from "h3"
import { createClient } from "@supabase/supabase-js"

export function isSupabaseConfigured(event?: H3Event) {
  const runtimeConfig = useRuntimeConfig(event)
  return Boolean(runtimeConfig.public.supabaseUrl && runtimeConfig.public.supabaseAnonKey)
}

export function createSupabaseServerClient(event?: H3Event) {
  if (!isSupabaseConfigured(event))
    return null

  const runtimeConfig = useRuntimeConfig(event)

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
