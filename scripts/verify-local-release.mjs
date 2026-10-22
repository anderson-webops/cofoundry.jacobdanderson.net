import { spawn } from "node:child_process"
import process from "node:process"

const npmExecPath = process.env.npm_execpath

if (!npmExecPath)
  throw new Error("Run local release verification through npm so the selected npm executable is known.")

const syntheticProductionHostEnv = {
  COFOUNDRY_COMMIT_SHA: "0000000000000000000000000000000000000000",
  COFOUNDRY_DEPLOYED_AT: "2026-01-01T00:00:00.000Z",
  COFOUNDRY_GITHUB_OAUTH_PROVIDER: "",
  COFOUNDRY_GOOGLE_OAUTH_PROVIDER: "",
  COFOUNDRY_LOCAL_DATA_DIR: "/var/lib/cofoundry",
  COFOUNDRY_OAUTH_PROVIDER: "",
  COFOUNDRY_OPERATIONS_TOKEN: "synthetic-release-worker-token-000001",
  COFOUNDRY_RELEASE: "local-release",
  COFOUNDRY_TRUST_PROXY_HEADERS: "true",
  COFOUNDRY_TRUSTED_PROXY_IPS: "127.0.0.1",
  NODE_ENV: "production",
  NUXT_PUBLIC_APP_URL: "https://cofoundry.example.com",
  NUXT_PUBLIC_BACKEND_MODE: "mock",
  NUXT_PUBLIC_BILLING_MODE: "mock",
  NUXT_PUBLIC_ENABLE_DEMO_ACCESS: "false",
  SESSION_SIGNING_SECRET: "synthetic-release-session-signing-secret",
}

const syntheticProductionBuildEnv = {
  COFOUNDRY_LOCAL_DATA_DIR: syntheticProductionHostEnv.COFOUNDRY_LOCAL_DATA_DIR,
  COFOUNDRY_OPERATIONS_TOKEN: syntheticProductionHostEnv.COFOUNDRY_OPERATIONS_TOKEN,
  NODE_ENV: syntheticProductionHostEnv.NODE_ENV,
  NUXT_PUBLIC_APP_URL: "https://cofoundry.jacobdanderson.net",
  NUXT_PUBLIC_BACKEND_MODE: syntheticProductionHostEnv.NUXT_PUBLIC_BACKEND_MODE,
  NUXT_PUBLIC_BILLING_MODE: syntheticProductionHostEnv.NUXT_PUBLIC_BILLING_MODE,
  NUXT_PUBLIC_ENABLE_DEMO_ACCESS: syntheticProductionHostEnv.NUXT_PUBLIC_ENABLE_DEMO_ACCESS,
  SESSION_SIGNING_SECRET: syntheticProductionHostEnv.SESSION_SIGNING_SECRET,
}

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
    args: ["run", "verify:install-scripts"],
    id: "install-script-policy",
    label: "Verify dependency install-script policy",
  },
  {
    args: ["run", "verify:standalone-installs"],
    id: "standalone-installs",
    label: "Verify standalone workspace install contracts",
  },
  {
    args: ["run", "verify:toolchain"],
    id: "toolchain-policy",
    label: "Verify Node/npm toolchain policy",
  },
  {
    args: ["run", "verify:host-env", "--", "--production", "--fail-on-warnings"],
    env: syntheticProductionHostEnv,
    id: "host-env",
    label: "Verify production host environment contract",
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
    args: ["run", "test:runtime-artifact"],
    id: "runtime-artifact-tests",
    label: "Run runtime artifact and protected-path tests",
  },
  {
    args: ["run", "build"],
    env: syntheticProductionBuildEnv,
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
  const usesNpm = !step.command
  const command = usesNpm ? process.execPath : step.command
  const args = usesNpm ? [npmExecPath, ...step.args] : step.args
  const displayCommand = step.command || "npm"
  const startedAt = Date.now()
  const env = {
    ...process.env,
    ...(step.env || {}),
  }
  if (usesNpm) {
    delete env.npm_config_global_ignore_file
    delete env.NPM_CONFIG_GLOBAL_IGNORE_FILE
  }

  console.log(`\n[${index + 1}/${total}] ${step.label}`)
  console.log(`$ ${[displayCommand, ...step.args].join(" ")}`)

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
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
