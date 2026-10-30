import type { HostEnvironmentCheckStatus } from "../src/host-environment.js"
import process from "node:process"
import { buildHostEnvironmentReport } from "../src/host-environment.js"

function printUsage() {
  console.log(`Usage: npm run verify:host-env -- [options]

Checks the current process environment without loading .env files or printing secret values.

Options:
  --production        Require hosted production-safe settings.
  --fail-on-warnings  Exit non-zero when warning checks are present.
  --json              Print the report as JSON.
  --help              Show this help text.
`)
}

function parseArgs(args: string[]) {
  const options = {
    failOnWarnings: false,
    json: false,
    production: false,
  }

  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      printUsage()
      process.exit(0)
    }

    if (arg === "--production") {
      options.production = true
      continue
    }

    if (arg === "--fail-on-warnings") {
      options.failOnWarnings = true
      continue
    }

    if (arg === "--json") {
      options.json = true
      continue
    }

    console.error(`Unexpected argument: ${arg}`)
    printUsage()
    process.exit(1)
  }

  return options
}

function statusLabel(status: HostEnvironmentCheckStatus) {
  return status.toUpperCase().padEnd(4, " ")
}

const options = parseArgs(process.argv.slice(2))
const report = buildHostEnvironmentReport(process.env, options)

if (options.json) {
  console.log(JSON.stringify(report, null, 2))
}
else {
  console.log("CoFoundry host environment verification")
  console.log(`- NODE_ENV: ${report.mode.nodeEnv}`)
  console.log(`- Production expected: ${report.mode.productionExpected ? "yes" : "no"}`)
  console.log(`- App URL: ${report.mode.appUrl || "(unset)"}`)
  console.log(`- Backend mode: ${report.mode.backend}`)
  console.log(`- Billing mode: ${report.mode.billing}`)
  console.log(`- Demo access: ${report.mode.demoAccessEnabled ? "enabled" : "disabled"}`)
  console.log(`- Release: ${report.deployment.release || "(unset)"}`)
  console.log(`- Commit: ${report.deployment.commitSha
    ? report.deployment.commitSha.slice(0, 12)
    : "(unset)"}`)

  console.log("\nChecks:")
  for (const check of report.checks) {
    console.log(`[${statusLabel(check.status)}] ${check.title}: ${check.detail}`)
    if (check.remediation)
      console.log(`       ${check.remediation}`)
  }

  console.log(`\nSummary: ${report.failCount} failed, ${report.warningCount} warning${report.warningCount === 1
    ? ""
    : "s"}.`)
}

if (!report.ok)
  process.exitCode = 1
