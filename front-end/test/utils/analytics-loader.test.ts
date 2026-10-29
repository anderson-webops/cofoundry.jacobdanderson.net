import { describe, expect, it } from "vitest"
import { ensureAnalyticsScript } from "../../src/utils/analytics-loader"

const source = "https://analytics.cofoundry.jacobdanderson.net/script.js"
const websiteId = "82564e10-5962-49df-8332-50e0c04c7485"

describe("analytics loader", () => {
  it("inserts the approved tracker as a dynamic script only once", () => {
    const head = document.createDocumentFragment()
    const isolatedDocument = {
      get scripts() {
        return head.querySelectorAll("script")
      },
      createElement: document.createElement.bind(document),
      head,
    } as unknown as Document
    ensureAnalyticsScript(isolatedDocument, source, websiteId)
    ensureAnalyticsScript(isolatedDocument, source, websiteId)

    const scripts = head.querySelectorAll(`script[src="${source}"]`)
    expect(scripts).toHaveLength(1)
    expect((scripts[0] as HTMLScriptElement).dataset.websiteId).toBe(websiteId)
    expect((scripts[0] as HTMLScriptElement).defer).toBe(true)
  })
})
