import type { AddressInfo } from "node:net"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { resolveBootstrapAdminEnvironment, resolveBootstrapAdminInput } from "../src/bootstrap-admin"
import { collectEnvironmentValidationErrors, isLocalDevelopmentEnvironment, isLoopbackBackendHost, readBackendDeploymentMetadata, readDeploymentMetadata, readPublicEnvironment, readSecretEnvironment, releaseTagFromPackageVersion } from "../src/environment"
import { createBackendServer, resolveBackendHost } from "../src/server"

function restoreEnvValue(key: string, value: string | undefined) {
  if (typeof value === "undefined")
    delete process.env[key]
  else
    process.env[key] = value
}

async function withServer(run: (_baseUrl: string) => Promise<void>) {
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
    assert.deepEqual(body.deployment, readBackendDeploymentMetadata(process.env))
    assert.equal(typeof body.now, "string")
    assert.equal(response.headers.get("cache-control"), "no-store")
    assert.equal(response.headers.get("x-content-type-options"), "nosniff")
  })
})

test("backend metadata allows only GET and HEAD", async () => {
  await withServer(async (baseUrl) => {
    const head = await fetch(`${baseUrl}/metadata`, { method: "HEAD" })
    const post = await fetch(`${baseUrl}/metadata`, { method: "POST" })

    assert.equal(head.status, 200)
    assert.equal(await head.text(), "")
    assert.equal(post.status, 405)
    assert.equal(post.headers.get("allow"), "GET, HEAD")
  })
})

test("backend metadata requires the configured operations token", async () => {
  const previousOperationsToken = process.env.COFOUNDRY_OPERATIONS_TOKEN
  process.env.COFOUNDRY_OPERATIONS_TOKEN = "metadata-test-token-at-least-32-characters"

  try {
    await withServer(async (baseUrl) => {
      const unauthorized = await fetch(`${baseUrl}/metadata`)
      const authorized = await fetch(`${baseUrl}/metadata`, {
        headers: {
          authorization: "Bearer metadata-test-token-at-least-32-characters",
        },
      })

      assert.equal(unauthorized.status, 401)
      assert.equal(unauthorized.headers.get("www-authenticate"), "Bearer")
      assert.equal(authorized.status, 200)
    })
  }
  finally {
    restoreEnvValue("COFOUNDRY_OPERATIONS_TOKEN", previousOperationsToken)
  }
})

test("backend binds to loopback unless a public bind is explicitly authorized", () => {
  assert.equal(isLoopbackBackendHost("LOCALHOST"), true)
  assert.equal(isLoopbackBackendHost("0.0.0.0"), false)
  assert.equal(resolveBackendHost({}), "127.0.0.1")
  assert.equal(resolveBackendHost({ BACKEND_HOST: "127.0.0.1" }), "127.0.0.1")
  assert.throws(
    () => resolveBackendHost({ BACKEND_HOST: "0.0.0.0" }),
    /Refusing a public backend bind/,
  )
  assert.throws(
    () => resolveBackendHost({ BACKEND_HOST: "192.0.2.10" }),
    /Refusing a public backend bind/,
  )
  assert.throws(
    () => resolveBackendHost({
      BACKEND_HOST: "0.0.0.0",
      COFOUNDRY_ALLOW_PUBLIC_BACKEND_BIND: "true",
    }),
    /without a distinct COFOUNDRY_OPERATIONS_TOKEN/,
  )
  assert.equal(
    resolveBackendHost({
      BACKEND_HOST: "0.0.0.0",
      COFOUNDRY_ALLOW_PUBLIC_BACKEND_BIND: "true",
      COFOUNDRY_OPERATIONS_TOKEN: "public-bind-token-value-at-least-32-chars",
    }),
    "0.0.0.0",
  )
})

test("environment validation rejects an explicitly authorized public bind without a strong operations token", () => {
  const errors = collectEnvironmentValidationErrors({
    BACKEND_HOST: "0.0.0.0",
    COFOUNDRY_ALLOW_PUBLIC_BACKEND_BIND: "true",
  })

  assert.ok(errors.some(error => error.includes("BACKEND_HOST uses a non-loopback address")))
})

test("environment validation rejects malformed public support addresses", () => {
  const errors = collectEnvironmentValidationErrors({
    NUXT_PUBLIC_SUPPORT_EMAIL: "security@cofoundry.dev\nPolicy: https://attacker.example",
  })

  assert.ok(errors.includes("NUXT_PUBLIC_SUPPORT_EMAIL must be a valid single email address."))
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
  const previousOperationsToken = process.env.COFOUNDRY_OPERATIONS_TOKEN
  const previousRelease = process.env.COFOUNDRY_RELEASE
  const previousCommitSha = process.env.COFOUNDRY_COMMIT_SHA
  const previousDeployedAt = process.env.COFOUNDRY_DEPLOYED_AT

  process.env.COFOUNDRY_COMMIT_SHA = "dcb599f5b5f1a72e5d78b4e0f19f3c9b5e1a1234"
  process.env.COFOUNDRY_DEPLOYED_AT = "2026-06-12T11:55:00.000Z"
  process.env.COFOUNDRY_RELEASE = "v1.1.78"
  process.env.NUXT_PUBLIC_BACKEND_MODE = "supabase"
  process.env.NUXT_PUBLIC_BILLING_MODE = "mock"
  process.env.NUXT_PUBLIC_ENABLE_DEMO_ACCESS = "false"
  process.env.NUXT_PUBLIC_APP_URL = "https://cofoundry.example"
  process.env.NUXT_PUBLIC_FEATURE_INVESTMENT_MODULE = "true"
  process.env.NUXT_PUBLIC_SUPPORT_EMAIL = "support@cofoundry.dev"
  process.env.NUXT_PUBLIC_SUPABASE_URL = "https://cofoundry.supabase.co"
  process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY = "public-anon-key"
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key"
  process.env.SESSION_SIGNING_SECRET = "a-long-random-session-signing-secret"
  process.env.COFOUNDRY_OPERATIONS_TOKEN = "a-distinct-operations-token-at-least-32"

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/metadata`, {
        headers: {
          authorization: "Bearer a-distinct-operations-token-at-least-32",
        },
      })
      const body = await response.json()

      assert.equal(response.status, 200)
      assert.equal(body.app, "CoFoundry")
      assert.equal(body.backendMode, "supabase")
      assert.equal(body.billingMode, "mock")
      assert.equal(body.demoAccessEnabled, false)
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
    restoreEnvValue("COFOUNDRY_OPERATIONS_TOKEN", previousOperationsToken)
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
  assert.ok(errors.includes("COFOUNDRY_OPERATIONS_TOKEN is required in a non-local environment."))
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

test("backend environment rejects unsafe production defaults", () => {
  const errors = collectEnvironmentValidationErrors({
    NODE_ENV: "production",
    NUXT_PUBLIC_APP_URL: "http://localhost:3000",
    NUXT_PUBLIC_ENABLE_DEMO_ACCESS: "true",
    SESSION_SIGNING_SECRET: "short",
  })

  assert.ok(errors.includes("NUXT_PUBLIC_APP_URL must not use a local origin in production."))
  assert.ok(errors.includes("NUXT_PUBLIC_APP_URL must use HTTPS in production."))
  assert.ok(errors.includes("NUXT_PUBLIC_ENABLE_DEMO_ACCESS must be false outside local development."))
  assert.ok(errors.includes("SESSION_SIGNING_SECRET must be at least 32 characters in a non-local environment."))
})

test("backend environment requires canonical origins and distinct deployment credentials", () => {
  const errors = collectEnvironmentValidationErrors({
    COFOUNDRY_OPERATIONS_TOKEN: "same-secret-value-at-least-32-characters",
    NODE_ENV: "production",
    NUXT_PUBLIC_APP_URL: "https://cofoundry.example/admin?from=host",
    NUXT_PUBLIC_BACKEND_MODE: "supabase",
    NUXT_PUBLIC_SUPABASE_ANON_KEY: "shared-supabase-key",
    NUXT_PUBLIC_SUPABASE_URL: "http://supabase.example/auth",
    SESSION_SIGNING_SECRET: "same-secret-value-at-least-32-characters",
    SUPABASE_SERVICE_ROLE_KEY: "shared-supabase-key",
  })

  assert.ok(errors.includes("NUXT_PUBLIC_APP_URL must be an origin without credentials, a path, query parameters, or a fragment."))
  assert.ok(errors.includes("NUXT_PUBLIC_SUPABASE_URL must be an origin without credentials, a path, query parameters, or a fragment."))
  assert.ok(errors.includes("NUXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY must be different credentials."))
  assert.ok(errors.includes("COFOUNDRY_OPERATIONS_TOKEN and SESSION_SIGNING_SECRET must be different secrets."))
})

test("backend environment rejects non-durable or ambiguous Stripe configuration", () => {
  const errors = collectEnvironmentValidationErrors({
    NUXT_PUBLIC_BACKEND_MODE: "mock",
    NUXT_PUBLIC_BILLING_MODE: "stripe",
    NUXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY: "price_shared",
    NUXT_PUBLIC_STRIPE_PRICE_TEAM_MONTHLY: "price_shared",
    NUXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "stripe-shared-credential",
    STRIPE_SECRET_KEY: "stripe-shared-credential",
    STRIPE_WEBHOOK_SECRET: "stripe-shared-credential",
  })

  assert.ok(errors.includes("NUXT_PUBLIC_BILLING_MODE=\"stripe\" requires NUXT_PUBLIC_BACKEND_MODE=\"supabase\" for durable subscription reconciliation."))
  assert.ok(errors.includes("The Stripe Pro and Team price IDs must be different."))
  assert.ok(errors.includes("Stripe publishable, secret, and webhook credentials must be different."))
})

test("backend environment requires a direct-proxy allowlist for forwarded headers", () => {
  const errors = collectEnvironmentValidationErrors({
    COFOUNDRY_TRUST_PROXY_HEADERS: "true",
  })

  assert.ok(errors.includes("COFOUNDRY_TRUSTED_PROXY_IPS is required when COFOUNDRY_TRUST_PROXY_HEADERS=true."))

  const broadProxyErrors = collectEnvironmentValidationErrors({
    COFOUNDRY_TRUSTED_PROXY_IPS: "0.0.0.0/0",
    COFOUNDRY_TRUST_PROXY_HEADERS: "true",
    NODE_ENV: "production",
    NUXT_PUBLIC_APP_URL: "https://cofoundry.example",
    NUXT_PUBLIC_BACKEND_MODE: "mock",
    NUXT_PUBLIC_BILLING_MODE: "mock",
    SESSION_SIGNING_SECRET: "a".repeat(32),
  })
  assert.ok(broadProxyErrors.includes("COFOUNDRY_TRUSTED_PROXY_IPS must contain only exact proxy host addresses (/32 or /128), not broad or malformed ranges."))
})

test("backend environment rejects multi-instance hosted operation until rate limits are shared", () => {
  const errors = collectEnvironmentValidationErrors({
    COFOUNDRY_APP_INSTANCE_COUNT: "2",
    COFOUNDRY_EXPECT_MULTI_INSTANCE: "true",
    NUXT_PUBLIC_APP_URL: "https://cofoundry.example",
    SESSION_SIGNING_SECRET: "a-secure-session-signing-secret-32",
  })

  assert.ok(errors.includes("Multi-instance production is unsupported until CoFoundry has a shared atomic rate limiter; run exactly one app process."))
})

test("backend environment keeps production fanout disabled and relay credentials isolated", () => {
  const errors = collectEnvironmentValidationErrors({
    COFOUNDRY_OPERATIONS_TOKEN: "operations-token-value-at-least-32-chars",
    COFOUNDRY_REALTIME_FANOUT_TOKEN: "operations-token-value-at-least-32-chars",
    COFOUNDRY_REALTIME_FANOUT_URL: "https://relay.example/events",
    NODE_ENV: "production",
    NUXT_PUBLIC_APP_URL: "https://cofoundry.example",
    SESSION_SIGNING_SECRET: "a-distinct-session-signing-secret-value",
  })

  assert.ok(errors.includes("COFOUNDRY_REALTIME_FANOUT_URL must be unset in production until shared rate limiting is implemented."))
  assert.ok(errors.includes("COFOUNDRY_REALTIME_FANOUT_TOKEN must be different from operations and session secrets."))
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

test("backend deployment metadata falls back to package release without overriding env", () => {
  const packageVersion = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version
  const packageRelease = releaseTagFromPackageVersion(packageVersion)

  assert.equal(releaseTagFromPackageVersion("1.1.105"), "v1.1.105")
  assert.equal(releaseTagFromPackageVersion("local-release"), "")
  assert.deepEqual(readDeploymentMetadata({}, { release: "v1.1.105" }), {
    commitSha: "",
    deployedAt: "",
    release: "v1.1.105",
  })
  assert.equal(readBackendDeploymentMetadata({}).release, packageRelease)
  assert.equal(readBackendDeploymentMetadata({ COFOUNDRY_RELEASE: "v9.9.9" }).release, "v9.9.9")
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
    /BOOTSTRAP_ADMIN_ROLE must be one of: admin\./,
  )

  assert.throws(
    () => resolveBootstrapAdminInput({
      BOOTSTRAP_ADMIN_EMAIL: "operator@cofoundry.dev",
      BOOTSTRAP_ADMIN_ROLE: "investor_admin",
    }),
    /BOOTSTRAP_ADMIN_ROLE must be one of: admin\./,
  )

  assert.throws(
    () => resolveBootstrapAdminInput({
      BOOTSTRAP_ADMIN_EMAIL: "operator@cofoundry.dev",
      BOOTSTRAP_ADMIN_NOTES: "short",
    }),
    /BOOTSTRAP_ADMIN_NOTES must contain 8 to 1000 characters/,
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
