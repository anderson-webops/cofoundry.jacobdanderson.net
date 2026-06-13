import { privateWorkspaceRoutePrefixes } from "../../shared/constants/route-surfaces"

export type ResponsePolicyHeaders = Record<string, string>

const noStoreHeaders: ResponsePolicyHeaders = {
  "Cache-Control": "no-store, max-age=0",
  "Pragma": "no-cache",
}

const noIndexHeaders: ResponsePolicyHeaders = {
  "X-Robots-Tag": "noindex, nofollow, noarchive",
}

const privateApiPrefixes = [
  "/api/account",
  "/api/admin",
  "/api/auth",
  "/api/billing",
  "/api/files",
  "/api/inbox",
  "/api/notifications",
  "/api/operations",
  "/api/relationships",
  "/api/workspace",
] as const

function normalizePathname(pathname: string) {
  if (!pathname || pathname === "/")
    return "/"

  return pathname.replace(/\/+$/, "") || "/"
}

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export function isPrivateSurfacePath(pathname: string) {
  const normalizedPathname = normalizePathname(pathname)

  return privateWorkspaceRoutePrefixes.some(prefix => matchesPrefix(normalizedPathname, prefix))
    || privateApiPrefixes.some(prefix => matchesPrefix(normalizedPathname, prefix))
}

export function buildResponsePolicyHeaders(pathname: string): ResponsePolicyHeaders {
  if (!isPrivateSurfacePath(pathname))
    return {}

  return {
    ...noStoreHeaders,
    ...noIndexHeaders,
  }
}
