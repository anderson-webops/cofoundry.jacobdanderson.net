import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

const scriptDir = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(scriptDir, "..")
const serverEntry = resolve(projectRoot, "front-end/.output/server/index.mjs")
const publicVerifier = resolve(scriptDir, "verify-public-site.mjs")
const port = Number(process.env.VERIFY_PUBLIC_LOCAL_PORT || 3401)
const host = "127.0.0.1"
const baseUrl = `http://${host}:${port}`
const release = process.env.COFOUNDRY_RELEASE || "verify-public-local"
const commitSha = process.env.COFOUNDRY_COMMIT_SHA || "verify-public-local-commit"
const deployedAt = process.env.COFOUNDRY_DEPLOYED_AT || "2026-06-14T00:00:00.000Z"
const sessionSigningSecret = "verify-public-local-session-secret"

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  console.error("VERIFY_PUBLIC_LOCAL_PORT must be an integer TCP port.")
  process.exit(1)
}

if (!existsSync(serverEntry)) {
  console.error(`Built Nitro server not found at ${serverEntry}. Run npm run build before npm run verify:public:local.`)
  process.exit(1)
}

async function waitForHttp(url, timeoutMs = 45_000) {
  const startedAt = Date.now()
  let lastError

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url)
      if (response.ok)
        return

      lastError = new Error(`${url} returned ${response.status}`)
    }
    catch (error) {
      lastError = error
    }

    await new Promise(resolveWait => setTimeout(resolveWait, 400))
  }

  throw lastError || new Error(`Timed out waiting for ${url}`)
}

function startServer() {
  let ready = false
  const child = spawn(process.execPath, [serverEntry], {
    cwd: resolve(projectRoot, "front-end"),
    env: {
      ...process.env,
      COFOUNDRY_COMMIT_SHA: commitSha,
      COFOUNDRY_DEPLOYED_AT: deployedAt,
      COFOUNDRY_RELEASE: release,
      HOST: host,
      NODE_ENV: "production",
      NUXT_PUBLIC_APP_URL: baseUrl,
      NUXT_PUBLIC_BACKEND_MODE: "mock",
      NUXT_PUBLIC_BILLING_MODE: "mock",
      NUXT_PUBLIC_ENABLE_DEMO_ACCESS: "false",
      PORT: String(port),
      SESSION_SIGNING_SECRET: sessionSigningSecret,
    },
    stdio: ["ignore", "pipe", "pipe"],
  })

  child.stdout.on("data", data => process.stderr.write(`[verify-public-local-server] ${data}`))
  child.stderr.on("data", data => process.stderr.write(`[verify-public-local-server] ${data}`))

  const earlyExit = new Promise((_, reject) => {
    child.once("exit", (code, signal) => {
      if (!ready)
        reject(new Error(`Built Nitro server exited before verification started (${signal || code}).`))
    })
  })

  return {
    child,
    markReady() {
      ready = true
    },
    earlyExit,
  }
}

async function stopServer(child) {
  if (child.exitCode !== null)
    return

  child.kill("SIGTERM")
  await new Promise((resolveStop) => {
    const timeout = setTimeout(resolveStop, 5_000)
    child.once("exit", () => {
      clearTimeout(timeout)
      resolveStop()
    })
  })
}

async function runPublicVerifier() {
  const child = spawn(process.execPath, [publicVerifier], {
    cwd: projectRoot,
    env: {
      ...process.env,
      VERIFY_PUBLIC_BASE_URL: baseUrl,
      VERIFY_PUBLIC_CANONICAL_ORIGIN: baseUrl,
      VERIFY_PUBLIC_EXPECT_BACKEND_MODE: "mock",
      VERIFY_PUBLIC_EXPECT_BILLING_MODE: "mock",
      VERIFY_PUBLIC_EXPECT_COMMIT_SHA: commitSha,
      VERIFY_PUBLIC_EXPECT_RELEASE: release,
    },
    stdio: "inherit",
  })

  const exitCode = await new Promise((resolveExit) => {
    child.once("exit", code => resolveExit(code ?? 1))
  })

  if (exitCode !== 0)
    throw new Error(`Public verifier failed with exit code ${exitCode}.`)
}

const server = startServer()

try {
  await Promise.race([
    waitForHttp(`${baseUrl}/api/health`),
    server.earlyExit,
  ])
  server.markReady()
  await runPublicVerifier()
}
finally {
  await stopServer(server.child)
}
