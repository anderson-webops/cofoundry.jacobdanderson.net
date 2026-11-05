import { describe, expect, it } from "vitest"
import { ensureAnalyticsScript } from "../../src/utils/analytics-loader"

const source = "https://analytics.cofoundry.jacobdanderson.net/script.js"
const websiteId = "82564e10-5962-49df-8332-50e0c04c7485"

describe("analytics loader", () => {
  it("inserts the approved tracker as a dynamic script only once", () => {
    const isolatedDocument = document.implementation.createHTMLDocument()
    const head = isolatedDocument.head
    head.remove()
    Object.defineProperty(isolatedDocument, "head", { value: head })
    Object.defineProperty(isolatedDocument, "scripts", {
      get: () => head.getElementsByTagName("script"),
    })
    expect(head.isConnected).toBe(false)
    ensureAnalyticsScript(isolatedDocument, source, websiteId)
    ensureAnalyticsScript(isolatedDocument, source, websiteId)

    const scripts = head.querySelectorAll(`script[src="${source}"]`)
    expect(scripts).toHaveLength(1)
    const script = head.querySelector<HTMLScriptElement>(`script[src="${source}"]`)
    expect(script?.dataset.websiteId).toBe(websiteId)
    expect(script?.defer).toBe(true)
  })
})
