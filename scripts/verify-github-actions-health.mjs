import { execFileSync } from "node:child_process"
import process from "node:process"

const defaultApiUrl = "https://api.github.com"
const defaultBranch = "main"
const defaultRepo = "anderson-webops/cofoundry.jacobdanderson.net"
const defaultWorkflows = ["CI", "Qodana"]

function fail(message) {
  console.error(message)
  process.exit(1)
}

function blankToUndefined(value) {
  const trimmed = value?.trim()
  return trimmed || undefined
}

function parseArgs(args) {
  const options = {
    workflows: [],
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (!arg.startsWith("--"))
      fail(`Unexpected argument: ${arg}`)

    const [rawName, inlineValue] = arg.slice(2).split("=", 2)
    const name = rawName.replaceAll("-", "_")
    const value = inlineValue ?? args[index + 1]

    if (!value || value.startsWith("--"))
      fail(`Missing value for --${rawName}`)

    if (name === "workflow")
      options.workflows.push(value)
    else
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

async function githubFetch(apiUrl, path, token) {
  const response = await fetch(`${apiUrl}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "User-Agent": "cofoundry-github-actions-health",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  })

  if (!response.ok) {
    const body = await response.text()
    fail(`GitHub API request failed with ${response.status}: ${body.slice(0, 500)}`)
  }

  return response.json()
}

function isRunnerStartFailure(job) {
  return job.status === "completed"
    && job.conclusion === "failure"
    && (job.runner_id === 0 || !job.runner_name)
    && Array.isArray(job.steps)
    && job.steps.length === 0
}

function describeRun(run) {
  return `${run.name} #${run.run_number || run.id} (${run.head_sha?.slice(0, 12) || "unknown"}, ${run.status}/${run.conclusion || "pending"})`
}

function readGitHubCliToken() {
  try {
    return blankToUndefined(execFileSync("gh", ["auth", "token"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }))
  }
  catch {
    return undefined
  }
}

const options = parseArgs(process.argv.slice(2))
const apiUrl = normalizeApiUrl(options.api_url || process.env.GITHUB_API_URL || defaultApiUrl)
const branch = blankToUndefined(options.branch || process.env.GITHUB_BRANCH) || defaultBranch
const repo = normalizeRepo(options.repo || process.env.GITHUB_REPOSITORY)
const token = blankToUndefined(process.env.GITHUB_TOKEN || process.env.GH_TOKEN) || readGitHubCliToken()
const workflows = options.workflows.length > 0 ? options.workflows : defaultWorkflows

const runsPath = `/repos/${repo}/actions/runs?branch=${encodeURIComponent(branch)}&per_page=50`
const runsPayload = await githubFetch(apiUrl, runsPath, token)
const runs = Array.isArray(runsPayload.workflow_runs) ? runsPayload.workflow_runs : []

const failures = []
const summaries = []

for (const workflow of workflows) {
  const run = runs.find(candidate => candidate.name === workflow)

  if (!run) {
    failures.push(`${workflow}: no recent run found on ${branch}.`)
    continue
  }

  const jobsPayload = await githubFetch(apiUrl, `/repos/${repo}/actions/runs/${run.id}/jobs?per_page=100`, token)
  const jobs = Array.isArray(jobsPayload.jobs) ? jobsPayload.jobs : []
  const runnerStartFailures = jobs.filter(isRunnerStartFailure)
  const startedJobs = jobs.filter(job => Array.isArray(job.steps) && job.steps.length > 0)

  summaries.push(`${workflow}: ${describeRun(run)}; jobs=${jobs.length}; started=${startedJobs.length}; runner-start-failures=${runnerStartFailures.length}`)

  if (run.status === "completed" && run.conclusion === "success") {
    continue
  }

  if (jobs.length > 0 && runnerStartFailures.length === jobs.length) {
    failures.push(`${workflow}: GitHub did not start any jobs for run ${run.id}. This is not a source/test failure. Check GitHub Actions billing, spending limits, Actions enablement, or runner availability.`)
    continue
  }

  failures.push(`${workflow}: latest run is ${run.status}/${run.conclusion || "pending"}. Inspect ${run.html_url}`)
}

const output = ["GitHub Actions health summary:"]
for (const summary of summaries)
  output.push(`- ${summary}`)

if (failures.length > 0) {
  output.push("", "GitHub Actions health failed:")
  for (const failure of failures)
    output.push(`- ${failure}`)
  console.log(output.join("\n"))
  process.exit(1)
}

console.log(output.join("\n"))
console.log("GitHub Actions health passed.")
