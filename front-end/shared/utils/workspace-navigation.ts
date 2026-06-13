export interface WorkspaceRouteContext {
  areaLabel: string
  title: string
  description: string
}

interface WorkspaceRouteMatcher extends WorkspaceRouteContext {
  prefix: string
}

const workspaceRouteMatchers: WorkspaceRouteMatcher[] = [
  {
    prefix: "/admin/readiness",
    areaLabel: "Admin workspace",
    title: "Launch readiness",
    description: "Review configuration, worker evidence, queues, and operational blockers before treating the site as production-ready.",
  },
  {
    prefix: "/admin/access-requests",
    areaLabel: "Admin workspace",
    title: "Access requests",
    description: "Review workspace-access requests, approve or deny them, and issue invite links from the admin queue.",
  },
  {
    prefix: "/admin/analytics",
    areaLabel: "Admin workspace",
    title: "Analytics",
    description: "Track moderation load, growth signals, and product health from one admin surface.",
  },
  {
    prefix: "/admin/reports",
    areaLabel: "Admin workspace",
    title: "Reports",
    description: "Review flagged profiles, conversations, and trust issues before they harm the network.",
  },
  {
    prefix: "/admin/users",
    areaLabel: "Admin workspace",
    title: "Users",
    description: "Search members, review trust state, and enforce role or suspension decisions server-side.",
  },
  {
    prefix: "/admin/audit",
    areaLabel: "Admin workspace",
    title: "Audit log",
    description: "Trace moderation and account actions with a durable record of who changed what.",
  },
  {
    prefix: "/admin/operations",
    areaLabel: "Admin workspace",
    title: "Operations",
    description: "Review delivery, file scanning, backup, and operational-event records from Supabase-backed production systems.",
  },
  {
    prefix: "/admin",
    areaLabel: "Admin workspace",
    title: "Overview",
    description: "Monitor the moderation queue, user health, and the most important operational signals.",
  },
  {
    prefix: "/app/opportunities/",
    areaLabel: "Workspace",
    title: "Opportunity detail",
    description: "Review the company, role shape, and fit signals before you spend outreach capacity.",
  },
  {
    prefix: "/app/activation",
    areaLabel: "Workspace",
    title: "Activation",
    description: "Move from minimum profile to trust readiness, first intro, and inbox-first follow-through.",
  },
  {
    prefix: "/app/inbox",
    areaLabel: "Workspace",
    title: "Inbox",
    description: "Work the queue across intros, replies, proposal terms, signatures, and system updates that still need action.",
  },
  {
    prefix: "/app/opportunities",
    areaLabel: "Workspace",
    title: "Opportunities",
    description: "Compare startup openings by stage, role need, and compensation structure.",
  },
  {
    prefix: "/app/messages/",
    areaLabel: "Workspace",
    title: "Conversation",
    description: "Keep trust, fit, and next steps visible while a match moves toward a proposal.",
  },
  {
    prefix: "/app/relationships/",
    areaLabel: "Workspace",
    title: "Relationship",
    description: "Work one match through conversation, trial, proposal, agreement, and next action from a single surface.",
  },
  {
    prefix: "/app/messages",
    areaLabel: "Workspace",
    title: "Messages",
    description: "Manage live conversations, reply queues, and the matches that need follow-through.",
  },
  {
    prefix: "/app/proposals/",
    areaLabel: "Workspace",
    title: "Deal room",
    description: "Move from conversation into explicit terms with versioned proposal sections and comments.",
  },
  {
    prefix: "/app/proposals",
    areaLabel: "Workspace",
    title: "Proposals",
    description: "Track structured offers, counters, and the relationships moving toward written terms.",
  },
  {
    prefix: "/app/contracts/",
    areaLabel: "Workspace",
    title: "Agreement",
    description: "Review the generated agreement draft, signatures, and the current contract version.",
  },
  {
    prefix: "/app/contracts",
    areaLabel: "Workspace",
    title: "Contracts",
    description: "Manage agreement drafts, signatures, and the legal handoff before work begins.",
  },
  {
    prefix: "/app/billing",
    areaLabel: "Workspace",
    title: "Billing",
    description: "Understand plan limits, renewal state, and which proposal and agreement tools are unlocked on this account.",
  },
  {
    prefix: "/app/settings",
    areaLabel: "Workspace",
    title: "Settings",
    description: "Control profile visibility, trust settings, and account preferences without leaving the product.",
  },
  {
    prefix: "/app/discover",
    areaLabel: "Workspace",
    title: "Discover",
    description: "Search deliberately, compare strong fits, and keep filters tight enough to convert.",
  },
  {
    prefix: "/app/matches",
    areaLabel: "Workspace",
    title: "Matches",
    description: "Review mutual interest, start trial sprints, and decide which conversations should deepen.",
  },
  {
    prefix: "/app/profile/edit",
    areaLabel: "Workspace",
    title: "Edit profile",
    description: "Strengthen profile signal, trust evidence, and readiness for outreach or proposals.",
  },
  {
    prefix: "/app/profile",
    areaLabel: "Workspace",
    title: "Profile",
    description: "See the profile others evaluate, including trust, fit, and company-building context.",
  },
  {
    prefix: "/app/investment",
    areaLabel: "Workspace",
    title: "Investment",
    description: "Review the gated investment module without mixing it into the main team-formation path.",
  },
  {
    prefix: "/app",
    areaLabel: "Workspace",
    title: "Overview",
    description: "See what needs attention now across discovery, intros, proposals, and agreements.",
  },
]

const defaultRouteContext: WorkspaceRouteContext = {
  areaLabel: "Workspace",
  title: "Overview",
  description: "Move from first signal to written terms without losing context.",
}

function normalizePath(path: string) {
  if (path.length > 1 && path.endsWith("/"))
    return path.slice(0, -1)

  return path
}

export function resolveWorkspaceRouteContext(path: string): WorkspaceRouteContext {
  const normalizedPath = normalizePath(path)
  const match = workspaceRouteMatchers.find(route => normalizedPath === route.prefix || normalizedPath.startsWith(`${route.prefix}/`) || normalizedPath.startsWith(route.prefix))

  if (!match)
    return defaultRouteContext

  return {
    areaLabel: match.areaLabel,
    title: match.title,
    description: match.description,
  }
}
