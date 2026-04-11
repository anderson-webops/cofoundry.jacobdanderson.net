import type {
  CommitmentLevel,
  CompensationPreference,
  ContractStatus,
  ProposalStatus,
  RemotePreference,
  SkillLevel,
  StartupStage,
  SubscriptionPlan,
} from "../types/domain"

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
})

const relativeFormatter = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" })

export function formatDate(value: string) {
  return dateFormatter.format(new Date(value))
}

export function formatRelativeDate(value: string) {
  const now = Date.now()
  const diffMs = new Date(value).getTime() - now
  const diffHours = Math.round(diffMs / 36e5)

  if (Math.abs(diffHours) < 24)
    return relativeFormatter.format(diffHours, "hour")

  const diffDays = Math.round(diffMs / 864e5)
  return relativeFormatter.format(diffDays, "day")
}

export function formatStage(stage: StartupStage) {
  return {
    idea: "Idea",
    prototype: "Prototype",
    mvp: "MVP",
    revenue: "Revenue",
    growth: "Growth",
  }[stage]
}

export function formatCommitment(commitment: CommitmentLevel) {
  return {
    nights_weekends: "Nights & weekends",
    part_time: "Part-time",
    full_time: "Full-time",
  }[commitment]
}

export function formatCompensation(compensation: CompensationPreference) {
  return {
    equity_only: "Equity only",
    cash_and_equity: "Cash + equity",
    cash_only: "Cash only",
    advisory: "Advisory",
  }[compensation]
}

export function formatRemotePreference(preference: RemotePreference) {
  return {
    remote: "Remote",
    hybrid: "Hybrid",
    in_person: "In person",
  }[preference]
}

export function formatSkillLevel(level: SkillLevel) {
  return {
    working: "Working",
    strong: "Strong",
    expert: "Expert",
  }[level]
}

export function formatProposalStatus(status: ProposalStatus) {
  return {
    draft: "Draft",
    sent: "Sent",
    viewed: "Viewed",
    countered: "Countered",
    accepted: "Accepted",
    rejected: "Rejected",
  }[status]
}

export function formatContractStatus(status: ContractStatus) {
  return {
    draft: "Draft",
    pending_signature: "Pending signature",
    signed: "Signed",
  }[status]
}

export function formatPlanName(plan: SubscriptionPlan) {
  return {
    free: "Free",
    pro: "Pro",
    team: "Team",
  }[plan]
}
