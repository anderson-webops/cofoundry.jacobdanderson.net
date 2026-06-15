import { spawn } from "node:child_process"
import process from "node:process"

const steps = [
  {
    args: ["ci"],
    id: "install",
    label: "Install exact workspace dependencies",
  },
  {
    args: ["run", "audit"],
    id: "audit",
    label: "Check dependency advisories",
  },
  {
    args: ["run", "lint"],
    id: "lint",
    label: "Run workspace linting",
  },
  {
    args: ["run", "typecheck"],
    id: "typecheck",
    label: "Run workspace typecheck",
  },
  {
    args: ["run", "test:unit"],
    env: { CI: "1" },
    id: "unit-tests",
    label: "Run unit and backend tests",
  },
  {
    args: ["run", "build"],
    id: "build",
    label: "Build frontend and backend",
  },
  {
    args: ["run", "verify:deployment-identity"],
    id: "deployment-identity",
    label: "Verify built deployment identity fallback",
  },
  {
    args: ["run", "verify:shared-shims"],
    id: "shared-shims",
    label: "Verify shared server/client shims",
  },
  {
    args: ["run", "verify:analytics"],
    id: "analytics",
    label: "Verify analytics trackers in build output",
  },
  {
    args: ["run", "verify:production"],
    id: "production-smoke",
    label: "Run built production smoke checks",
  },
  {
    args: ["run", "verify:public:local"],
    id: "public-local",
    label: "Run local public-route crawl",
  },
  {
    args: ["run", "a11y:production"],
    id: "accessibility",
    label: "Run production accessibility smoke checks",
  },
  {
    args: ["run", "verify:public:dispatch", "--", "--dry-run"],
    id: "dispatch-dry-run",
    label: "Verify public workflow dispatch payload",
  },
  {
    args: ["--check", "scripts/verify-github-actions-health.mjs"],
    command: "node",
    id: "github-actions-diagnostic-syntax",
    label: "Check GitHub Actions diagnostic script syntax",
  },
  {
    args: ["diff", "--check", "--no-ext-diff"],
    command: "git",
    id: "diff-check",
    label: "Check diff whitespace",
  },
]

function printUsage() {
  console.log(`Usage: npm run verify:release:local -- [options]

Runs the full local release gate for CoFoundry without touching live services.

Options:
  --skip-install    Skip npm ci when exact dependencies are already installed.
  --help            Show this help text.
`)
}

function parseArgs(args) {
  const options = {
    skipInstall: false,
  }

  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      printUsage()
      process.exit(0)
    }

    if (arg === "--skip-install") {
      options.skipInstall = true
      continue
    }

    console.error(`Unexpected argument: ${arg}`)
    printUsage()
    process.exit(1)
  }

  return options
}

function formatDuration(startedAt) {
  const seconds = (Date.now() - startedAt) / 1000
  if (seconds < 60)
    return `${seconds.toFixed(1)}s`

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.round(seconds % 60).toString().padStart(2, "0")
  return `${minutes}m ${remainingSeconds}s`
}

function runStep(step, index, total) {
  const command = step.command || "npm"
  const startedAt = Date.now()
  const env = {
    ...process.env,
    ...(step.env || {}),
  }

  console.log(`\n[${index + 1}/${total}] ${step.label}`)
  console.log(`$ ${[command, ...step.args].join(" ")}`)

  return new Promise((resolve, reject) => {
    const child = spawn(command, step.args, {
      env,
      shell: false,
      stdio: "inherit",
    })

    child.on("error", reject)

    child.on("close", (code, signal) => {
      if (code === 0) {
        console.log(`Completed ${step.id} in ${formatDuration(startedAt)}.`)
        resolve()
        return
      }

      const reason = signal ? `signal ${signal}` : `exit code ${code}`
      reject(new Error(`${step.id} failed with ${reason}.`))
    })
  })
}

const options = parseArgs(process.argv.slice(2))
const selectedSteps = options.skipInstall
  ? steps.filter(step => step.id !== "install")
  : steps
const startedAt = Date.now()

console.log("Starting CoFoundry local release verification.")
if (options.skipInstall)
  console.log("Skipping npm ci because --skip-install was provided.")

try {
  for (const [index, step] of selectedSteps.entries())
    await runStep(step, index, selectedSteps.length)

  console.log(`\nCoFoundry local release verification passed in ${formatDuration(startedAt)}.`)
}
catch (error) {
  console.error(`\nCoFoundry local release verification failed after ${formatDuration(startedAt)}.`)
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
