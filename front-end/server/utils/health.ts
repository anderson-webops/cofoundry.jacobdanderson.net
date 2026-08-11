import type { H3Event } from "h3"
import type { DeploymentMetadata, PublicEnvironment } from "../../shared/utils/environment"
import process from "node:process"
import { setHeader } from "h3"
import { readPublicEnvironment } from "../../shared/utils/environment"
import { createSupabaseAdminClient } from "./supabase"

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
  const publicEnvironment = readPublicEnvironment(process.env)

  return determineReadiness(publicEnvironment.backendMode, async () => {
    const client = createSupabaseAdminClient(event)
    if (!client)
      return false

    const { error } = await client
      .from("users")
      .select("id", { count: "exact", head: true })
      .limit(1)

    return !error
  })
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
