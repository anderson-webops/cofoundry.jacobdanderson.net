import { describe, expect, it } from "vitest"
import { buildHealthPayload, buildProbePayload, determineReadiness } from "../../server/utils/health"
import { readPublicEnvironment } from "../../shared/utils/environment"

describe("health payload", () => {
  it("publishes safe liveness metadata without secrets", () => {
    const payload = buildHealthPayload({
      deploymentMetadata: {
        commitSha: "dcb599f5b5f1a72e5d78b4e0f19f3c9b5e1a1234",
        deployedAt: "2026-06-12T11:55:00.000Z",
        release: "v1.1.78",
      },
      generatedAt: "2026-06-12T12:00:00.000Z",
      publicEnvironment: readPublicEnvironment({
        NODE_ENV: "production",
        NUXT_PUBLIC_APP_URL: "https://cofoundry.example",
        NUXT_PUBLIC_BACKEND_MODE: "mock",
        NUXT_PUBLIC_BILLING_MODE: "mock",
      }),
    })

    expect(payload).toEqual({
      deployment: {
        commitSha: "dcb599f5b5f1a72e5d78b4e0f19f3c9b5e1a1234",
        deployedAt: "2026-06-12T11:55:00.000Z",
        release: "v1.1.78",
      },
      generatedAt: "2026-06-12T12:00:00.000Z",
      modes: {
        backend: "mock",
        billing: "mock",
      },
      publicAppUrlConfigured: true,
      service: "cofoundry-front-end",
      status: "ok",
    })
    expect(JSON.stringify(payload)).not.toContain("SECRET")
    expect(JSON.stringify(payload)).not.toContain("KEY")
  })

  it("keeps standard monitoring payloads minimal and fails readiness closed", async () => {
    expect(buildProbePayload(true)).toEqual({ ok: true })
    expect(buildProbePayload(false)).toEqual({ ok: false })
    expect(await determineReadiness("mock", () => {
      throw new Error("must not run")
    })).toBe(true)
    expect(await determineReadiness("supabase", () => true)).toBe(true)
    expect(await determineReadiness("supabase", () => false)).toBe(false)
    expect(await determineReadiness("supabase", () => {
      throw new Error("postgresql://operator:secret@internal-host/private-db")
    })).toBe(false)
  })
})
