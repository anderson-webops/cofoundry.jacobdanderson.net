import { describe, expect, it } from "vitest"
import { buildHealthPayload } from "../../server/utils/health"
import { readPublicEnvironment } from "../../shared/utils/environment"

describe("health payload", () => {
  it("publishes safe liveness metadata without secrets", () => {
    const payload = buildHealthPayload({
      generatedAt: "2026-06-12T12:00:00.000Z",
      publicEnvironment: readPublicEnvironment({
        NODE_ENV: "production",
        NUXT_PUBLIC_APP_URL: "https://cofoundry.example",
        NUXT_PUBLIC_BACKEND_MODE: "mock",
        NUXT_PUBLIC_BILLING_MODE: "mock",
      }),
    })

    expect(payload).toEqual({
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
})
