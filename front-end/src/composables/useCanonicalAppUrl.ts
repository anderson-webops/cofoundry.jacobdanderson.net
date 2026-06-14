import { isLocalSiteUrl, normalizeSiteUrl } from "~/shared/utils/seo"

export function useCanonicalAppUrl() {
  const runtimeConfig = useRuntimeConfig()
  const configuredAppUrl = normalizeSiteUrl(runtimeConfig.public.appUrl)
  if (configuredAppUrl && !isLocalSiteUrl(configuredAppUrl))
    return configuredAppUrl

  const requestUrl = useRequestURL()
  const requestOrigin = normalizeSiteUrl(requestUrl.origin)
  if (requestOrigin && !isLocalSiteUrl(requestOrigin))
    return requestOrigin

  return configuredAppUrl
}
