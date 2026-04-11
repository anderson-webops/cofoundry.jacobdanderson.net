import { appDescription, appName } from "~/shared/constants/app"

const trailingSlashPattern = /\/+$/

interface PageSeoOptions {
  canonicalPath?: string
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
  const fullTitle = `${title} · ${appName}`
  const canonicalUrl = buildCanonicalUrl(options.canonicalPath)

  useSeoMeta({
    title,
    description,
    ogTitle: fullTitle,
    ogDescription: description,
    ogUrl: canonicalUrl,
    robots: options.robots,
    twitterCard: "summary_large_image",
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
    script: (Array.isArray(options.structuredData) ? options.structuredData : options.structuredData ? [options.structuredData] : [])
      .map((entry, index) => ({
        key: `structured-data-${index}`,
        type: "application/ld+json",
        children: JSON.stringify(entry),
      })),
  })
}
