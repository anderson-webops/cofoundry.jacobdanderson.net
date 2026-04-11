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
    label: "Investment workflow",
    route: "/app/investment",
    condition: "Shown only when NUXT_PUBLIC_FEATURE_INVESTMENT_MODULE=\"true\".",
  },
] as const
