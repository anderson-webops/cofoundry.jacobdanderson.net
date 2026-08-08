export const publicMarketingRoutes = [
  "/",
  "/find-cofounder",
  "/how-it-works",
  "/pricing",
  "/faq",
  "/safety",
  "/terms",
  "/privacy",
  "/contact",
  "/trust",
  "/contracts",
  "/people",
  "/roles",
  "/industries",
  "/stage",
  "/startups",
] as const

export const privateWorkspaceRoutePrefixes = [
  "/auth",
  "/onboarding",
  "/app",
  "/admin",
  "/email",
  "/legal-review",
] as const

export const privateApiRoutePrefixes = [
  "/api/access-requests",
  "/api/account",
  "/api/admin",
  "/api/auth",
  "/api/billing",
  "/api/contracts",
  "/api/files",
  "/api/inbox",
  "/api/investment-applications",
  "/api/legal-reviews",
  "/api/notifications",
  "/api/operations",
  "/api/relationships",
  "/api/reports",
  "/api/workspace",
] as const

export const environmentGatedSurfaces = [
  {
    label: "Review account helpers",
    route: "/auth/sign-in",
    condition: "Shown only for local development or when NUXT_PUBLIC_ENABLE_DEMO_ACCESS=\"true\".",
  },
  {
    label: "Development workspace reset controls",
    route: "/app/settings",
    condition: "Shown only for local development or when NUXT_PUBLIC_ENABLE_DEMO_ACCESS=\"true\".",
  },
  {
    label: "Investment module",
    route: "/app/investment",
    condition: "Shown only when NUXT_PUBLIC_FEATURE_INVESTMENT_MODULE=\"true\".",
  },
] as const

export function normalizeRoutePath(pathname: string) {
  if (!pathname || pathname === "/")
    return "/"

  return pathname.replace(/\/+$/, "") || "/"
}

export function matchesRoutePrefix(pathname: string, prefix: string) {
  const normalizedPathname = normalizeRoutePath(pathname)
  const normalizedPrefix = normalizeRoutePath(prefix)

  return normalizedPathname === normalizedPrefix || normalizedPathname.startsWith(`${normalizedPrefix}/`)
}

export function isPrivateWorkspaceRoutePath(pathname: string) {
  return privateWorkspaceRoutePrefixes.some(prefix => matchesRoutePrefix(pathname, prefix))
}

export function isPrivateApiRoutePath(pathname: string) {
  return privateApiRoutePrefixes.some(prefix => matchesRoutePrefix(pathname, prefix))
}

export function isPrivateSurfacePath(pathname: string) {
  return isPrivateWorkspaceRoutePath(pathname) || isPrivateApiRoutePath(pathname)
}
