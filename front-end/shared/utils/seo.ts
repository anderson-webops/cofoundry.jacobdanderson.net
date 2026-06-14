import { appDescription, appName } from "../constants/app"

const trailingSlashPattern = /\/+$/
const localSiteHostnames = new Set(["localhost", "127.0.0.1", "::1"])

export interface FaqStructuredDataItem {
  answer: string
  question: string
}

export function normalizeSiteUrl(appUrl?: string | null) {
  const trimmed = appUrl?.trim().replace(trailingSlashPattern, "")
  if (!trimmed)
    return null

  try {
    return new URL(trimmed).toString().replace(trailingSlashPattern, "")
  }
  catch {
    return null
  }
}

export function isLocalSiteUrl(appUrl?: string | null) {
  const siteUrl = normalizeSiteUrl(appUrl)
  if (!siteUrl)
    return false

  return localSiteHostnames.has(new URL(siteUrl).hostname)
}

export function isPublicSiteUrl(appUrl?: string | null) {
  const siteUrl = normalizeSiteUrl(appUrl)
  if (!siteUrl)
    return false

  const url = new URL(siteUrl)
  return url.protocol === "https:" && !localSiteHostnames.has(url.hostname)
}

export function buildSiteUrl(appUrl: string | null | undefined, path = "/") {
  const siteUrl = normalizeSiteUrl(appUrl)
  if (!siteUrl)
    return null

  return new URL(path || "/", `${siteUrl}/`).toString()
}

export function buildSiteStructuredData(appUrl: string | null | undefined) {
  const siteUrl = buildSiteUrl(appUrl, "/")
  if (!siteUrl)
    return []

  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "description": appDescription,
      "name": appName,
      "url": siteUrl,
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "description": appDescription,
      "name": appName,
      "url": siteUrl,
    },
  ]
}

export function buildFaqStructuredData(items: FaqStructuredDataItem[], appUrl: string | null | undefined) {
  const homeUrl = buildSiteUrl(appUrl, "/")
  const faqUrl = buildSiteUrl(appUrl, "/faq")
  const faqPage = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": items.map(item => ({
      "@type": "Question",
      "name": item.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": item.answer,
      },
    })),
  }

  if (!homeUrl || !faqUrl)
    return [faqPage]

  return [
    faqPage,
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": homeUrl,
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "FAQ",
          "item": faqUrl,
        },
      ],
    },
  ]
}
