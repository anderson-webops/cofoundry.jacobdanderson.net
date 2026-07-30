import { getCookie, getHeader, getMethod, getRequestURL } from "h3"
import { sessionCookieName } from "../../shared/utils/session"
import { resolveServerAppUrl } from "../utils/app-url"
import { getRequestIntegrityFailure } from "../utils/request-integrity"

export default defineEventHandler((event) => {
  const failure = getRequestIntegrityFailure({
    canonicalOrigin: resolveServerAppUrl(event),
    contentLength: getHeader(event, "content-length"),
    hasSessionCookie: Boolean(getCookie(event, sessionCookieName)),
    method: getMethod(event),
    origin: getHeader(event, "origin"),
    pathname: getRequestURL(event).pathname,
    referer: getHeader(event, "referer"),
    secFetchSite: getHeader(event, "sec-fetch-site"),
    transferEncoding: getHeader(event, "transfer-encoding"),
  })

  if (failure)
    throw createError(failure)
})
