import type { H3Event } from "h3"
import type { DeploymentMetadata } from "../../shared/utils/environment"
import process from "node:process"
import { readDeploymentMetadata } from "../../shared/utils/environment"

interface RuntimeDeploymentConfig {
  deploymentCommitSha?: unknown
  deploymentDeployedAt?: unknown
  deploymentRelease?: unknown
}

function readRuntimeString(value: unknown) {
  return typeof value === "string" ? value : ""
}

export function readServerDeploymentMetadata(event: H3Event): DeploymentMetadata {
  const runtimeConfig = useRuntimeConfig(event) as unknown as RuntimeDeploymentConfig

  return readDeploymentMetadata(process.env, {
    commitSha: readRuntimeString(runtimeConfig.deploymentCommitSha),
    deployedAt: readRuntimeString(runtimeConfig.deploymentDeployedAt),
    release: readRuntimeString(runtimeConfig.deploymentRelease),
  })
}
