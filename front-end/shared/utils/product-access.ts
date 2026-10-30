import type { BackendMode, BillingMode } from "./environment"

export interface ProductAccessEnvironment {
  backendMode: BackendMode
  billingMode: BillingMode
  enableDemoAccess: boolean
}

export interface ProductAccessPolicy {
  accountsEnabled: boolean
  marketingShellOnly: boolean
  mockBillingPreviewEnabled: boolean
  operatorManagedBilling: boolean
  selfServeBillingEnabled: boolean
  showDemoConveniences: boolean
  signInEnabled: boolean
}

export interface ProductCta {
  label: string
  to: string
}

function buildQueryPath(path: string, query: Record<string, string | undefined>) {
  const searchParams = new URLSearchParams()

  Object.entries(query).forEach(([key, value]) => {
    if (value)
      searchParams.set(key, value)
  })

  const queryString = searchParams.toString()
  return queryString
    ? `${path}?${queryString}`
    : path
}

export function resolveProductAccessPolicy(environment: ProductAccessEnvironment, isLocalDevelopment: boolean): ProductAccessPolicy {
  const showDemoConveniences = environment.backendMode === "mock" && isLocalDevelopment
  const accountsEnabled = environment.backendMode === "supabase" || showDemoConveniences
  const mockBillingPreviewEnabled = accountsEnabled && environment.billingMode === "mock" && isLocalDevelopment
  const selfServeBillingEnabled = accountsEnabled && environment.billingMode === "stripe"

  return {
    accountsEnabled,
    marketingShellOnly: !accountsEnabled,
    mockBillingPreviewEnabled,
    operatorManagedBilling: accountsEnabled && environment.billingMode !== "stripe" && !mockBillingPreviewEnabled,
    selfServeBillingEnabled,
    showDemoConveniences,
    signInEnabled: true,
  }
}

export function areSeededReviewCredentialsEnabled(environment: ProductAccessEnvironment, isLocalDevelopment: boolean) {
  return resolveProductAccessPolicy(environment, isLocalDevelopment).showDemoConveniences
}

export function buildAccessRequestPath(source = "site", topic = "access") {
  if (topic === "access")
    return buildQueryPath("/auth/sign-up", { source })

  return buildQueryPath("/contact", { source, topic })
}

export function getPrimaryAccessCta(policy: ProductAccessPolicy, source = "site"): ProductCta {
  if (policy.accountsEnabled)
    return { label: "Create account", to: "/auth/sign-up" }

  return {
    label: "Request access",
    to: buildAccessRequestPath(source, "access"),
  }
}

export function getSecondaryAccessCta(_policy: ProductAccessPolicy, _source = "site"): ProductCta {
  return { label: "Sign in", to: "/auth/sign-in" }
}

export function getIntroCta(policy: ProductAccessPolicy, source = "intro"): ProductCta {
  if (policy.accountsEnabled)
    return { label: "Request intro on CoFoundry", to: "/auth/sign-up" }

  return {
    label: "Request access to send an intro",
    to: buildAccessRequestPath(source, "intro"),
  }
}

export function getPricingTierCta(policy: ProductAccessPolicy, tierId: "free" | "pro" | "team", source = "pricing"): ProductCta {
  if (tierId === "free") {
    return policy.accountsEnabled
      ? { label: "Start free", to: "/auth/sign-up" }
      : {
          label: "Request access",
          to: buildAccessRequestPath(source, "access")
        }
  }

  if (tierId === "team") {
    return {
      label: "Talk to the team",
      to: buildAccessRequestPath(source, "pricing")
    }
  }

  if (policy.selfServeBillingEnabled)
    return { label: "Upgrade to Pro", to: "/auth/sign-up" }

  return {
    label: "Talk to the team",
    to: buildAccessRequestPath(source, "pricing"),
  }
}

export function getGuidePageCta(policy: ProductAccessPolicy, ctaLabel: string, ctaTo: string, source = "resource"): ProductCta {
  if (ctaTo.startsWith("/auth/")) {
    if (ctaTo === "/auth/sign-in")
      return { label: "Sign in", to: ctaTo }

    if (policy.accountsEnabled)
      return { label: ctaLabel, to: ctaTo }

    return {
      label: "Request workspace access",
      to: buildAccessRequestPath(source, "access"),
    }
  }

  return { label: ctaLabel, to: ctaTo }
}

export function getBackendModeLabel(environment: ProductAccessEnvironment, isLocalDevelopment: boolean) {
  if (environment.backendMode === "supabase")
    return "managed application data services"

  if (resolveProductAccessPolicy(environment, isLocalDevelopment).showDemoConveniences)
    return "development review services"

  return "CoFoundry-hosted application services"
}

export function getBillingModeLabel(environment: ProductAccessEnvironment, isLocalDevelopment: boolean) {
  if (environment.billingMode === "stripe")
    return "Stripe-backed subscription operations"

  const policy = resolveProductAccessPolicy(environment, isLocalDevelopment)

  if (policy.mockBillingPreviewEnabled)
    return "development billing preview"

  if (policy.operatorManagedBilling)
    return "operator-managed subscription operations"

  return "staged subscription operations"
}
