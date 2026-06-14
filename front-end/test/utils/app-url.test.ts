import { describe, expect, it } from "vitest"
import { resolveServerAppUrlFromParts } from "../../server/utils/app-url"

describe("server app URL resolution", () => {
  it("keeps a configured production origin authoritative", () => {
    expect(resolveServerAppUrlFromParts({
      configuredAppUrl: "https://cofoundry.example/",
      forwardedHost: "preview.example",
      forwardedProto: "https",
      host: "preview.example",
      requestOrigin: "https://preview.example",
    })).toBe("https://cofoundry.example")
  })

  it("uses forwarded production origin when configured URL is local", () => {
    expect(resolveServerAppUrlFromParts({
      configuredAppUrl: "http://localhost:3000",
      forwardedHost: "cofoundry.example",
      forwardedProto: "https",
      host: "127.0.0.1:3000",
      requestOrigin: "http://127.0.0.1:3000",
    })).toBe("https://cofoundry.example")
  })

  it("keeps local configured URL for local requests", () => {
    expect(resolveServerAppUrlFromParts({
      configuredAppUrl: "http://localhost:3000/",
      host: "localhost:3000",
      requestOrigin: "http://localhost:3000",
    })).toBe("http://localhost:3000")
  })

  it("falls back to host headers when no configured URL exists", () => {
    expect(resolveServerAppUrlFromParts({
      configuredAppUrl: "",
      forwardedHost: "cofoundry.example",
      forwardedProto: "https",
      host: "localhost:3000",
      requestOrigin: "http://localhost:3000",
    })).toBe("https://cofoundry.example")
  })

  it("uses the production fallback when production only sees a local origin", () => {
    expect(resolveServerAppUrlFromParts({
      configuredAppUrl: "",
      host: "localhost:3000",
      nodeEnv: "production",
      requestOrigin: "http://localhost:3000",
    })).toBe("https://cofoundry.jacobdanderson.net")
  })

  it("uses the production fallback when production is explicitly misconfigured to localhost", () => {
    expect(resolveServerAppUrlFromParts({
      configuredAppUrl: "http://localhost",
      host: "localhost",
      nodeEnv: "production",
      requestOrigin: "http://localhost",
    })).toBe("https://cofoundry.jacobdanderson.net")
  })

  it("allows local public URLs for explicit local production smoke tests", () => {
    expect(resolveServerAppUrlFromParts({
      allowLocalAppUrl: true,
      configuredAppUrl: "http://127.0.0.1:3401",
      host: "127.0.0.1:3401",
      nodeEnv: "production",
      requestOrigin: "http://127.0.0.1:3401",
    })).toBe("http://127.0.0.1:3401")
  })
})
