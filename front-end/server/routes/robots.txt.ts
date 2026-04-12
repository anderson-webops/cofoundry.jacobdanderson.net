import { resolveServerAppUrl } from "../utils/app-url"

export default defineEventHandler((event) => {
  const appUrl = resolveServerAppUrl(event)
  const disallows = ["/admin", "/app", "/auth", "/api", "/onboarding"]
  const allowWithDisallows = (userAgent: string) => [
    `User-agent: ${userAgent}`,
    "Allow: /",
    ...disallows.map(path => `Disallow: ${path}`),
    "",
  ]

  setHeader(event, "content-type", "text/plain; charset=utf-8")

  return [
    "User-agent: GPTBot",
    "Disallow: /",
    "",
    "User-agent: ClaudeBot",
    "Disallow: /",
    "",
    "User-agent: Google-Extended",
    "Disallow: /",
    "",
    ...allowWithDisallows("Googlebot"),
    ...allowWithDisallows("Bingbot"),
    ...allowWithDisallows("OAI-SearchBot"),
    ...allowWithDisallows("PerplexityBot"),
    ...allowWithDisallows("Perplexity-User"),
    ...allowWithDisallows("Claude-SearchBot"),
    ...allowWithDisallows("Claude-User"),
    ...allowWithDisallows("*"),
    `Sitemap: ${appUrl}/sitemap.xml`,
  ].join("\n")
})
