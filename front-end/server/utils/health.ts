import type { H3Event } from "h3"
import type { DeploymentMetadata, PublicEnvironment } from "../../shared/utils/environment"
import { setHeader } from "h3"

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
