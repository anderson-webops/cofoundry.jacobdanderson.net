import type { H3Event } from "h3"
import { afterEach, describe, expect, it, vi } from "vitest"
import { buildHealthPayload, buildProbePayload, determineReadiness, resolveFrontendReadiness } from "../../server/utils/health"
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

describe("frontend readiness database boundary", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it("coalesces public probes and avoids an exact users-table count", async () => {
    vi.stubEnv("NUXT_PUBLIC_BACKEND_MODE", "supabase")
    vi.stubEnv("NUXT_PUBLIC_SUPABASE_URL", "https://database.example")
    vi.stubGlobal("useRuntimeConfig", () => ({
      public: { backendMode: "supabase", supabaseUrl: "https://database.example" },
      supabaseServiceRoleKey: "synthetic-test-role-key",
    }))
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(null, { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    const event = {} as H3Event
    expect(await Promise.all(Array.from({ length: 4 }, () => resolveFrontendReadiness(event)))).toEqual([true, true, true, true])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const request = new Request(...fetchMock.mock.calls[0]!)
    expect(request.method).toBe("HEAD")
    expect(request.url).toContain("limit=1")
    expect(request.headers.get("prefer") ?? "").not.toContain("count=exact")
    expect(await resolveFrontendReadiness(event)).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("caches failed probes briefly and retries after the interval", async () => {
    vi.spyOn(Date, "now").mockReturnValue(100_000)
    vi.stubEnv("NUXT_PUBLIC_BACKEND_MODE", "supabase")
    vi.stubEnv("NUXT_PUBLIC_SUPABASE_URL", "https://recovery.example")
    vi.stubGlobal("useRuntimeConfig", () => ({
      public: { backendMode: "supabase", supabaseUrl: "https://recovery.example" },
      supabaseServiceRoleKey: "synthetic-test-role-key",
    }))
    const fetchMock = vi.fn(async () => new Response(null, { status: 401 }))
    vi.stubGlobal("fetch", fetchMock)
    const event = {} as H3Event

    expect(await resolveFrontendReadiness(event)).toBe(false)
    expect(await resolveFrontendReadiness(event)).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    vi.mocked(Date.now).mockReturnValue(101_001)
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }))
    expect(await resolveFrontendReadiness(event)).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("uses the runtime mode and never retries a failed public probe", async () => {
    vi.stubEnv("NUXT_PUBLIC_BACKEND_MODE", "mock")
    vi.stubGlobal("useRuntimeConfig", () => ({
      public: { backendMode: "supabase", supabaseUrl: "https://runtime.example" },
      supabaseServiceRoleKey: "synthetic-test-role-key",
    }))
    const fetchMock = vi.fn(async () => new Response(null, {
      status: 503,
      headers: { "Retry-After": "0" },
    }))
    vi.stubGlobal("fetch", fetchMock)

    expect(await resolveFrontendReadiness({} as H3Event)).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("fails closed when a shared dependency probe times out", async () => {
    vi.useFakeTimers()
    vi.stubEnv("NUXT_PUBLIC_BACKEND_MODE", "supabase")
    vi.stubEnv("NUXT_PUBLIC_SUPABASE_URL", "https://timeout.example")
    vi.stubGlobal("useRuntimeConfig", () => ({
      public: { backendMode: "supabase", supabaseUrl: "https://timeout.example" },
      supabaseServiceRoleKey: "synthetic-test-role-key",
    }))
    const fetchMock = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) => new Promise<Response>(() => {}))
    vi.stubGlobal("fetch", fetchMock)
    const event = {} as H3Event

    const results = Promise.all([resolveFrontendReadiness(event), resolveFrontendReadiness(event)])
    await vi.advanceTimersByTimeAsync(2000)
    expect(await results).toEqual([false, false])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("does not query Supabase in mock mode", async () => {
    vi.stubEnv("NUXT_PUBLIC_BACKEND_MODE", "mock")
    vi.stubGlobal("useRuntimeConfig", () => ({
      public: { backendMode: "mock", supabaseUrl: "" },
    }))
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    expect(await resolveFrontendReadiness({} as H3Event)).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
