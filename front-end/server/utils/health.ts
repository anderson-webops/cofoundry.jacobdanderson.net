import type { H3Event } from "h3"
import type { DeploymentMetadata, PublicEnvironment } from "../../shared/utils/environment"
import { setHeader } from "h3"
import { useRuntimeConfig } from "nitropack/runtime"
import { createSupabaseAdminClient } from "./supabase"

const readinessCacheMs = 1000
const readinessTimeoutMs = 2000

interface SupabaseReadinessState {
  endpoint: string
  checkedAt: number | null
  ready: boolean
  pending: Promise<boolean> | null
}

let supabaseReadinessState: SupabaseReadinessState | null = null

export interface HealthPayloadOptions {
  deploymentMetadata: DeploymentMetadata
  generatedAt: string
  publicEnvironment: PublicEnvironment
}

export function buildHealthPayload(options: HealthPayloadOptions) {
  const publicEnvironment = options.publicEnvironment

  return {
    deployment: publicDeploymentMetadata(options.deploymentMetadata),
    generatedAt: options.generatedAt,
    modes: {
      backend: publicEnvironment.backendMode,
      billing: publicEnvironment.billingMode,
    },
    publicAppUrlConfigured: Boolean(publicEnvironment.appUrl),
    service: "cofoundry-front-end",
    status: "ok",
  }
}

export function buildProbePayload(ok: boolean) {
  return { ok }
}

export async function determineReadiness(
  backendMode: PublicEnvironment["backendMode"],
  checkSupabase: () => boolean | Promise<boolean>,
) {
  if (backendMode !== "supabase")
    return true

  try {
    return await checkSupabase()
  }
  catch {
    return false
  }
}

export async function resolveFrontendReadiness(event: H3Event) {
  let backendMode: string
  let endpoint: string
  try {
    const runtimeConfig = useRuntimeConfig(event)
    backendMode = runtimeConfig.public.backendMode
    endpoint = runtimeConfig.public.supabaseUrl
  }
  catch {
    return false
  }

  if (backendMode === "mock")
    return true
  if (backendMode !== "supabase")
    return false

  if (supabaseReadinessState?.endpoint !== endpoint) {
    supabaseReadinessState = {
      endpoint,
      checkedAt: null,
      ready: false,
      pending: null,
    }
  }

  const state = supabaseReadinessState
  if (state.pending)
    return state.pending

  const now = Date.now()
  if (state.checkedAt !== null && now >= state.checkedAt && now - state.checkedAt < readinessCacheMs)
    return state.ready

  const pending = probeSupabaseReadiness(event).then((ready) => {
    state.ready = ready
    state.checkedAt = Date.now()
    return ready
  }).finally(() => {
    state.pending = null
  })
  state.pending = pending
  return pending
}

async function probeSupabaseReadiness(event: H3Event) {
  const abortController = new AbortController()
  let timeout: ReturnType<typeof setTimeout> | undefined
  const timedOut = new Promise<false>((resolve) => {
    timeout = setTimeout(() => {
      abortController.abort()
      resolve(false)
    }, readinessTimeoutMs)
  })

  try {
    return await Promise.race([
      determineReadiness("supabase", async () => {
        const client = createSupabaseAdminClient(event)
        if (!client)
          return false

        const { error } = await client
          .from("users")
          .select("id", { head: true })
          .limit(1)
          .retry(false)
          .abortSignal(abortController.signal)

        return !error
      }),
      timedOut,
    ])
  }
  finally {
    clearTimeout(timeout)
  }
}

function publicDeploymentMetadata(metadata: DeploymentMetadata) {
  return {
    commitSha: metadata.commitSha,
    deployedAt: metadata.deployedAt,
    release: metadata.release,
  }
}

export function setHealthResponseHeaders(event: H3Event) {
  setHeader(event, "Cache-Control", "no-store")
  setHeader(event, "Content-Type", "application/json; charset=utf-8")
}
