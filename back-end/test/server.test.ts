import type { AddressInfo } from "node:net"
import assert from "node:assert/strict"
import test from "node:test"
import { resolveBootstrapAdminEnvironment, resolveBootstrapAdminInput } from "../src/bootstrap-admin"
import { collectEnvironmentValidationErrors, isLocalDevelopmentEnvironment, readDeploymentMetadata, readPublicEnvironment, readSecretEnvironment } from "../src/environment"
import { createBackendServer } from "../src/server"

function restoreEnvValue(key: string, value: string | undefined) {
  if (typeof value === "undefined")
    delete process.env[key]
  else
    process.env[key] = value
}

async function withServer(run: (baseUrl: string) => Promise<void>) {
  const server = createBackendServer()

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => resolve())
  })

  const address = server.address() as AddressInfo
  const baseUrl = `http://127.0.0.1:${address.port}`

  try {
    await run(baseUrl)
  }
  finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error)
          reject(error)
        else
          resolve()
      })
    })
  }
}

test("health endpoint reports service status", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`)
    const body = await response.json()

    assert.equal(response.status, 200)
    assert.equal(body.status, "ok")
    assert.equal(body.service, "cofoundry-back-end")
    assert.deepEqual(body.deployment, readDeploymentMetadata(process.env))
    assert.equal(typeof body.now, "string")
  })
})

test("metadata endpoint reflects env-driven flags", async () => {
  const previousBackendMode = process.env.NUXT_PUBLIC_BACKEND_MODE
  const previousBillingMode = process.env.NUXT_PUBLIC_BILLING_MODE
  const previousInvestment = process.env.NUXT_PUBLIC_FEATURE_INVESTMENT_MODULE
  const previousDemoAccess = process.env.NUXT_PUBLIC_ENABLE_DEMO_ACCESS
  const previousAppUrl = process.env.NUXT_PUBLIC_APP_URL
  const previousSupportEmail = process.env.NUXT_PUBLIC_SUPPORT_EMAIL
  const previousSupabaseUrl = process.env.NUXT_PUBLIC_SUPABASE_URL
  const previousSupabaseAnonKey = process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY
  const previousSupabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const previousSessionSigningSecret = process.env.SESSION_SIGNING_SECRET
  const previousRelease = process.env.COFOUNDRY_RELEASE
  const previousCommitSha = process.env.COFOUNDRY_COMMIT_SHA
  const previousDeployedAt = process.env.COFOUNDRY_DEPLOYED_AT

  process.env.COFOUNDRY_COMMIT_SHA = "dcb599f5b5f1a72e5d78b4e0f19f3c9b5e1a1234"
  process.env.COFOUNDRY_DEPLOYED_AT = "2026-06-12T11:55:00.000Z"
  process.env.COFOUNDRY_RELEASE = "v1.1.78"
  process.env.NUXT_PUBLIC_BACKEND_MODE = "supabase"
  process.env.NUXT_PUBLIC_BILLING_MODE = "mock"
  process.env.NUXT_PUBLIC_ENABLE_DEMO_ACCESS = "true"
  process.env.NUXT_PUBLIC_APP_URL = "https://cofoundry.example"
  process.env.NUXT_PUBLIC_FEATURE_INVESTMENT_MODULE = "true"
  process.env.NUXT_PUBLIC_SUPPORT_EMAIL = "support@cofoundry.dev"
  process.env.NUXT_PUBLIC_SUPABASE_URL = "https://cofoundry.supabase.co"
  process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY = "public-anon-key"
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key"
  process.env.SESSION_SIGNING_SECRET = "session-secret"

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/metadata`)
      const body = await response.json()

      assert.equal(response.status, 200)
      assert.equal(body.app, "CoFoundry")
      assert.equal(body.backendMode, "supabase")
      assert.equal(body.billingMode, "mock")
      assert.equal(body.demoAccessEnabled, true)
      assert.deepEqual(body.deployment, {
        commitSha: "dcb599f5b5f1a72e5d78b4e0f19f3c9b5e1a1234",
        deployedAt: "2026-06-12T11:55:00.000Z",
        release: "v1.1.78",
      })
      assert.equal(body.investmentModuleEnabled, true)
      assert.equal(body.supportEmail, "support@cofoundry.dev")
    })
  }
  finally {
    restoreEnvValue("COFOUNDRY_COMMIT_SHA", previousCommitSha)
    restoreEnvValue("COFOUNDRY_DEPLOYED_AT", previousDeployedAt)
    restoreEnvValue("COFOUNDRY_RELEASE", previousRelease)
    restoreEnvValue("NUXT_PUBLIC_BACKEND_MODE", previousBackendMode)
    restoreEnvValue("NUXT_PUBLIC_BILLING_MODE", previousBillingMode)
    restoreEnvValue("NUXT_PUBLIC_ENABLE_DEMO_ACCESS", previousDemoAccess)
    restoreEnvValue("NUXT_PUBLIC_APP_URL", previousAppUrl)
    restoreEnvValue("NUXT_PUBLIC_FEATURE_INVESTMENT_MODULE", previousInvestment)
    restoreEnvValue("NUXT_PUBLIC_SUPPORT_EMAIL", previousSupportEmail)
    restoreEnvValue("NUXT_PUBLIC_SUPABASE_URL", previousSupabaseUrl)
    restoreEnvValue("NUXT_PUBLIC_SUPABASE_ANON_KEY", previousSupabaseAnonKey)
    restoreEnvValue("SUPABASE_SERVICE_ROLE_KEY", previousSupabaseServiceRoleKey)
    restoreEnvValue("SESSION_SIGNING_SECRET", previousSessionSigningSecret)
  }
})

test("backend environment treats configured non-local app URLs as hosted even without NODE_ENV", () => {
  const env = {
    NUXT_PUBLIC_APP_URL: "https://cofoundry.example",
    NUXT_PUBLIC_ENABLE_DEMO_ACCESS: "true",
  }

  const publicEnvironment = readPublicEnvironment(env)
  const secretEnvironment = readSecretEnvironment(env)
  const errors = collectEnvironmentValidationErrors(env)

  assert.equal(isLocalDevelopmentEnvironment(env), false)
  assert.equal(publicEnvironment.appUrl, "https://cofoundry.example")
  assert.equal(publicEnvironment.enableDemoAccess, true)
  assert.equal(secretEnvironment.sessionSigningSecret, "")
  assert.ok(errors.includes("SESSION_SIGNING_SECRET is required whenever account sessions are enabled in a non-local environment."))
})

test("backend environment keeps explicit localhost app URLs in local development mode", () => {
  const env = {
    NUXT_PUBLIC_APP_URL: "http://127.0.0.1:3000",
    NUXT_PUBLIC_ENABLE_DEMO_ACCESS: "true",
  }

  const errors = collectEnvironmentValidationErrors(env)

  assert.equal(isLocalDevelopmentEnvironment(env), true)
  assert.equal(readPublicEnvironment(env).appUrl, "http://127.0.0.1:3000")
  assert.equal(errors.includes("SESSION_SIGNING_SECRET is required whenever account sessions are enabled in a non-local environment."), false)
})

test("backend environment reads safe deployment metadata from deploy env", () => {
  assert.deepEqual(readDeploymentMetadata({
    BUILD_TIMESTAMP: "2026-06-12T11:55:00.000Z",
    RELEASE_VERSION: "v1.1.78",
    SOURCE_VERSION: "dcb599f5b5f1a72e5d78b4e0f19f3c9b5e1a1234",
  }), {
    commitSha: "dcb599f5b5f1a72e5d78b4e0f19f3c9b5e1a1234",
    deployedAt: "2026-06-12T11:55:00.000Z",
    release: "v1.1.78",
  })
})

test("unknown routes return a 404 payload", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/missing`)
    const body = await response.json()

    assert.equal(response.status, 404)
    assert.equal(body.error, "Not found")
  })
})

test("server creation fails fast when non-mock modes are misconfigured", () => {
  const previousBackendMode = process.env.NUXT_PUBLIC_BACKEND_MODE
  const previousSupabaseUrl = process.env.NUXT_PUBLIC_SUPABASE_URL
  const previousSupabaseAnonKey = process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY
  const previousSupabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  process.env.NUXT_PUBLIC_BACKEND_MODE = "supabase"
  delete process.env.NUXT_PUBLIC_SUPABASE_URL
  delete process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY
  delete process.env.SUPABASE_SERVICE_ROLE_KEY

  try {
    assert.throws(
      () => createBackendServer(),
      /SUPABASE_SERVICE_ROLE_KEY is required when NUXT_PUBLIC_BACKEND_MODE="supabase"\./,
    )
  }
  finally {
    restoreEnvValue("NUXT_PUBLIC_BACKEND_MODE", previousBackendMode)
    restoreEnvValue("NUXT_PUBLIC_SUPABASE_URL", previousSupabaseUrl)
    restoreEnvValue("NUXT_PUBLIC_SUPABASE_ANON_KEY", previousSupabaseAnonKey)
    restoreEnvValue("SUPABASE_SERVICE_ROLE_KEY", previousSupabaseServiceRoleKey)
  }
})

test("bootstrap admin input normalizes email and defaults to admin", () => {
  const input = resolveBootstrapAdminInput({
    BOOTSTRAP_ADMIN_EMAIL: " Ava@CoFoundry.dev ",
  })

  assert.deepEqual(input, {
    email: "ava@cofoundry.dev",
    notes: "Initial production admin bootstrap.",
    role: "admin",
    userId: "",
  })
})

test("bootstrap admin input rejects missing targets and unsupported roles", () => {
  assert.throws(
    () => resolveBootstrapAdminInput({}),
    /Set BOOTSTRAP_ADMIN_EMAIL or BOOTSTRAP_ADMIN_USER_ID/,
  )

  assert.throws(
    () => resolveBootstrapAdminInput({
      BOOTSTRAP_ADMIN_EMAIL: "operator@cofoundry.dev",
      BOOTSTRAP_ADMIN_ROLE: "founder",
    }),
    /BOOTSTRAP_ADMIN_ROLE must be one of: admin, investor_admin\./,
  )
})

test("bootstrap admin environment requires Supabase mode", () => {
  assert.throws(
    () => resolveBootstrapAdminEnvironment({
      NUXT_PUBLIC_BACKEND_MODE: "mock",
    }),
    /NUXT_PUBLIC_BACKEND_MODE must be "supabase"/,
  )
})
