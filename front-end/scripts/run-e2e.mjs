import { spawnSync } from "node:child_process"
import process from "node:process"

const npmCommand = process.platform === "win32"
  ? "npm.cmd"
  : "npm"
const environment = {
  ...process.env,
  COFOUNDRY_LOCAL_DATA_DIR: "/var/lib/cofoundry",
  COFOUNDRY_OPERATIONS_TOKEN: "synthetic-e2e-operations-token-000001",
  NODE_ENV: "production",
  NUXT_PUBLIC_APP_URL: "https://cofoundry.example.com",
  NUXT_PUBLIC_BACKEND_MODE: "mock",
  NUXT_PUBLIC_BILLING_MODE: "mock",
  NUXT_PUBLIC_ENABLE_DEMO_ACCESS: "false",
  SESSION_SIGNING_SECRET: "synthetic-e2e-session-signing-secret",
}

const steps = [
  {
    args: [
      "exec",
      "--",
      "playwright",
      "install",
      "chromium"
    ],
    label: "Install the Playwright Chromium runtime",
  },
  {
    args: ["run", "build"],
    label: "Build the production E2E application",
  },
  {
    args: ["exec", "--", "playwright", "test"],
    label: "Run the Playwright E2E suite",
  },
]

for (const step of steps) {
  console.log(`[e2e] ${step.label}`)
  const result = spawnSync(npmCommand, step.args, {
    env: environment,
    shell: false,
    stdio: "inherit",
  })

  if (result.error)
    throw result.error

  if (result.status !== 0)
    process.exit(result.status ?? 1)
}
