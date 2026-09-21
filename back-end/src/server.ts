import type { IncomingMessage, Server, ServerResponse } from "node:http"
import { Buffer } from "node:buffer"
import { timingSafeEqual } from "node:crypto"
import { createServer } from "node:http"
import { resolve } from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"
import { assertEnvironmentIsValid, isLocalDevelopmentEnvironment, isLoopbackBackendHost, readBackendDeploymentMetadata, readPublicEnvironment, readSecretEnvironment } from "./environment.js"

interface BackendServerState {
  ready: boolean
  shutdownPromise?: Promise<void>
}

const backendServerStates = new WeakMap<Server, BackendServerState>()

export function resolveBackendPort() {
  const configuredPort = Number(process.env.BACKEND_PORT)
  return Number.isInteger(configuredPort) && configuredPort > 0 && configuredPort <= 65_535 ? configuredPort : 3008
}

export function resolveBackendHost(env: Record<string, string | undefined> = process.env) {
  const host = env.BACKEND_HOST?.trim() || "127.0.0.1"
  const nonLoopbackBind = !isLoopbackBackendHost(host)

  if (nonLoopbackBind && env.COFOUNDRY_ALLOW_PUBLIC_BACKEND_BIND?.trim().toLowerCase() !== "true") {
    throw new Error(
      "Refusing a public backend bind. Set BACKEND_HOST=127.0.0.1 or explicitly set COFOUNDRY_ALLOW_PUBLIC_BACKEND_BIND=true.",
    )
  }

  const operationsToken = readSecretEnvironment(env).operationsWorkerToken
  if (nonLoopbackBind && operationsToken.length < 32) {
    throw new Error(
      "Refusing a public backend bind without a distinct COFOUNDRY_OPERATIONS_TOKEN of at least 32 characters.",
    )
  }

  return host
}

export function buildMetadataPayload() {
  const publicEnvironment = readPublicEnvironment(process.env)
  const deploymentMetadata = readBackendDeploymentMetadata(process.env)

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

function tokensMatch(providedValue: string, expectedValue: string) {
  const provided = Buffer.from(providedValue)
  const expected = Buffer.from(expectedValue)

  return provided.length > 0
    && provided.length === expected.length
    && timingSafeEqual(provided, expected)
}

function readMetadataToken(request: IncomingMessage) {
  const authorization = request.headers.authorization?.trim() || ""
  const bearerPrefix = "Bearer "
  if (authorization.startsWith(bearerPrefix))
    return authorization.slice(bearerPrefix.length).trim()

  const alternateHeader = request.headers["x-cofoundry-operations-token"]
  return (Array.isArray(alternateHeader) ? alternateHeader[0] : alternateHeader)?.trim() || ""
}

function isMetadataAuthorized(request: IncomingMessage) {
  const configuredToken = readSecretEnvironment(process.env).operationsWorkerToken
  const backendHost = process.env.BACKEND_HOST?.trim() || "127.0.0.1"
  const authorizationRequired = Boolean(configuredToken)
    || !isLocalDevelopmentEnvironment(process.env)
    || !isLoopbackBackendHost(backendHost)

  if (!authorizationRequired)
    return true

  return configuredToken.length >= 32 && tokensMatch(readMetadataToken(request), configuredToken)
}

export function handleRequest(request: IncomingMessage, response: ServerResponse, ready = true) {
  const headers = {
    "cache-control": "no-store",
    "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
    "content-type": "application/json; charset=utf-8",
    "cross-origin-resource-policy": "same-origin",
    "permissions-policy": "camera=(), geolocation=(), microphone=()",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
  }
  const method = request.method || "GET"
  const pathname = new URL(request.url || "/", "http://127.0.0.1").pathname
  const knownPath = ["/health", "/healthz", "/readyz", "/metadata"].includes(pathname)

  if (knownPath && method !== "GET" && method !== "HEAD") {
    response.writeHead(405, {
      ...headers,
      allow: "GET, HEAD",
    })
    response.end(JSON.stringify({ error: "Method not allowed" }))
    return
  }

  if (pathname === "/health") {
    response.writeHead(200, headers)
    const body = JSON.stringify({
      status: "ok",
      service: "cofoundry-back-end",
      deployment: readBackendDeploymentMetadata(process.env),
      now: new Date().toISOString(),
    })
    response.end(method === "HEAD" ? undefined : body)
    return
  }

  if (pathname === "/healthz") {
    response.writeHead(200, headers)
    response.end(method === "HEAD" ? undefined : JSON.stringify({ ok: true }))
    return
  }

  if (pathname === "/readyz") {
    response.writeHead(ready ? 200 : 503, headers)
    response.end(method === "HEAD" ? undefined : JSON.stringify({ ok: ready }))
    return
  }

  if (pathname === "/metadata") {
    if (!isMetadataAuthorized(request)) {
      response.writeHead(401, {
        ...headers,
        "www-authenticate": "Bearer",
      })
      response.end(method === "HEAD" ? undefined : JSON.stringify({ error: "Unauthorized" }))
      return
    }

    response.writeHead(200, headers)
    response.end(method === "HEAD" ? undefined : JSON.stringify(buildMetadataPayload()))
    return
  }

  response.writeHead(404, headers)
  response.end(JSON.stringify({
    error: "Not found",
  }))
}

export function createBackendServer() {
  assertEnvironmentIsValid(process.env, "back-end server startup")
  const state: BackendServerState = { ready: true }
  const server = createServer({
    headersTimeout: 5_000,
    keepAliveTimeout: 5_000,
    requestTimeout: 10_000,
  }, (request, response) => handleRequest(request, response, state.ready))
  server.maxConnections = 256
  server.maxHeadersCount = 100
  server.maxRequestsPerSocket = 1_000
  backendServerStates.set(server, state)
  return server
}

export function beginBackendDrain(server: Server) {
  const state = backendServerStates.get(server)
  if (!state)
    throw new Error("Cannot drain a server that was not created by createBackendServer().")

  const wasReady = state.ready
  state.ready = false
  return wasReady
}

export function closeBackendServer(server: Server, gracePeriodMs = 10_000) {
  const state = backendServerStates.get(server)
  if (!state)
    return Promise.reject(new Error("Cannot close a server that was not created by createBackendServer()."))
  if (state.shutdownPromise)
    return state.shutdownPromise
  if (!Number.isInteger(gracePeriodMs) || gracePeriodMs < 0)
    return Promise.reject(new Error("The backend shutdown grace period must be a non-negative integer."))

  state.ready = false
  state.shutdownPromise = new Promise<void>((resolvePromise, rejectPromise) => {
    const forceCloseTimer = setTimeout(() => {
      server.closeAllConnections()
    }, gracePeriodMs)
    forceCloseTimer.unref()

    server.close((error) => {
      clearTimeout(forceCloseTimer)
      if (error && (error as NodeJS.ErrnoException).code !== "ERR_SERVER_NOT_RUNNING")
        rejectPromise(error)
      else
        resolvePromise()
    })
    server.closeIdleConnections()
  })

  return state.shutdownPromise
}

export async function startBackendServer(port = resolveBackendPort(), host = resolveBackendHost()) {
  const server = createBackendServer()

  await new Promise<void>((resolvePromise, rejectPromise) => {
    server.once("error", rejectPromise)
    server.listen(port, host, () => {
      console.log(`CoFoundry backend workspace listening on http://${host}:${port}`)
      resolvePromise()
    })
  })

  return server
}

const isMainModule = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false

if (isMainModule) {
  startBackendServer()
    .then((server) => {
      let shuttingDown = false
      const shutdown = () => {
        if (shuttingDown) {
          server.closeAllConnections()
          return
        }

        shuttingDown = true
        void closeBackendServer(server).catch((error) => {
          console.error(error)
          process.exitCode = 1
        })
      }

      process.once("SIGINT", shutdown)
      process.once("SIGTERM", shutdown)
    })
    .catch((error) => {
      console.error(error)
      process.exitCode = 1
    })
}
