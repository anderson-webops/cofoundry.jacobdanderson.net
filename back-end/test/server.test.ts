import type { AddressInfo } from "node:net"
import assert from "node:assert/strict"
import test from "node:test"
import { resolveBootstrapAdminEnvironment, resolveBootstrapAdminInput } from "../src/bootstrap-admin"
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
    assert.equal(typeof body.now, "string")
  })
})

test("metadata endpoint reflects env-driven flags", async () => {
  const previousBackendMode = process.env.NUXT_PUBLIC_BACKEND_MODE
  const previousBillingMode = process.env.NUXT_PUBLIC_BILLING_MODE
  const previousInvestment = process.env.NUXT_PUBLIC_FEATURE_INVESTMENT_MODULE
  const previousSupportEmail = process.env.NUXT_PUBLIC_SUPPORT_EMAIL
  const previousSupabaseUrl = process.env.NUXT_PUBLIC_SUPABASE_URL
  const previousSupabaseAnonKey = process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY
  const previousSupabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  process.env.NUXT_PUBLIC_BACKEND_MODE = "supabase"
  process.env.NUXT_PUBLIC_BILLING_MODE = "mock"
  process.env.NUXT_PUBLIC_FEATURE_INVESTMENT_MODULE = "true"
  process.env.NUXT_PUBLIC_SUPPORT_EMAIL = "support@cofoundry.dev"
  process.env.NUXT_PUBLIC_SUPABASE_URL = "https://cofoundry.supabase.co"
  process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY = "public-anon-key"
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key"

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/metadata`)
      const body = await response.json()

      assert.equal(response.status, 200)
      assert.equal(body.app, "CoFoundry")
      assert.equal(body.backendMode, "supabase")
      assert.equal(body.billingMode, "mock")
      assert.equal(body.investmentModuleEnabled, true)
      assert.equal(body.supportEmail, "support@cofoundry.dev")
    })
  }
  finally {
    restoreEnvValue("NUXT_PUBLIC_BACKEND_MODE", previousBackendMode)
    restoreEnvValue("NUXT_PUBLIC_BILLING_MODE", previousBillingMode)
    restoreEnvValue("NUXT_PUBLIC_FEATURE_INVESTMENT_MODULE", previousInvestment)
    restoreEnvValue("NUXT_PUBLIC_SUPPORT_EMAIL", previousSupportEmail)
    restoreEnvValue("NUXT_PUBLIC_SUPABASE_URL", previousSupabaseUrl)
    restoreEnvValue("NUXT_PUBLIC_SUPABASE_ANON_KEY", previousSupabaseAnonKey)
    restoreEnvValue("SUPABASE_SERVICE_ROLE_KEY", previousSupabaseServiceRoleKey)
  }
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
