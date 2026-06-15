import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import process from "node:process"

const defaultPublicOrigin = "https://cofoundry.jacobdanderson.net"
const templatePath = new URL("../docs/server-ai-live-deploy-prompt.md", import.meta.url)

function printUsage() {
  console.log(`Usage: npm run server:prompt:live-deploy -- [options]

Renders the live deploy catch-up prompt with exact release identity values.

Options:
  --release <tag>        Release tag to hand off. Defaults to COFOUNDRY_RELEASE or the exact Git tag on HEAD.
  --commit-sha <sha>     Commit SHA to hand off. Defaults to COFOUNDRY_COMMIT_SHA or git rev-parse HEAD.
  --deployed-at <iso>    Deployment timestamp to include. Defaults to the current ISO timestamp.
  --public-origin <url>  Public origin to verify. Defaults to NUXT_PUBLIC_APP_URL or ${defaultPublicOrigin}.
  --check                Validate the rendered prompt but do not print it.
  --help                 Show this help text.
`)
}

function parseArgs(args) {
  const options = {
    check: false,
    commitSha: "",
    deployedAt: "",
    publicOrigin: "",
    release: "",
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === "--help" || arg === "-h") {
      printUsage()
      process.exit(0)
    }

    if (arg === "--check") {
      options.check = true
      continue
    }

    if (["--release", "--commit-sha", "--deployed-at", "--public-origin"].includes(arg)) {
      const value = args[index + 1]
      if (!value || value.startsWith("--")) {
        console.error(`Missing value for ${arg}.`)
        printUsage()
        process.exit(1)
      }

      const key = arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())
      options[key] = value
      index += 1
      continue
    }

    console.error(`Unexpected argument: ${arg}`)
    printUsage()
    process.exit(1)
  }

  return options
}

function git(args) {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim()
  }
  catch {
    return ""
  }
}

function resolveRelease(explicitRelease) {
  return explicitRelease
    || process.env.COFOUNDRY_RELEASE
    || git(["describe", "--exact-match", "--tags", "HEAD"])
}

function resolveCommitSha(explicitCommitSha) {
  return explicitCommitSha
    || process.env.COFOUNDRY_COMMIT_SHA
    || git(["rev-parse", "HEAD"])
}

function validateRelease(release) {
  if (!release)
    throw new Error("Release tag is required. Pass --release, set COFOUNDRY_RELEASE, or run from an exactly tagged release commit.")

  if (!/^v\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(release))
    throw new Error(`Release tag must be lowercase semver such as v1.1.105. Received: ${release}`)
}

function validateCommitSha(commitSha) {
  if (!/^[a-f0-9]{40}$/.test(commitSha))
    throw new Error(`Commit SHA must be a 40-character lowercase Git SHA. Received: ${commitSha || "(empty)"}`)
}

function validateIsoTimestamp(value) {
  const timestamp = Date.parse(value)
  if (!value || Number.isNaN(timestamp))
    throw new Error(`Deployment timestamp must be a valid ISO timestamp. Received: ${value || "(empty)"}`)
}

function validatePublicOrigin(publicOrigin) {
  let url
  try {
    url = new URL(publicOrigin)
  }
  catch {
    throw new Error(`Public origin must be a valid URL. Received: ${publicOrigin || "(empty)"}`)
  }

  if (url.protocol !== "https:")
    throw new Error(`Public origin must use HTTPS. Received: ${publicOrigin}`)

  if (url.pathname !== "/" || url.search || url.hash)
    throw new Error(`Public origin must not include a path, query, or hash. Received: ${publicOrigin}`)

  return url.origin
}

function renderPrompt(template, values) {
  return template
    .replaceAll("<release-tag>", values.release)
    .replaceAll("<commit-sha>", values.commitSha)
    .replaceAll("<current ISO timestamp>", values.deployedAt)
    .replaceAll("<public-origin>", values.publicOrigin)
}

function assertRenderedPrompt(rendered, values) {
  const unreplacedPlaceholders = rendered.match(/<(?:release-tag|commit-sha|current ISO timestamp|public-origin)>/g) || []
  if (unreplacedPlaceholders.length)
    throw new Error(`Live deploy prompt still contains placeholders: ${[...new Set(unreplacedPlaceholders)].join(", ")}`)

  for (const [label, value] of Object.entries(values)) {
    if (!rendered.includes(value))
      throw new Error(`Live deploy prompt does not include ${label}: ${value}`)
  }

  const requiredSafeguards = [
    "Keep production in mock/access-request mode.",
    "Do not enable Supabase, Stripe, OAuth, outbound mail, or provider webhooks.",
    "Do not add dotenv or dotenvx loading to production startup.",
    "npm run verify:host-env -- --production",
    "npm run verify:public",
  ]

  for (const safeguard of requiredSafeguards) {
    if (!rendered.includes(safeguard))
      throw new Error(`Live deploy prompt is missing required safeguard: ${safeguard}`)
  }
}

const options = parseArgs(process.argv.slice(2))

try {
  const values = {
    commitSha: resolveCommitSha(options.commitSha),
    deployedAt: options.deployedAt || new Date().toISOString(),
    publicOrigin: validatePublicOrigin(options.publicOrigin || process.env.NUXT_PUBLIC_APP_URL || defaultPublicOrigin),
    release: resolveRelease(options.release),
  }

  validateRelease(values.release)
  validateCommitSha(values.commitSha)
  validateIsoTimestamp(values.deployedAt)

  const template = readFileSync(templatePath, "utf8")
  const rendered = renderPrompt(template, values)
  assertRenderedPrompt(rendered, values)

  if (options.check) {
    console.log(`Live deploy prompt rendered for ${values.release} (${values.commitSha}).`)
  }
  else {
    process.stdout.write(rendered)
    if (!rendered.endsWith("\n"))
      process.stdout.write("\n")
  }
}
catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
