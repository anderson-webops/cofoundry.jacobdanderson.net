import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { readFileSync } from "node:fs"
import net from "node:net"
import { resolve } from "node:path"
import process from "node:process"
import { pathToFileURL } from "node:url"

const artifact = resolve(process.argv[2] || process.cwd())
const caseName = process.argv[3] || "complete"
const node = process.execPath
const identity = JSON.parse(readFileSync(resolve(artifact, ".cofoundry-release-prepared.json"), "utf8"))
const operationsToken = "artifact-operations-token-at-least-32-characters"
const sessionSecret = "artifact-session-secret-at-least-32-characters"
const children = new Set()

function syntheticEnvironment(overrides = {}) {
  return {
    ...process.env,
    BACKEND_HOST: "127.0.0.1",
    COFOUNDRY_COMMIT_SHA: identity.commitSha,
    COFOUNDRY_DEPLOYED_AT: identity.deployedAt,
    COFOUNDRY_GITHUB_OAUTH_PROVIDER: "",
    COFOUNDRY_GOOGLE_OAUTH_PROVIDER: "",
    COFOUNDRY_LOCAL_DATA_DIR: "/tmp/cofoundry-artifact-data",
    COFOUNDRY_OAUTH_PROVIDER: "",
    COFOUNDRY_OPERATIONS_TOKEN: operationsToken,
    COFOUNDRY_RELEASE: identity.release,
    NODE_ENV: "production",
    NODE_OPTIONS: "--max-old-space-size=192",
    NUXT_PUBLIC_APP_URL: "https://cofoundry.example.com",
    NUXT_PUBLIC_BACKEND_MODE: "mock",
    NUXT_PUBLIC_BILLING_MODE: "mock",
    NUXT_PUBLIC_ENABLE_DEMO_ACCESS: "false",
    NUXT_PUBLIC_FEATURE_INVESTMENT_MODULE: "false",
    SESSION_SIGNING_SECRET: sessionSecret,
    ...overrides,
  }
}

function spawnRuntime(entrypoint, env) {
  const child = spawn(node, [resolve(artifact, entrypoint)], {
    cwd: artifact,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  })
  child.stdout.setEncoding("utf8")
  child.stderr.setEncoding("utf8")
  child.output = ""
  child.stdout.on("data", chunk => child.output += chunk)
  child.stderr.on("data", chunk => child.output += chunk)
  children.add(child)
  child.once("exit", () => children.delete(child))
  return child
}

async function freePort() {
  const server = net.createServer()
  await new Promise((resolvePromise, rejectPromise) => {
    server.once("error", rejectPromise)
    server.listen(0, "127.0.0.1", resolvePromise)
  })
  const port = server.address().port
  await new Promise((resolvePromise, rejectPromise) => server.close(error => error ? rejectPromise(error) : resolvePromise()))
  return port
}

async function waitForResponse(url, expectedStatus = 200, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs
  let lastError
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(1_000) })
      if (response.status === expectedStatus)
        return response
      lastError = new Error(`${url} returned ${response.status}`)
    }
    catch (error) {
      lastError = error
    }
    await new Promise(resolvePromise => setTimeout(resolvePromise, 100))
  }
  throw lastError || new Error(`Timed out waiting for ${url}`)
}

async function waitForExit(child, timeoutMs = 15_000) {
  if (child.exitCode !== null)
    return { code: child.exitCode, signal: child.signalCode }
  return new Promise((resolvePromise, rejectPromise) => {
    let timeout
    function cleanup() {
      clearTimeout(timeout)
      child.removeListener("error", onError)
      child.removeListener("exit", onExit)
    }
    function onError(error) {
      cleanup()
      rejectPromise(error)
    }
    function onExit(code, signal) {
      cleanup()
      resolvePromise({ code, signal })
    }
    timeout = setTimeout(() => {
      cleanup()
      rejectPromise(new Error(`Runtime did not exit: ${String(child.output || "").slice(-1000)}`))
    }, timeoutMs)
    child.once("error", onError)
    child.once("exit", onExit)
  })
}

async function stopRuntime(child) {
  if (child.exitCode !== null)
    return
  child.kill("SIGTERM")
  const result = await waitForExit(child)
  assert.equal(result.code, 0, `Runtime did not shut down cleanly: ${child.output.slice(-1000)}`)
}

async function assertMinimalProbe(baseUrl, path, expectedStatus = 200, expectedBody = { ok: true }) {
  const response = await waitForResponse(`${baseUrl}${path}`, expectedStatus)
  assert.deepEqual(await response.json(), expectedBody)
  assert.equal(response.headers.get("cache-control"), "no-store")
  assert.equal(response.headers.get("set-cookie"), null)
  assert.equal(response.headers.get("location"), null)
  assert.equal(response.headers.get("www-authenticate"), null)
  const head = await fetch(`${baseUrl}${path}`, { method: "HEAD", redirect: "manual" })
  assert.equal(head.status, expectedStatus)
  assert.equal(await head.text(), "")
  assert.equal(head.headers.get("cache-control"), "no-store")
}

async function testBackendModule() {
  Object.assign(process.env, syntheticEnvironment())
  const module = await import(pathToFileURL(resolve(artifact, "back-end/dist/server.js")))
  const server = module.createBackendServer()
  await new Promise((resolvePromise, rejectPromise) => {
    server.once("error", rejectPromise)
    server.listen(0, "127.0.0.1", resolvePromise)
  })
  const baseUrl = `http://127.0.0.1:${server.address().port}`
  await assertMinimalProbe(baseUrl, "/healthz")
  await assertMinimalProbe(baseUrl, "/readyz")
  assert.equal(module.beginBackendDrain(server), true)
  await assertMinimalProbe(baseUrl, "/readyz", 503, { ok: false })
  const firstClose = module.closeBackendServer(server)
  assert.equal(firstClose, module.closeBackendServer(server))
  await firstClose
}

async function testBackendEntrypoint() {
  const port = await freePort()
  const child = spawnRuntime("back-end/dist/server.js", syntheticEnvironment({ BACKEND_PORT: String(port) }))
  await assertMinimalProbe(`http://127.0.0.1:${port}`, "/healthz")
  await stopRuntime(child)
}

async function testFrontendAndWorker() {
  const port = await freePort()
  const baseUrl = `http://127.0.0.1:${port}`
  const child = spawnRuntime("front-end/.output/server/index.mjs", syntheticEnvironment({
    NITRO_HOST: "127.0.0.1",
    NITRO_PORT: String(port),
    NITRO_SHUTDOWN_TIMEOUT: "3000",
  }))
  await assertMinimalProbe(baseUrl, "/healthz")
  await assertMinimalProbe(baseUrl, "/readyz")
  const health = await waitForResponse(`${baseUrl}/api/health`)
  const healthBody = await health.json()
  assert.equal(healthBody.deployment.commitSha, identity.commitSha)
  assert.equal(healthBody.deployment.release, identity.release)
  assert.equal(health.headers.get("cache-control"), "no-store")
  const root = await waitForResponse(`${baseUrl}/`)
  assert.match(root.headers.get("content-type") || "", /text\/html/)
  assert.ok((await root.text()).length > 100)

  const heartbeat = spawn(node, [resolve(artifact, "back-end/dist/operations-worker.js"), "heartbeat", "--metadata", "fixture=artifact"], {
    cwd: artifact,
    env: syntheticEnvironment({ COFOUNDRY_APP_URL: baseUrl, NUXT_PUBLIC_APP_URL: "" }),
    stdio: ["ignore", "pipe", "pipe"],
  })
  let heartbeatOutput = ""
  heartbeat.stdout.on("data", chunk => heartbeatOutput += chunk)
  heartbeat.stderr.on("data", chunk => heartbeatOutput += chunk)
  const result = await waitForExit(heartbeat)
  assert.equal(result.code, 0, `Compiled operations worker failed: ${heartbeatOutput.slice(-1000)}`)
  assert.match(heartbeatOutput, /monitoring\.heartbeat/)
  await stopRuntime(child)
}

async function testMissingModuleFailure() {
  const port = await freePort()
  const child = spawnRuntime("back-end/dist/server.js", syntheticEnvironment({ BACKEND_PORT: String(port) }))
  const result = await waitForExit(child, 5_000)
  assert.notEqual(result.code, 0)
  assert.match(child.output, /ERR_MODULE_NOT_FOUND|Cannot find module/)
}

try {
  if (caseName === "missing-module") {
    await testMissingModuleFailure()
  }
  else if (caseName === "complete") {
    await testBackendModule()
    await testBackendEntrypoint()
    await testFrontendAndWorker()
  }
  else {
    throw new Error(`Unknown acceptance case: ${caseName}`)
  }
  console.log(`CoFoundry artifact acceptance passed: ${caseName}`)
}
finally {
  for (const child of children)
    child.kill("SIGKILL")
}
