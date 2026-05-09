import type {
  AdminActionType,
  BillingCycle,
  CommitmentLevel,
  CompensationPreference,
  ConnectDeclineReason,
  ConnectRequestNextStep,
  ContactRevealStage,
  ContractStatus,
  CurrentWorkStatus,
  DeadlockPreference,
  DecisionModelPreference,
  EquityPhilosophy,
  LeadershipPreference,
  OpportunityVerificationStatus,
  ProposalRelationshipType,
  ProposalSectionKey,
  ProposalSectionState,
  ProposalStatus,
  RemotePreference,
  ReportReason,
  ReportStatus,
  RunwayBucket,
  SkillLevel,
  StartTimeline,
  StartupStage,
  SubscriptionPlan,
  TrialStatus,
  TrustTier,
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

export function formatBillingCycle(cycle: BillingCycle) {
  return {
    monthly: "Monthly",
    annual: "Annual",
  }[cycle]
}

export function formatStartTimeline(timeline: StartTimeline) {
  return {
    "immediately": "Ready now",
    "30_days": "Within 30 days",
    "90_days": "Within 90 days",
    "exploring": "Exploring carefully",
  }[timeline]
}

export function formatRunwayBucket(bucket: RunwayBucket) {
  return {
    "under_3_months": "Under 3 months",
    "3_to_6_months": "3 to 6 months",
    "6_to_12_months": "6 to 12 months",
    "12_plus_months": "12+ months",
    "undisclosed": "Undisclosed",
  }[bucket]
}

export function formatCurrentWorkStatus(status: CurrentWorkStatus) {
  return {
    full_time_employed: "Full-time employed",
    consulting_part_time: "Consulting or part-time",
    between_roles: "Between roles",
    full_time_on_startup: "Full-time on startup",
    exploring: "Exploring",
  }[status]
}

export function formatEquityPhilosophy(philosophy: EquityPhilosophy) {
  return {
    equal_unless_strong_reason: "Equal unless there is a strong reason",
    contribution_weighted: "Contribution-weighted",
    dynamic_over_time: "Dynamic over time",
  }[philosophy]
}

export function formatLeadershipPreference(preference: LeadershipPreference) {
  return {
    wants_ceo_role: "Wants the CEO / lead role",
    open_to_ceo_role: "Open to the CEO / lead role",
    prefers_non_ceo_role: "Prefers a non-CEO role",
  }[preference]
}

export function formatDecisionModelPreference(preference: DecisionModelPreference) {
  return {
    ceo_decides_with_input: "CEO decides with input",
    area_owner_decides: "Area owners decide",
    consensus_for_big_bets: "Consensus for big bets",
  }[preference]
}

export function formatDeadlockPreference(preference: DeadlockPreference) {
  return {
    advisor_tiebreaker: "Advisor tiebreaker",
    rotating_decider: "Rotating decider",
    board_mediator: "Board or formal mediator",
    neutral_operator: "Neutral operator",
  }[preference]
}

export function formatTrialStatus(status: TrialStatus) {
  return {
    draft: "Draft trial",
    active: "Active trial",
    completed: "Completed trial",
  }[status]
}

export function formatProposalRelationshipType(type: ProposalRelationshipType) {
  return {
    cofounder: "Co-founder",
    founding_team: "Founding team member",
    advisor: "Advisor / operating advisor",
  }[type]
}

export function formatProposalSectionKey(section: ProposalSectionKey) {
  return {
    partnership: "Partnership shape",
    scope: "Role and scope",
    trial: "Work trial",
    economics: "Economics",
    decision_rights: "Decision rights",
    ip_confidentiality: "IP and confidentiality",
    exit: "Exit and off-ramp",
  }[section]
}

export function formatProposalSectionState(state: ProposalSectionState) {
  return {
    proposed: "Proposed",
    countered: "Countered",
    agreed: "Agreed",
  }[state]
}

export function formatConnectDeclineReason(reason: ConnectDeclineReason) {
  return {
    timing: "Timing mismatch",
    domain_mismatch: "Domain mismatch",
    commitment_mismatch: "Commitment mismatch",
    values_mismatch: "Values mismatch",
    role_mismatch: "Role mismatch",
  }[reason]
}

export function formatConnectRequestNextStep(step: ConnectRequestNextStep) {
  return {
    intro_call: "15-minute intro call",
    working_session: "Focused working session",
    trial_sprint: "Short trial sprint",
    async_exchange: "Async exchange first",
  }[step]
}

export function formatTrustTier(tier: TrustTier) {
  return {
    level_a: "Trust level A",
    level_b: "Trust level B",
    level_c: "Trust level C",
  }[tier]
}

export function formatContactRevealStage(stage: ContactRevealStage) {
  return {
    matches: "After a mutual match",
    proposal_accepted: "After a proposal is accepted",
    contract_generated: "After a contract draft exists",
  }[stage]
}

export function formatOpportunityVerificationStatus(status: OpportunityVerificationStatus) {
  return {
    unverified: "Unverified listing",
    owner_verified: "Verified owner",
    domain_verified: "Domain verified",
    manual_review: "Under safety review",
  }[status]
}

export function formatReportReason(reason: ReportReason) {
  return {
    spam: "Spam",
    misrepresentation: "Misrepresentation",
    harassment: "Harassment",
    off_platform_solicitation: "Off-platform solicitation",
    scam_fraud: "Scam or fraud",
    impersonation: "Impersonation",
    data_harvesting: "Data harvesting",
    privacy_violation: "Privacy violation",
  }[reason]
}

export function formatReportStatus(status: ReportStatus) {
  return {
    open: "Open",
    reviewed: "Reviewed",
    resolved: "Resolved",
  }[status]
}

export function formatAdminActionType(type: AdminActionType) {
  return {
    suspend_user: "Suspended user",
    reinstate_user: "Reinstated user",
    change_user_role: "Changed user role",
    warn_user: "Warned user",
    remove_content: "Removed content",
    review_report: "Reviewed report",
    resolve_report: "Resolved report",
  }[type]
}
