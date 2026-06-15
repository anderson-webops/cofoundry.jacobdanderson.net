import assert from "node:assert/strict"
import test from "node:test"
import { buildHostEnvironmentReport } from "../src/host-environment.js"

const productionMockEnv = {
  COFOUNDRY_COMMIT_SHA: "abcdef1234567890",
  COFOUNDRY_LOCAL_DATA_DIR: "/var/lib/cofoundry",
  COFOUNDRY_OPERATIONS_TOKEN: "operations-token-value",
  COFOUNDRY_RELEASE: "v1.1.105",
  NODE_ENV: "production",
  NUXT_PUBLIC_APP_URL: "https://cofoundry.example.com",
  NUXT_PUBLIC_BACKEND_MODE: "mock",
  NUXT_PUBLIC_BILLING_MODE: "mock",
  NUXT_PUBLIC_ENABLE_DEMO_ACCESS: "false",
  SESSION_SIGNING_SECRET: "a-long-random-session-signing-secret",
}

test("host environment report passes for production mock/access-request env", () => {
  const report = buildHostEnvironmentReport(productionMockEnv, { production: true })

  assert.equal(report.ok, true)
  assert.equal(report.failCount, 0)
  assert.equal(report.mode.backend, "mock")
  assert.equal(report.mode.billing, "mock")
})

test("host environment report fails production when app URL is local", () => {
  const report = buildHostEnvironmentReport({
    ...productionMockEnv,
    NUXT_PUBLIC_APP_URL: "http://localhost:3000",
  }, { production: true })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(check => check.id === "app-url")?.status, "fail")
})

test("host environment report fails production when deployment identity is missing", () => {
  const { COFOUNDRY_COMMIT_SHA: _commitSha, COFOUNDRY_RELEASE: _release, ...env } = productionMockEnv
  const report = buildHostEnvironmentReport(env, { production: true })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(check => check.id === "deployment-identity")?.status, "fail")
})

test("host environment report fails production when demo access is enabled", () => {
  const report = buildHostEnvironmentReport({
    ...productionMockEnv,
    NUXT_PUBLIC_ENABLE_DEMO_ACCESS: "true",
  }, { production: true })

  assert.equal(report.ok, false)
  assert.equal(report.checks.find(check => check.id === "demo-access")?.status, "fail")
})

test("host environment report warns when operations worker token is missing", () => {
  const { COFOUNDRY_OPERATIONS_TOKEN: _operationsToken, ...env } = productionMockEnv
  const report = buildHostEnvironmentReport(env, { production: true })

  assert.equal(report.checks.find(check => check.id === "operations-token")?.status, "warn")
  assert.equal(report.ok, true)
})

test("host environment report can fail on warnings for stricter operator gates", () => {
  const { COFOUNDRY_OPERATIONS_TOKEN: _operationsToken, ...env } = productionMockEnv
  const report = buildHostEnvironmentReport(env, { failOnWarnings: true, production: true })

  assert.equal(report.checks.find(check => check.id === "operations-token")?.status, "warn")
  assert.equal(report.ok, false)
})
