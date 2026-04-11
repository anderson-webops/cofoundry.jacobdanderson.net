import type { IncomingMessage, ServerResponse } from "node:http"
import { createServer } from "node:http"
import { resolve } from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"
import { config } from "dotenv"

config({
  path: resolve(process.cwd(), "../.env"),
})

export function resolveBackendPort() {
  return Number(process.env.BACKEND_PORT || 3008)
}

export function buildMetadataPayload() {
  return {
    app: "CoFoundry",
    backendMode: process.env.NUXT_PUBLIC_BACKEND_MODE || "mock",
    billingMode: process.env.NUXT_PUBLIC_BILLING_MODE || "mock",
    investmentModuleEnabled: process.env.NUXT_PUBLIC_FEATURE_INVESTMENT_MODULE === "true",
    supportEmail: process.env.NUXT_PUBLIC_SUPPORT_EMAIL || "support@cofoundry.dev",
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
