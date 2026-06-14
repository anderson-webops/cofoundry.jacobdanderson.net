import type { IncomingMessage, ServerResponse } from "node:http"
import { createServer } from "node:http"
import { resolve } from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"
import { assertEnvironmentIsValid, readDeploymentMetadata, readPublicEnvironment } from "./environment.js"

export function resolveBackendPort() {
  const configuredPort = Number(process.env.BACKEND_PORT)
  return Number.isFinite(configuredPort) && configuredPort > 0 ? configuredPort : 3008
}

export function buildMetadataPayload() {
  const publicEnvironment = readPublicEnvironment(process.env)
  const deploymentMetadata = readDeploymentMetadata(process.env)

  return {
    app: "CoFoundry",
    backendMode: publicEnvironment.backendMode,
    billingMode: publicEnvironment.billingMode,
    demoAccessEnabled: publicEnvironment.enableDemoAccess,
    deployment: deploymentMetadata,
    investmentModuleEnabled: publicEnvironment.featureInvestmentModule,
    supportEmail: publicEnvironment.supportEmail,
  }
}

export function handleRequest(request: IncomingMessage, response: ServerResponse) {
  const headers = {
    "content-type": "application/json; charset=utf-8",
  }

  if (request.url === "/health") {
    response.writeHead(200, headers)
    response.end(JSON.stringify({
      status: "ok",
      service: "cofoundry-back-end",
      deployment: readDeploymentMetadata(process.env),
      now: new Date().toISOString(),
    }))
    return
  }

  if (request.url === "/metadata") {
    response.writeHead(200, headers)
    response.end(JSON.stringify(buildMetadataPayload()))
    return
  }

  response.writeHead(404, headers)
  response.end(JSON.stringify({
    error: "Not found",
  }))
}

export function createBackendServer() {
  assertEnvironmentIsValid(process.env, "back-end server startup")
  return createServer(handleRequest)
}

export async function startBackendServer(port = resolveBackendPort()) {
  const server = createBackendServer()

  await new Promise<void>((resolvePromise, rejectPromise) => {
    server.once("error", rejectPromise)
    server.listen(port, () => {
      console.log(`CoFoundry backend workspace listening on http://localhost:${port}`)
      resolvePromise()
    })
  })

  return server
}

const isMainModule = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false

if (isMainModule) {
  startBackendServer().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
