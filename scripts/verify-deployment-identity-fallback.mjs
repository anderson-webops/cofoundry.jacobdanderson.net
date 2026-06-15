import { execFileSync, spawn } from "node:child_process"
import { existsSync } from "node:fs"
import { createServer } from "node:net"
import { join } from "node:path"
import process from "node:process"

const repoRoot = process.cwd()
const serverEntry = join(repoRoot, "front-end", ".output", "server", "index.mjs")
const identityEnvKeys = [
  "APP_VERSION",
  "BUILD_TIMESTAMP",
  "COMMIT_SHA",
  "COFOUNDRY_COMMIT_SHA",
  "COFOUNDRY_DEPLOYED_AT",
  "COFOUNDRY_RELEASE",
  "DEPLOYED_AT",
  "GIT_COMMIT",
  "RELEASE_VERSION",
  "SOURCE_VERSION",
  "VERCEL_GIT_COMMIT_SHA",
]

function assert(condition, message) {
  if (!condition)
    throw new Error(message)
}

function readCurrentGitCommit() {
  return execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim()
}

async function getFreePort() {
  const server = createServer()

  await new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", resolve)
  })

  const address = server.address()
  const port = typeof address === "object" && address ? address.port : 0

  await new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve())
  })

  assert(port > 0, "Could not allocate a local verification port.")
  return port
}

async function waitForHealth(baseUrl, child, output) {
  const startedAt = Date.now()
  let lastError = null

  while (Date.now() - startedAt < 20_000) {
    if (child.exitCode !== null)
      throw new Error(`Built server exited before health responded.\n${output.join("")}`)

    try {
      const response = await fetch(`${baseUrl}/api/health`)
      if (response.ok)
        return response.json()

      lastError = new Error(`Health returned HTTP ${response.status}.`)
    }
    catch (error) {
      lastError = error
    }

    await new Promise(resolve => setTimeout(resolve, 250))
  }

  throw new Error(`Timed out waiting for built server health. ${lastError instanceof Error ? lastError.message : ""}\n${output.join("")}`)
}

async function main() {
  assert(existsSync(serverEntry), "Built Nitro server not found. Run `npm run build` before `npm run verify:deployment-identity`.")

  const expectedCommit = readCurrentGitCommit()
  const port = await getFreePort()
  const env = {
    ...process.env,
    HOST: "127.0.0.1",
    NODE_ENV: "production",
    NUXT_PUBLIC_APP_URL: "https://cofoundry.example",
    NUXT_PUBLIC_BACKEND_MODE: "mock",
    NUXT_PUBLIC_BILLING_MODE: "mock",
    PORT: String(port),
  }

  for (const key of identityEnvKeys)
    delete env[key]

  const output = []
  const child = spawn(process.execPath, [serverEntry], {
    cwd: join(repoRoot, "front-end"),
    env,
    stdio: ["ignore", "pipe", "pipe"],
  })

  child.stdout.on("data", chunk => output.push(chunk.toString()))
  child.stderr.on("data", chunk => output.push(chunk.toString()))

  try {
    const body = await waitForHealth(`http://127.0.0.1:${port}`, child, output)
    const commitSha = body?.deployment?.commitSha

    assert(commitSha === expectedCommit, `/api/health should expose baked commit fallback ${expectedCommit}; received ${commitSha || "<empty>"}.`)
    console.log(`Deployment identity fallback verified: ${commitSha}`)
  }
  finally {
    if (child.exitCode === null) {
      child.kill("SIGTERM")
      await new Promise(resolve => child.once("exit", resolve))
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
