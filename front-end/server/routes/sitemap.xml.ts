import { defineEventHandler, setHeader } from "h3"
import { workspaceSeed } from "../../shared/data/seed"
import { getPublicRoutePaths } from "../../shared/utils/directory"
import { resolveServerAppUrl } from "../utils/app-url"

function xmlEscape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;")
}

export default defineEventHandler((event) => {
  const appUrl = resolveServerAppUrl(event)
  const routes = Array.from(new Set<string>(getPublicRoutePaths(workspaceSeed)))
  const body = routes
    .map((route) => {
      const url = new URL(route, `${appUrl}/`).toString()

      return `<url><loc>${xmlEscape(url)}</loc></url>`
    })
    .join("")

  setHeader(event, "content-type", "application/xml; charset=utf-8")

  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`
})
