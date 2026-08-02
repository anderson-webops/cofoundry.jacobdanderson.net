import { existsSync, readFileSync, readdirSync } from "node:fs"
import { basename, join } from "node:path"
import process from "node:process"

const repoRoot = new URL("..", import.meta.url)

function readRepoFile(path) {
  return readFileSync(new URL(path, `${repoRoot}/`), "utf8")
}

function fail(message) {
  throw new Error(message)
}

function assert(condition, message) {
  if (!condition)
    fail(message)
}

function extractNpmVersion(packageJson) {
  const packageManager = String(packageJson.packageManager || "")
  const match = packageManager.match(/^npm@(\d+\.\d+\.\d+)$/)

  assert(match, `packageManager must pin npm exactly, received: ${packageManager || "(missing)"}`)

  return match[1]
}

function listWorkflowFiles() {
  const workflowsDir = new URL(".github/workflows", `${repoRoot}/`)

  return readdirSync(workflowsDir, { withFileTypes: true })
    .filter(entry => entry.isFile() && /\.ya?ml$/.test(entry.name))
    .map(entry => join(".github/workflows", entry.name))
    .sort()
}

function assertNpmPinsMatch(filePath, contents, expectedNpmSpecifier) {
  const pins = Array.from(contents.matchAll(/npm\s+i\s+-g\s+npm@([0-9]+\.[0-9]+\.[0-9]+)/g), match => `npm@${match[1]}`)

  for (const pin of pins)
    assert(pin === expectedNpmSpecifier, `${filePath} pins ${pin}, expected ${expectedNpmSpecifier}`)
}

const packageJson = JSON.parse(readRepoFile("package.json"))
const npmVersion = extractNpmVersion(packageJson)
const expectedNpmSpecifier = `npm@${npmVersion}`

assert(packageJson.engines?.node === ">=24.18.1 <25", "engines.node must enforce the Node 24.18.1 LTS line.")
assert(packageJson.engines?.npm === ">=12.0.2 <13", "engines.npm must enforce the npm 12.0.2 line.")
assert(!Object.hasOwn(packageJson, "devEngines"), "devEngines must remain absent so bundled npm can bootstrap the pinned npm version.")

const npmConfig = readRepoFile(".npmrc")
assert(npmConfig.includes("engine-strict=true"), ".npmrc must enforce package engine requirements during installs.")

const npmHelper = readRepoFile("scripts/run-pinned-npm.mjs")
assert(npmHelper.includes("process.env.npm_execpath"), "Nested npm commands must reuse the selected npm executable.")
assert(npmHelper.includes("delete env.npm_config_global_ignore_file"), "Nested npm commands must remove obsolete lowercase global-ignore config.")
assert(npmHelper.includes("delete env.NPM_CONFIG_GLOBAL_IGNORE_FILE"), "Nested npm commands must remove obsolete uppercase global-ignore config.")

for (const [name, script] of Object.entries(packageJson.scripts || {}))
  assert(!/(?:^|&&|\|\|)\s*npm\s/u.test(script), `package script ${name} must not rediscover a different npm executable.`)

const workflowFiles = listWorkflowFiles()
for (const workflowFile of workflowFiles) {
  const contents = readRepoFile(workflowFile)

  assertNpmPinsMatch(workflowFile, contents, expectedNpmSpecifier)

  if (contents.includes("npm ci"))
    assert(contents.includes("node-version: 24.18.1"), `${workflowFile} should run npm ci on Node 24.18.1`)
}

const ciWorkflow = readRepoFile(".github/workflows/ci.yml")
assert(ciWorkflow.includes("npm run verify:install-scripts"), "CI should verify dependency install-script policy after installing dependencies.")

const publicVerificationWorkflow = readRepoFile(".github/workflows/public-site-verification.yml")
assert(publicVerificationWorkflow.includes("npm run verify:install-scripts"), "Public verification workflow should verify dependency install-script policy.")

const netlifyConfig = readRepoFile("netlify.toml")
assert(netlifyConfig.includes('NODE_VERSION = "24.18.1"'), "Netlify should build on Node 24.18.1.")
assert(netlifyConfig.includes('NPM_VERSION = "12.0.2"'), "Netlify should select npm 12.0.2 before building.")

const appService = readRepoFile("deploy/systemd/cofoundry-app.service")
assert(appService.includes("ExecStart=/usr/bin/node front-end/.output/server/index.mjs"), "The direct production service should start the built Nuxt output with Node.")
assert(appService.includes("Environment=NITRO_HOST=127.0.0.1"), "The direct production service must bind to loopback.")

for (const retiredContainerPath of ["Dockerfile", ".dockerignore", "compose.yml", "compose.yaml", "docker-compose.yml", "docker-compose.yaml"])
  assert(!existsSync(new URL(retiredContainerPath, `${repoRoot}/`)), `${retiredContainerPath} should remain retired from the production deployment path.`)

console.log(`Toolchain policy verified for ${basename(process.cwd())}: bootstrap-safe ${expectedNpmSpecifier}, Node 24.18.1 CI/Netlify/direct-host builds, reviewed install scripts, and no container deployment path.`)
