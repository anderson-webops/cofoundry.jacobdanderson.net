import { defineEventHandler, setHeader } from "h3"
import { buildRobotsTxt } from "../../shared/utils/robots"
import { resolveServerAppUrl } from "../utils/app-url"

export default defineEventHandler((event) => {
  const appUrl = resolveServerAppUrl(event)

  setHeader(event, "content-type", "text/plain; charset=utf-8")

  return buildRobotsTxt(appUrl)
})
