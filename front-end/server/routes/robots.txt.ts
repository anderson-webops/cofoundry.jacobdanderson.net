import { resolveServerAppUrl } from "../utils/app-url"

export default defineEventHandler((event) => {
  const appUrl = resolveServerAppUrl(event)

  setHeader(event, "content-type", "text/plain; charset=utf-8")

  return [
    "User-agent: *",
    "Allow: /",
    `Sitemap: ${appUrl}/sitemap.xml`,
  ].join("\n")
})
