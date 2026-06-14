import { describe, expect, it } from "vitest"
import { appName } from "../../shared/constants/app"
import { buildFaqStructuredData, buildSiteStructuredData, buildSiteUrl, isLocalSiteUrl, isPublicSiteUrl, normalizeSiteUrl } from "../../shared/utils/seo"

describe("seo helpers", () => {
  it("normalizes configured site origins and builds absolute URLs", () => {
    expect(normalizeSiteUrl("https://cofoundry.example/")).toBe("https://cofoundry.example")
    expect(buildSiteUrl("https://cofoundry.example/base/", "/faq")).toBe("https://cofoundry.example/faq")
    expect(buildSiteUrl("", "/faq")).toBeNull()
    expect(buildSiteUrl("not a url", "/faq")).toBeNull()
  })

  it("classifies local and public production origins", () => {
    expect(isLocalSiteUrl("http://localhost:3000")).toBe(true)
    expect(isLocalSiteUrl("http://127.0.0.1:3000")).toBe(true)
    expect(isLocalSiteUrl("https://cofoundry.example")).toBe(false)
    expect(isPublicSiteUrl("https://cofoundry.example")).toBe(true)
    expect(isPublicSiteUrl("http://cofoundry.example")).toBe(false)
    expect(isPublicSiteUrl("http://localhost:3000")).toBe(false)
    expect(isPublicSiteUrl("")).toBe(false)
  })

  it("builds site structured data from the configured app URL", () => {
    const structuredData = buildSiteStructuredData("https://cofoundry.example/")

    expect(structuredData).toHaveLength(2)
    expect(structuredData[0]).toMatchObject({
      "@type": "Organization",
      "name": appName,
      "url": "https://cofoundry.example/",
    })
    expect(structuredData[1]).toMatchObject({
      "@type": "WebSite",
      "url": "https://cofoundry.example/",
    })
  })

  it("builds FAQ structured data and breadcrumb URLs from the configured app URL", () => {
    const structuredData = buildFaqStructuredData([
      {
        answer: "A structured way to form a startup team.",
        question: "What is CoFoundry?",
      },
    ], "https://cofoundry.example/")

    expect(structuredData[0]).toMatchObject({
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What is CoFoundry?",
        },
      ],
    })
    expect(structuredData[1]).toMatchObject({
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          item: "https://cofoundry.example/",
          name: "Home",
        },
        {
          item: "https://cofoundry.example/faq",
          name: "FAQ",
        },
      ],
    })
  })

  it("omits breadcrumb URLs when the app URL is not configured", () => {
    const structuredData = buildFaqStructuredData([
      {
        answer: "A structured way to form a startup team.",
        question: "What is CoFoundry?",
      },
    ], "")

    expect(structuredData).toHaveLength(1)
    expect(structuredData[0]).toMatchObject({
      "@type": "FAQPage",
    })
  })
})
