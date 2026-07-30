import type { BillingCycle, Subscription, SubscriptionPlan, WorkspaceSeed } from "../types/domain"

export interface UsageQuota {
  used: number
  limit: number | null
  remaining: number | null
  exhausted: boolean
  label: string
}

export interface SubscriptionEntitlements {
  plan: SubscriptionPlan
  canMessageFreely: boolean
  canUseProposals: boolean
  canDraftContracts: boolean
  canSignContracts: boolean
  canPrintContracts: boolean
  hasVisibilityBoost: boolean
  introLimit: number | null
  savedSearchLimit: number | null
  proposalSendLimit: number | null
  contractDraftLimit: number | null
}

export interface SubscriptionUsage {
  intros: UsageQuota
  savedSearches: UsageQuota
  proposals: UsageQuota
  contractDrafts: UsageQuota
}

export type SubscriptionGateAction = "send_intro" | "save_search" | "create_proposal" | "create_contract" | "sign_contract"

export interface SubscriptionGateResult {
  allowed: boolean
  reason: string | null
}

const PLAN_LIMITS: Record<SubscriptionPlan, Omit<SubscriptionEntitlements, "plan" | "hasVisibilityBoost">> = {
  free: {
    canMessageFreely: true,
    canUseProposals: true,
    canDraftContracts: true,
    canSignContracts: false,
    canPrintContracts: false,
    introLimit: 5,
    savedSearchLimit: 1,
    proposalSendLimit: 2,
    contractDraftLimit: 1,
  },
  pro: {
    canMessageFreely: true,
    canUseProposals: true,
    canDraftContracts: true,
    canSignContracts: true,
    canPrintContracts: true,
    introLimit: 40,
    savedSearchLimit: null,
    proposalSendLimit: 12,
    contractDraftLimit: 8,
  },
  team: {
    canMessageFreely: true,
    canUseProposals: true,
    canDraftContracts: true,
    canSignContracts: true,
    canPrintContracts: true,
    introLimit: 120,
    savedSearchLimit: null,
    proposalSendLimit: 40,
    contractDraftLimit: 24,
  },
}

function isInCurrentMonth(value: string) {
  const target = new Date(value)
  const now = new Date()

  return target.getUTCFullYear() === now.getUTCFullYear() && target.getUTCMonth() === now.getUTCMonth()
}

function buildQuota(used: number, limit: number | null, label: string): UsageQuota {
  return {
    used,
    limit,
    remaining: limit === null ? null : Math.max(limit - used, 0),
    exhausted: limit !== null && used >= limit,
    label,
  }
}

export function getPlanPriceLabel(plan: SubscriptionPlan, billingCycle: BillingCycle = "monthly") {
  if (plan === "free")
    return "$0"

  if (plan === "pro")
    return billingCycle === "annual" ? "$240/yr" : "$29/mo"

  return billingCycle === "annual" ? "$990/yr" : "$99/mo"
}

export function getSubscriptionEntitlements(subscription?: Subscription): SubscriptionEntitlements {
  const entitled = subscription?.status === "active" || subscription?.status === "trialing"
  const plan = entitled ? subscription.plan : "free"
  const limits = PLAN_LIMITS[plan]

  return {
    plan,
    ...limits,
    hasVisibilityBoost: entitled && Boolean(subscription?.visibilityBoost || plan !== "free"),
  }
}

export function buildSubscriptionUsage(seed: WorkspaceSeed, userId: string, subscription?: Subscription): SubscriptionUsage {
  const entitlements = getSubscriptionEntitlements(subscription)

  const introsUsed = seed.connectRequests.filter(request => request.fromUserId === userId && isInCurrentMonth(request.createdAt)).length
  const savedSearchesUsed = seed.savedSearches.filter(search => search.userId === userId).length
  const proposalsUsed = seed.proposals.filter(proposal => proposal.createdByUserId === userId && isInCurrentMonth(proposal.createdAt)).length
  const contractDraftsUsed = seed.contracts.filter((contract) => {
    if (!isInCurrentMonth(contract.createdAt))
      return false

    const proposal = seed.proposals.find(item => item.id === contract.proposalId)
    if (!proposal)
      return false

    return proposal.createdByUserId === userId || proposal.recipientUserId === userId
  }).length

  return {
    intros: buildQuota(introsUsed, entitlements.introLimit, "new intros"),
    savedSearches: buildQuota(savedSearchesUsed, entitlements.savedSearchLimit, "saved searches"),
    proposals: buildQuota(proposalsUsed, entitlements.proposalSendLimit, "proposal sends"),
    contractDrafts: buildQuota(contractDraftsUsed, entitlements.contractDraftLimit, "agreement drafts"),
  }
}

export function checkSavedSearchCount(subscription: Subscription | undefined, savedSearchCount: number): SubscriptionGateResult {
  const entitlements = getSubscriptionEntitlements(subscription)
  const limit = entitlements.savedSearchLimit

  if (limit !== null && savedSearchCount > limit) {
    return {
      allowed: false,
      reason: `Your plan allows ${limit} saved search${limit === 1 ? "" : "es"}. Upgrade before adding another saved search.`,
    }
  }

  return {
    allowed: true,
    reason: null,
  }
}

export function checkSubscriptionGate(seed: WorkspaceSeed, userId: string, subscription: Subscription | undefined, action: SubscriptionGateAction): SubscriptionGateResult {
  const entitlements = getSubscriptionEntitlements(subscription)
  const usage = buildSubscriptionUsage(seed, userId, subscription)

  if (action === "send_intro" && usage.intros.exhausted) {
    return {
      allowed: false,
      reason: "Your plan has no structured intros left this month. Upgrade before sending another intro.",
    }
  }

  if (action === "save_search")
    return checkSavedSearchCount(subscription, usage.savedSearches.used + 1)

  if (action === "create_proposal") {
    if (!entitlements.canUseProposals) {
      return {
        allowed: false,
        reason: "Your plan does not include proposal workflows.",
      }
    }

    if (usage.proposals.exhausted) {
      return {
        allowed: false,
        reason: "Your plan has no proposal sends left this month. Upgrade before sending another proposal.",
      }
    }
  }

  if (action === "create_contract") {
    if (!entitlements.canDraftContracts) {
      return {
        allowed: false,
        reason: "Your plan does not include agreement drafting.",
      }
    }

    if (usage.contractDrafts.exhausted) {
      return {
        allowed: false,
        reason: "Your plan has no agreement drafts left this month. Upgrade before creating another agreement.",
      }
    }
  }

  if (action === "sign_contract" && !entitlements.canSignContracts) {
    return {
      allowed: false,
      reason: "Agreement signing requires a Pro or Team plan.",
    }
  }

  return {
    allowed: true,
    reason: null,
  }
}

export function formatUsageQuota(quota: UsageQuota) {
  if (quota.limit === null)
    return `${quota.used} used this month`

  return `${quota.remaining} of ${quota.limit} left`
}
