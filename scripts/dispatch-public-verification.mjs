import process from "node:process"

const defaultApiUrl = "https://api.github.com"
const defaultBaseUrl = "https://cofoundry.jacobdanderson.net"
const defaultEventType = "cofoundry-deployed"
const defaultRepo = "anderson-webops/cofoundry.jacobdanderson.net"

function fail(message) {
  console.error(message)
  process.exit(1)
}

function blankToUndefined(value) {
  const trimmed = value?.trim()
  return trimmed || undefined
}

function parseBooleanString(value, fallback = "true") {
  const normalized = blankToUndefined(value)?.toLowerCase()
  if (!normalized)
    return fallback

  if (["1", "true", "yes"].includes(normalized))
    return "true"

  if (["0", "false", "no"].includes(normalized))
    return "false"

  fail(`Expected a boolean value, received: ${value}`)
}

function parseArgs(args) {
  const options = {}

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === "--dry-run") {
      options.dryRun = true
      continue
    }

    if (!arg.startsWith("--"))
      fail(`Unexpected argument: ${arg}`)

    const [rawName, inlineValue] = arg.slice(2).split("=", 2)
    const name = rawName.replaceAll("-", "_")
    const value = inlineValue ?? args[index + 1]

    if (!value || value.startsWith("--"))
      fail(`Missing value for --${rawName}`)

    options[name] = value

    if (inlineValue === undefined)
      index += 1
  }

  return options
}

function normalizeApiUrl(value) {
  const url = new URL(value)
  url.pathname = url.pathname.replace(/\/+$/, "")
  url.search = ""
  url.hash = ""

  return url.toString().replace(/\/+$/, "")
}

function normalizeRepo(value) {
  const repo = blankToUndefined(value) || defaultRepo
  if (!/^[^/\s]+\/[^/\s]+$/.test(repo))
    fail(`GitHub repository must be in owner/name format. Received: ${repo}`)

  return repo
}

function normalizeBaseUrl(value) {
  const url = new URL(blankToUndefined(value) || defaultBaseUrl)
  url.pathname = url.pathname.replace(/\/+$/, "") || "/"
  url.search = ""
  url.hash = ""

  return url.toString().replace(/\/+$/, "")
}

function buildDispatchRequest(options) {
  const clientPayload = {
    base_url: normalizeBaseUrl(options.base_url || process.env.VERIFY_PUBLIC_BASE_URL || process.env.NUXT_PUBLIC_APP_URL),
    expected_commit_sha: blankToUndefined(options.expected_commit_sha || process.env.VERIFY_PUBLIC_EXPECT_COMMIT_SHA || process.env.COFOUNDRY_COMMIT_SHA) || "",
    expected_release: blankToUndefined(options.expected_release || process.env.VERIFY_PUBLIC_EXPECT_RELEASE || process.env.COFOUNDRY_RELEASE) || "",
    require_deployment_identity: parseBooleanString(options.require_deployment_identity || process.env.VERIFY_PUBLIC_REQUIRE_DEPLOYMENT_IDENTITY, "true"),
  }

  return {
    client_payload: clientPayload,
    event_type: blankToUndefined(options.event_type) || defaultEventType,
  }
}

async function dispatchVerification(options, request) {
  const repo = normalizeRepo(options.repo || process.env.GITHUB_REPOSITORY)
  const apiUrl = normalizeApiUrl(options.api_url || process.env.GITHUB_API_URL || defaultApiUrl)
  const endpoint = `${apiUrl}/repos/${repo}/dispatches`

  if (options.dryRun) {
    console.log(`Public verification dispatch dry run for ${repo}:`)
    console.log(JSON.stringify({ endpoint, request }, null, 2))
    return
  }

  const token = blankToUndefined(process.env.GITHUB_TOKEN || process.env.GH_TOKEN)
  if (!token)
    fail("Set GITHUB_TOKEN or GH_TOKEN before dispatching the live public verification workflow, or pass --dry-run.")

  const response = await fetch(endpoint, {
    body: JSON.stringify(request),
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "cofoundry-public-verification-dispatch",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    method: "POST",
  })

  if (response.status !== 204) {
    const body = await response.text()
    fail(`GitHub repository_dispatch failed with ${response.status}: ${body.slice(0, 500)}`)
  }

  console.log(`Dispatched ${request.event_type} public verification workflow for ${repo}.`)
}

const options = parseArgs(process.argv.slice(2))
const request = buildDispatchRequest(options)

await dispatchVerification(options, request)
