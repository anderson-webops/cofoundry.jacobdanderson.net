import { spawn } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import http from "node:http"
import { createRequire } from "node:module"
import net from "node:net"
import { dirname, resolve } from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"
import puppeteer from "puppeteer"

const require = createRequire(import.meta.url)
const axeSourcePath = require.resolve("axe-core/axe.min.js")
const scriptDir = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(scriptDir, "..")
const builtServerEntry = resolve(projectRoot, "front-end/.output/server/index.mjs")
const frontendPackagePath = resolve(projectRoot, "front-end/package.json")
const frontendPackage = JSON.parse(readFileSync(frontendPackagePath, "utf8"))

const siteName = "CoFoundry"
const frontendKind = "nuxt"
const useBuiltServer = booleanEnv(process.env.A11Y_USE_BUILT_SERVER)
const frontendPort = Number(process.env.A11Y_FRONTEND_PORT || (useBuiltServer ? 3345 : 3344))
const apiPort = Number(process.env.A11Y_API_PORT || 3044)
const baseUrl = `http://127.0.0.1:${frontendPort}`
const apiUrl = `http://127.0.0.1:${apiPort}/api`
const routes = [
  "/",
  "/find-cofounder",
  "/how-it-works",
  "/pricing",
  "/faq",
  "/trust",
  "/contracts",
  "/people",
  "/startups",
  "/safety",
  "/privacy",
  "/terms",
  "/contact",
  "/auth/sign-in"
]
const isolatedExternalScriptUrls = new Set([
  "https://analytics.cofoundry.jacobdanderson.net/script.js",
  "https://analytics.jacobdanderson.net/script.js",
])
const colorSchemes = (process.env.A11Y_COLOR_SCHEMES || "light,dark")
  .split(",")
  .map(scheme => scheme.trim())
  .filter(Boolean)

const chromeCandidates = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium"
].filter(Boolean)

const chromePath = chromeCandidates.find(candidate => existsSync(candidate))
if (chromePath) process.env.PUPPETEER_EXECUTABLE_PATH = chromePath
let frontendPortFallbackDetected = false

function booleanEnv(value) {
  return ["1", "true", "yes"].includes(value?.trim().toLowerCase() || "")
}

function writeServerLine(prefix, data) {
  const text = data.toString().trim()
  if (!text)
    return

  if (text.includes("Unable to find an available port"))
    frontendPortFallbackDetected = true

  process.stderr.write(`[${prefix}] ${text}\n`)
}

function sendJson(res, body, status = 200) {
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": baseUrl,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "authorization,content-type",
    "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS"
  })
  res.end(JSON.stringify(body))
}

function emptyCollection() {
  return {
    items: [],
    results: [],
    data: [],
    records: [],
    total: 0
  }
}

function responseFor(url) {
  const pathname = url.pathname.replace(/\/+/g, "/")
  if (pathname.endsWith("/pageview")) return { pageview: 0, startAt: Date.now() }
  if (pathname.includes("/session")) return { authenticated: false, user: null, admin: null }
  if (pathname.includes("/auth") || pathname.includes("/login")) return { authenticated: false, user: null, token: "" }
  if (pathname.includes("/me") || pathname.includes("/account")) return { user: null, authenticated: false }
  if (pathname.includes("/quotes")) return []
  if (pathname.includes("/availability")) {
    const start = new Date(Date.now() + 24 * 60 * 60_000)
    start.setMinutes(0, 0, 0)
    const end = new Date(start.getTime() + 60 * 60_000)
    return [{ id: "a11y-slot", title: "Available", start: start.toISOString(), end: end.toISOString() }]
  }
  if (pathname.includes("/topics")) return { topics: [], claims: [], ...emptyCollection() }
  if (pathname.includes("/claims")) return { claims: [], ...emptyCollection() }
  if (pathname.includes("/search")) return { query: url.searchParams.get("q") || "", ...emptyCollection() }
  if (pathname.includes("/submissions") || pathname.includes("/board") || pathname.includes("/items")) return emptyCollection()
  if (pathname.includes("/service-directory")) return { services: [], categories: [], ...emptyCollection() }
  if (pathname.includes("/elections")) return { elections: [], ...emptyCollection() }
  if (pathname.includes("/jurisdictions") || pathname.includes("/locations") || pathname.includes("/districts")) return { jurisdictions: [], locations: [], districts: [], ...emptyCollection() }
  if (pathname.includes("/representatives") || pathname.includes("/candidate")) return { representatives: [], candidates: [], ...emptyCollection() }
  if (pathname.includes("/sources")) return { sources: [], ...emptyCollection() }
  if (pathname.includes("/products")) return []
  if (pathname.includes("/contact") || pathname.includes("/cart") || pathname.includes("/orders")) return { ok: true }
  return { ok: true, ...emptyCollection() }
}

function createMockApiServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url || "/", `http://127.0.0.1:${apiPort}`)
    if (req.method === "OPTIONS") {
      sendJson(res, {}, 204)
      return
    }
    sendJson(res, responseFor(url))
  })
}

async function listen(server, port) {
  await new Promise((resolveListen, reject) => {
    server.once("error", reject)
    server.listen(port, "127.0.0.1", resolveListen)
  })
}

async function assertPortAvailable(port, label) {
  await new Promise((resolveListen, reject) => {
    const server = net.createServer()
    server.once("error", (error) => {
      reject(new Error(`${label} port ${port} is already in use; set ${label === "frontend" ? "A11Y_FRONTEND_PORT" : "A11Y_API_PORT"} to a free port.`, { cause: error }))
    })
    server.listen(port, "127.0.0.1", () => {
      server.close(resolveListen)
    })
  })
}

async function waitForHttp(url, timeoutMs = 45_000) {
  const start = Date.now()
  let lastError
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url)
      if (response.ok) return
      lastError = new Error(`${url} returned ${response.status}`)
    }
    catch (error) {
      lastError = error
    }
    await new Promise(resolveWait => setTimeout(resolveWait, 400))
  }
  throw lastError || new Error(`Timed out waiting for ${url}`)
}

function startFrontend() {
  if (useBuiltServer) {
    if (!existsSync(builtServerEntry)) {
      console.error(`Built Nitro server not found at ${builtServerEntry}. Run npm run build before A11Y_USE_BUILT_SERVER=true npm run a11y.`)
      process.exit(1)
    }

    const child = spawn(process.execPath, [builtServerEntry], {
      cwd: resolve(projectRoot, "front-end"),
      env: {
        ...process.env,
        COFOUNDRY_ALLOW_LOCAL_PUBLIC_APP_URL: "true",
        COFOUNDRY_COMMIT_SHA: process.env.COFOUNDRY_COMMIT_SHA || "a11y-production-commit",
        COFOUNDRY_DEPLOYED_AT: process.env.COFOUNDRY_DEPLOYED_AT || "2026-06-14T00:00:00.000Z",
        COFOUNDRY_OPERATIONS_TOKEN: "a11y-production-operations-token-000001",
        COFOUNDRY_RELEASE: process.env.COFOUNDRY_RELEASE || "a11y-production",
        DISABLE_ANALYTICS: "true",
        HOST: "127.0.0.1",
        NODE_ENV: "production",
        NUXT_PUBLIC_APP_URL: baseUrl,
        NUXT_PUBLIC_BACKEND_MODE: "mock",
        NUXT_PUBLIC_BILLING_MODE: "mock",
        NUXT_PUBLIC_ENABLE_DEMO_ACCESS: "false",
        NUXT_PUBLIC_FEATURE_INVESTMENT_MODULE: "false",
        NUXT_DEVTOOLS_ENABLED: "false",
        PORT: String(frontendPort),
        SESSION_SIGNING_SECRET: "a11y-production-session-secret-000001",
      },
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"]
    })
    child.stdout.on("data", data => writeServerLine("nitro", data))
    child.stderr.on("data", data => writeServerLine("nitro", data))
    return child
  }

  const isNuxt = frontendKind === "nuxt" || Object.values(frontendPackage.scripts || {}).some(script => String(script).includes("nuxt"))
  const args = isNuxt
    ? ["exec", "-w", "front-end", "--", "nuxt", "dev", "--host", "127.0.0.1", "--port", String(frontendPort)]
    : ["exec", "-w", "front-end", "--", "vite", "--host", "127.0.0.1", "--port", String(frontendPort), "--strictPort"]
  const npmExecPath = process.env.npm_execpath

  if (!npmExecPath)
    throw new Error("Run accessibility verification through npm so the selected npm executable is known.")

  const env = {
    ...process.env,
    BROWSER: "none",
    DISABLE_ANALYTICS: "true",
    NUXT_DEVTOOLS_ENABLED: "false",
    NUXT_TELEMETRY_DISABLED: "1",
    NUXT_PUBLIC_APP_URL: baseUrl,
    NUXT_PUBLIC_SITE_URL: baseUrl,
    NUXT_PUBLIC_API_BASE: apiUrl,
    NUXT_PUBLIC_API_BASE_URL: apiUrl,
    PUBLIC_API_BASE: apiUrl,
    INTERNAL_API_BASE: apiUrl,
    API_INTERNAL_BASE: apiUrl,
    ADMIN_API_BASE: apiUrl,
    NUXT_ADMIN_API_BASE: apiUrl,
    ADMIN_API_KEY: "a11y-smoke",
    NUXT_ADMIN_API_KEY: "a11y-smoke",
    ADMIN_SESSION_SECRET: "a11y-smoke-session-secret",
    NUXT_ADMIN_SESSION_SECRET: "a11y-smoke-session-secret",
    NUXT_SESSION_SIGNING_SECRET: "a11y-smoke-session-secret",
    SESSION_SIGNING_SECRET: "a11y-smoke-session-secret",
    NUXT_PUBLIC_BACKEND_MODE: "mock",
    NUXT_PUBLIC_BILLING_MODE: "mock",
    NUXT_PUBLIC_ENABLE_DEMO_ACCESS: "true",
    NUXT_PUBLIC_FEATURE_INVESTMENT_MODULE: "true",
    NUXT_PUBLIC_PORTAL_URL: baseUrl,
    VITE_API_BASE_URL: apiUrl,
    VITE_API_URL: apiUrl,
    VITE_SSG_API_BASE_URL: apiUrl,
    VITE_PUBLIC_SITE_ORIGIN: baseUrl,
    VITE_SHOW_AD_SLOTS: "false"
  }
  delete env.npm_config_global_ignore_file
  delete env.NPM_CONFIG_GLOBAL_IGNORE_FILE

  const child = spawn(process.execPath, [npmExecPath, ...args], {
    cwd: projectRoot,
    env,
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"]
  })
  child.stdout.on("data", data => writeServerLine(isNuxt ? "nuxt" : "vite", data))
  child.stderr.on("data", data => writeServerLine(isNuxt ? "nuxt" : "vite", data))
  return child
}

function closeServer(server) {
  return new Promise(resolveClose => server.close(resolveClose))
}

async function stopProcess(child) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null)
    return

  const target = process.platform === "win32" ? child.pid : -child.pid
  try {
    process.kill(target, "SIGTERM")
  }
  catch (error) {
    if (error?.code !== "ESRCH")
      console.warn(`Could not stop frontend process: ${error.message}`)
    return
  }

  const exited = await new Promise((resolveStop) => {
    const timeout = setTimeout(() => resolveStop(false), 5_000)

    child.once("exit", () => {
      clearTimeout(timeout)
      resolveStop(true)
    })
  })
  if (exited)
    return

  try {
    process.kill(target, "SIGKILL")
  }
  catch (error) {
    if (error?.code !== "ESRCH")
      console.warn(`Could not force stop frontend process: ${error.message}`)
  }
}

async function analyzePage(browser, route, scheme) {
  const url = `${baseUrl}${route}`
  let lastError

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const page = await browser.newPage()
    try {
      page.setDefaultTimeout(30_000)
      await page.setRequestInterception(true)
      page.on("request", (request) => {
        const action = isolatedExternalScriptUrls.has(request.url())
          ? request.respond({
              body: "",
              contentType: "application/javascript",
              status: 200,
            })
          : request.continue()

        action.catch(() => {})
      })
      await page.setViewport({ width: 1280, height: 1000, deviceScaleFactor: 1 })
      if (scheme === "dark" || scheme === "light") {
        await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: scheme }])
      }
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 })
      await page.waitForNetworkIdle({ idleTime: 500, timeout: 8_000 }).catch(() => {})
      await page.addScriptTag({ path: axeSourcePath })
      const result = await page.evaluate(async () => {
        return await globalThis.axe.run(document, {
          resultTypes: ["violations"],
          runOnly: {
            type: "tag",
            values: ["wcag2a", "wcag2aa"]
          }
        })
      })

      return {
        url,
        scheme,
        violations: result.violations.filter(violation => violation.id !== "frame-tested")
      }
    }
    catch (error) {
      lastError = error
      if (attempt < 2)
        console.warn(`Retrying accessibility navigation for ${url} [${scheme}] after: ${error instanceof Error ? error.message : String(error)}`)
    }
    finally {
      await page.close().catch(() => {})
    }
  }

  throw new Error(`Accessibility navigation failed for ${url} [${scheme}]: ${lastError instanceof Error ? lastError.message : String(lastError)}`, {
    cause: lastError,
  })
}

const apiServer = createMockApiServer()
let frontendProcess
let browser

try {
  await assertPortAvailable(frontendPort, "frontend")
  if (!useBuiltServer)
    await assertPortAvailable(apiPort, "api")

  frontendProcess = startFrontend()

  if (!useBuiltServer)
    await listen(apiServer, apiPort)

  await waitForHttp(baseUrl)
  if (frontendPortFallbackDetected)
    throw new Error(`A11Y frontend did not bind expected port ${frontendPort}.`)

  browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage"]
  })

  const failures = []
  for (const route of routes) {
    for (const scheme of colorSchemes) {
      const result = await analyzePage(browser, route, scheme)
      if (result.violations.length) {
        failures.push(result)
        continue
      }
      console.log(`a11y ok: ${result.url} [${scheme}]`)
    }
  }

  if (failures.length) {
    for (const failure of failures) {
      console.error(`\nAccessibility issues for ${siteName} at ${failure.url} [${failure.scheme}]`)
      for (const violation of failure.violations) {
        console.error(`- [${violation.impact ?? "unknown"}] ${violation.id}: ${violation.help}`)
        console.error(`  ${violation.helpUrl}`)
        for (const node of violation.nodes) {
          console.error(`  ${node.target.join(", ")}`)
        }
      }
    }
    process.exitCode = 1
  }
}
finally {
  if (browser) await browser.close()
  await stopProcess(frontendProcess)
  if (apiServer.listening)
    await closeServer(apiServer)
}
