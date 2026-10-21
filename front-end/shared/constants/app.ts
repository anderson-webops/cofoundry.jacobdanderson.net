export const appName = "CoFoundry"
export const appTagline = "Find the people you can build a company with."
export const appDescription = "CoFoundry helps founders and startup collaborators match, structure proposals, and move from interest to agreement without leaving the platform."
export const appProductionUrl = "https://cofoundry.jacobdanderson.net"

export const marketingNavigation = [
  { label: "How it works", to: "/how-it-works" },
  { label: "Find a cofounder", to: "/find-cofounder" },
  { label: "Pricing", to: "/pricing" },
  { label: "Guides", to: "/contracts" },
  { label: "Trust", to: "/trust" },
]

export const appNavigationGroups = [
  { id: "today", label: "Today" },
  { id: "find", label: "Find people" },
  { id: "formalize", label: "Formalize" },
  { id: "account", label: "Account" },
] as const

export type AppNavigationGroupId = typeof appNavigationGroups[number]["id"]

export const appNavigation: { label: string, to: string, icon: string, group: AppNavigationGroupId }[] = [
  { label: "Overview", to: "/app", icon: "i-carbon-home", group: "today" },
  { label: "Inbox", to: "/app/inbox", icon: "i-carbon-task", group: "today" },
  { label: "Activation", to: "/app/activation", icon: "i-carbon-progress-bar-round", group: "today" },
  { label: "Discover", to: "/app/discover", icon: "i-carbon-search", group: "find" },
  { label: "Opportunities", to: "/app/opportunities", icon: "i-carbon-launch", group: "find" },
  { label: "Matches", to: "/app/matches", icon: "i-carbon-partnership", group: "find" },
  { label: "Messages", to: "/app/messages", icon: "i-carbon-chat", group: "find" },
  { label: "Proposals", to: "/app/proposals", icon: "i-carbon-document-signed", group: "formalize" },
  { label: "Contracts", to: "/app/contracts", icon: "i-carbon-license-global", group: "formalize" },
  { label: "Studio", to: "/app/studio", icon: "i-carbon-workspace", group: "formalize" },
  { label: "Legal review", to: "/app/legal", icon: "i-carbon-collaborate", group: "formalize" },
  { label: "Billing", to: "/app/billing", icon: "i-carbon-wallet", group: "account" },
  { label: "Settings", to: "/app/settings", icon: "i-carbon-settings", group: "account" },
]

export const adminNavigation = [
  { label: "Overview", to: "/admin", icon: "i-carbon-dashboard" },
  { label: "Command queue", to: "/admin/queue", icon: "i-carbon-queued" },
  { label: "Readiness", to: "/admin/readiness", icon: "i-carbon-checkmark-outline" },
  { label: "Access requests", to: "/admin/access-requests", icon: "i-carbon-user-follow" },
  { label: "Users", to: "/admin/users", icon: "i-carbon-user-multiple" },
  { label: "Reports", to: "/admin/reports", icon: "i-carbon-flag-filled" },
  { label: "Privacy", to: "/admin/privacy", icon: "i-carbon-data-vis-4" },
  { label: "Evidence", to: "/admin/evidence", icon: "i-carbon-document-attachment" },
  { label: "Operations", to: "/admin/operations", icon: "i-carbon-cloud-monitoring" },
  { label: "Billing", to: "/admin/billing", icon: "i-carbon-wallet" },
  { label: "Analytics", to: "/admin/analytics", icon: "i-carbon-chart-line" },
  { label: "Audit", to: "/admin/audit", icon: "i-carbon-document-tasks" },
]
