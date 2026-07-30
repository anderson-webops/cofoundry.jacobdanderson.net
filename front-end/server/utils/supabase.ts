import type { H3Event } from "h3"
import { Buffer } from "node:buffer"
import process from "node:process"
import { createClient } from "@supabase/supabase-js"
import { deleteCookie, getCookie, setCookie } from "h3"
import { isLocalDevelopmentEnvironment } from "../../shared/utils/environment"

const oauthCookiePrefix = "cf_oauth_"

function getCookieNameForStorageKey(key: string) {
  return `${oauthCookiePrefix}${Buffer.from(key).toString("base64url")}`
}

function getCookieOptions() {
  return {
    httpOnly: true,
    maxAge: 10 * 60,
    path: "/",
    sameSite: "lax" as const,
    secure: !isLocalDevelopmentEnvironment(process.env),
  }
}

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
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  )
}

export function createSupabaseOAuthClient(event: H3Event) {
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
        autoRefreshToken: false,
        detectSessionInUrl: false,
        flowType: "pkce",
        persistSession: true,
        storage: {
          isServer: true,
          getItem(key: string) {
            return getCookie(event, getCookieNameForStorageKey(key)) || null
          },
          removeItem(key: string) {
            deleteCookie(event, getCookieNameForStorageKey(key), { path: "/" })
          },
          setItem(key: string, value: string) {
            setCookie(event, getCookieNameForStorageKey(key), value, getCookieOptions())
          },
        },
      },
    },
  )
}

export function createSupabaseAdminClient(event?: H3Event) {
  if (!isSupabaseEnabled(event))
    return null

  const runtimeConfig = useRuntimeConfig(event)
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || runtimeConfig.supabaseServiceRoleKey

  if (!runtimeConfig.public.supabaseUrl || !serviceRoleKey) {
    throw createError({
      statusCode: 500,
      statusMessage: "Supabase mode is enabled but the server-only service role key or Supabase URL is missing from runtime config.",
    })
  }

  return createClient(
    runtimeConfig.public.supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  )
}
