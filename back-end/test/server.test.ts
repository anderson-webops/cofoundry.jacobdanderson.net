import type { AddressInfo } from "node:net"
import assert from "node:assert/strict"
import test from "node:test"
import { createBackendServer } from "../src/server"

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

  process.env.NUXT_PUBLIC_BACKEND_MODE = "supabase"
  process.env.NUXT_PUBLIC_BILLING_MODE = "mock"
  process.env.NUXT_PUBLIC_FEATURE_INVESTMENT_MODULE = "true"
  process.env.NUXT_PUBLIC_SUPPORT_EMAIL = "support@cofoundry.dev"

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
    process.env.NUXT_PUBLIC_BACKEND_MODE = previousBackendMode
    process.env.NUXT_PUBLIC_BILLING_MODE = previousBillingMode
    process.env.NUXT_PUBLIC_FEATURE_INVESTMENT_MODULE = previousInvestment
    process.env.NUXT_PUBLIC_SUPPORT_EMAIL = previousSupportEmail
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
