import { setHeader } from "h3"
import { resolveServerAppUrl } from "../../utils/app-url"
import { buildSecurityTxt } from "../../utils/security-txt"

const expirationDays = 180
const millisecondsPerDay = 24 * 60 * 60 * 1000

export default defineEventHandler((event) => {
  const runtimeConfig = useRuntimeConfig(event)
  const appUrl = resolveServerAppUrl(event)
  const expiresAt = new Date(Date.now() + expirationDays * millisecondsPerDay)

  setHeader(event, "content-type", "text/plain; charset=utf-8")

  return buildSecurityTxt({
    appUrl,
    expiresAt,
    supportEmail: runtimeConfig.public.supportEmail,
  })
})
