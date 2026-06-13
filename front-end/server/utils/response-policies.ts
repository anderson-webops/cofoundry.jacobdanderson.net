import { isPrivateSurfacePath as routeIsPrivateSurfacePath } from "../../shared/constants/route-surfaces"

export const isPrivateSurfacePath = routeIsPrivateSurfacePath

export type ResponsePolicyHeaders = Record<string, string>

const noStoreHeaders: ResponsePolicyHeaders = {
  "Cache-Control": "no-store, max-age=0",
  "Pragma": "no-cache",
}

const noIndexHeaders: ResponsePolicyHeaders = {
  "X-Robots-Tag": "noindex, nofollow, noarchive",
}

export function buildResponsePolicyHeaders(pathname: string): ResponsePolicyHeaders {
  if (!routeIsPrivateSurfacePath(pathname))
    return {}

  return {
    ...noStoreHeaders,
    ...noIndexHeaders,
  }
}
