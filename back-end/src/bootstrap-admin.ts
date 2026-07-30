import type { SupabaseClient } from "@supabase/supabase-js"
import { randomUUID } from "node:crypto"
import { assertEnvironmentIsValid, readPublicEnvironment, readSecretEnvironment } from "./environment.js"

const bootstrapAdminRoles = ["admin"] as const

type BootstrapAdminRole = (typeof bootstrapAdminRoles)[number]

interface BootstrapAdminEnvironment {
  supabaseServiceRoleKey: string
  supabaseUrl: string
}

interface BootstrapAdminInput {
  email: string
  notes: string
  role: BootstrapAdminRole
  userId: string
}

interface PersistedUserRow {
  email: string
  id: string
  role: string
  verified_email: boolean
}

interface BootstrapAdminResult {
  actionId: string
  createdAt: string
  email: string
  role: BootstrapAdminRole
  userId: string
}

type EnvironmentSource = Record<string, string | undefined>

function readValue(env: EnvironmentSource, key: string) {
  return env[key]?.trim() || ""
}

function normalizeBootstrapEmail(value: string) {
  return value.trim().toLowerCase()
}

function normalizeBootstrapRole(value: string): BootstrapAdminRole {
  const configuredRole = value || "admin"

  if (!bootstrapAdminRoles.includes(configuredRole as BootstrapAdminRole)) {
    throw new Error(`BOOTSTRAP_ADMIN_ROLE must be one of: ${bootstrapAdminRoles.join(", ")}.`)
  }

  return configuredRole as BootstrapAdminRole
}

export function resolveBootstrapAdminInput(env: EnvironmentSource): BootstrapAdminInput {
  const email = normalizeBootstrapEmail(readValue(env, "BOOTSTRAP_ADMIN_EMAIL"))
  const userId = readValue(env, "BOOTSTRAP_ADMIN_USER_ID")
  const notes = readValue(env, "BOOTSTRAP_ADMIN_NOTES") || "Initial production admin bootstrap."

  if (!email && !userId)
    throw new Error("Set BOOTSTRAP_ADMIN_EMAIL or BOOTSTRAP_ADMIN_USER_ID before running the admin bootstrap script.")
  if (notes.length < 8 || notes.length > 1000)
    throw new Error("BOOTSTRAP_ADMIN_NOTES must contain 8 to 1000 characters.")

  return {
    email,
    notes,
    role: normalizeBootstrapRole(readValue(env, "BOOTSTRAP_ADMIN_ROLE")),
    userId,
  }
}

export function resolveBootstrapAdminEnvironment(env: EnvironmentSource): BootstrapAdminEnvironment {
  assertEnvironmentIsValid(env, "admin bootstrap")

  const publicEnvironment = readPublicEnvironment(env)
  const secretEnvironment = readSecretEnvironment(env)

  if (publicEnvironment.backendMode !== "supabase") {
    throw new Error("NUXT_PUBLIC_BACKEND_MODE must be \"supabase\" before running the admin bootstrap script.")
  }

  return {
    supabaseServiceRoleKey: secretEnvironment.supabaseServiceRoleKey,
    supabaseUrl: publicEnvironment.supabaseUrl,
  }
}

async function findBootstrapTarget(client: SupabaseClient, input: BootstrapAdminInput) {
  const lookupColumn = input.userId ? "id" : "email"
  const lookupValue = input.userId || input.email
  const { data, error } = await client
    .from("users")
    .select("id,email,role,verified_email")
    .eq(lookupColumn, lookupValue)
    .limit(1)
    .maybeSingle()

  if (error)
    throw error

  if (!data) {
    throw new Error(
      input.userId
        ? `No CoFoundry user exists with id ${input.userId}. Create the user through the normal auth path first.`
        : `No CoFoundry user exists with email ${input.email}. Create the user through the normal auth path first.`,
    )
  }

  const target = data as PersistedUserRow
  if (!target.verified_email)
    throw new Error("The first full admin account must have a verified email address.")

  return target
}

export async function bootstrapAdmin(client: SupabaseClient, input: BootstrapAdminInput): Promise<BootstrapAdminResult> {
  const target = await findBootstrapTarget(client, input)
  const createdAt = new Date().toISOString()
  const actionId = randomUUID()
  const { error } = await client.rpc("cofoundry_bootstrap_first_admin", {
    p_action_id: actionId,
    p_created_at: createdAt,
    p_notes: input.notes,
    p_target_user_id: target.id,
  })

  if (error)
    throw error

  return {
    actionId,
    createdAt,
    email: target.email,
    role: "admin",
    userId: target.id,
  }
}
