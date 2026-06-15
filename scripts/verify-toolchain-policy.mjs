import { readFileSync, readdirSync } from "node:fs"
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

function extractNpmVersion() {
  const packageJson = JSON.parse(readRepoFile("package.json"))
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

const npmVersion = extractNpmVersion()
const expectedNpmSpecifier = `npm@${npmVersion}`

const workflowFiles = listWorkflowFiles()
for (const workflowFile of workflowFiles) {
  const contents = readRepoFile(workflowFile)

  assertNpmPinsMatch(workflowFile, contents, expectedNpmSpecifier)

  if (contents.includes("npm ci"))
    assert(contents.includes("node-version: 22.x"), `${workflowFile} should run npm ci on Node 22.x`)
}

const ciWorkflow = readRepoFile(".github/workflows/ci.yml")
assert(ciWorkflow.includes("npm run verify:install-scripts"), "CI should verify dependency install-script policy after installing dependencies.")

const publicVerificationWorkflow = readRepoFile(".github/workflows/public-site-verification.yml")
assert(publicVerificationWorkflow.includes("npm run verify:install-scripts"), "Public verification workflow should verify dependency install-script policy.")

const dockerfile = readRepoFile("Dockerfile")
assertNpmPinsMatch("Dockerfile", dockerfile, expectedNpmSpecifier)
assert(dockerfile.includes("FROM node:22-alpine AS build-stage"), "Docker build stage should use Node 22 Alpine.")
assert(dockerfile.includes("FROM node:22-alpine AS production-stage"), "Docker production stage should use Node 22 Alpine.")
assert(dockerfile.includes("RUN npm ci"), "Docker build should use npm ci.")
assert(!dockerfile.includes("--ignore-scripts"), "Docker build should not bypass the reviewed install-script policy with --ignore-scripts.")
assert(dockerfile.includes("RUN npm run verify:install-scripts"), "Docker build should verify dependency install-script policy.")

console.log(`Toolchain policy verified for ${basename(process.cwd())}: ${expectedNpmSpecifier}, Node 22 CI/Docker, reviewed install scripts.`)
