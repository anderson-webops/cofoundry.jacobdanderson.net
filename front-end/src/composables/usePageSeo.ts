import { appDescription, appName } from "~/shared/constants/app"

const trailingSlashPattern = /\/+$/

interface PageSeoOptions {
  canonicalPath?: string
  imagePath?: string
  ogType?: "article" | "profile" | "website"
  robots?: string
  structuredData?: Record<string, unknown> | Record<string, unknown>[]
}

function buildCanonicalUrl(path?: string) {
  if (!path)
    return undefined

  const runtimeConfig = useRuntimeConfig()
  const baseUrl = runtimeConfig.public.appUrl?.replace(trailingSlashPattern, "")

  if (!baseUrl)
    return undefined

  return new URL(path, `${baseUrl}/`).toString()
}

export function usePageSeo(title: string, description = appDescription, options: PageSeoOptions = {}) {
  const route = useRoute()
  const fullTitle = `${title} · ${appName}`
  const canonicalUrl = buildCanonicalUrl(options.canonicalPath || route.path)
  const ogImage = buildCanonicalUrl(options.imagePath || "/og-default.png")
  const pageStructuredData = canonicalUrl
    ? {
        "@context": "https://schema.org",
        "@type": options.ogType === "article" ? "Article" : "WebPage",
        "description": description,
        "headline": fullTitle,
        "isPartOf": {
          "@type": "WebSite",
          "name": appName,
          "url": buildCanonicalUrl("/") || canonicalUrl,
        },
        "name": fullTitle,
        "url": canonicalUrl,
      }
    : null
  const structuredEntries = [
    ...(pageStructuredData ? [pageStructuredData] : []),
    ...(Array.isArray(options.structuredData) ? options.structuredData : options.structuredData ? [options.structuredData] : []),
  ]

  useSeoMeta({
    title,
    description,
    ogTitle: fullTitle,
    ogDescription: description,
    ogImage,
    ogSiteName: appName,
    ogType: options.ogType || "website",
    ogUrl: canonicalUrl,
    robots: options.robots,
    twitterCard: "summary_large_image",
    twitterImage: ogImage,
    twitterTitle: fullTitle,
    twitterDescription: description,
  })

  useHead({
    link: canonicalUrl
      ? [
          {
            rel: "canonical",
            href: canonicalUrl,
          },
        ]
      : [],
    script: structuredEntries
      .map((entry, index) => ({
        key: `structured-data-${index}`,
        type: "application/ld+json",
        innerHTML: JSON.stringify(entry),
      })),
  })
}
