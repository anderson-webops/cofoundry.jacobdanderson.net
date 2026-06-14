import { privateApiRoutePrefixes, privateWorkspaceRoutePrefixes } from "../constants/route-surfaces"

export const blockedTrainingRobots = [
  "GPTBot",
  "ClaudeBot",
  "Google-Extended",
] as const

export const publicSearchRobots = [
  "Googlebot",
  "Bingbot",
  "OAI-SearchBot",
  "PerplexityBot",
  "Perplexity-User",
  "Claude-SearchBot",
  "Claude-User",
  "*",
] as const

function normalizeRobotsAppUrl(appUrl: string) {
  return appUrl.trim().replace(/\/+$/, "")
}

export function getRobotsDisallowPaths() {
  return Array.from(new Set([
    ...privateWorkspaceRoutePrefixes,
    ...privateApiRoutePrefixes,
  ]))
}

export function buildRobotsTxt(appUrl: string) {
  const normalizedAppUrl = normalizeRobotsAppUrl(appUrl)
  const disallowPaths = getRobotsDisallowPaths()
  const blockedTrainingRules = blockedTrainingRobots.flatMap(userAgent => [
    `User-agent: ${userAgent}`,
    "Disallow: /",
    "",
  ])
  const publicSearchRules = publicSearchRobots.flatMap(userAgent => [
    `User-agent: ${userAgent}`,
    "Allow: /",
    ...disallowPaths.map(path => `Disallow: ${path}`),
    "",
  ])

  return [
    ...blockedTrainingRules,
    ...publicSearchRules,
    `Sitemap: ${normalizedAppUrl}/sitemap.xml`,
  ].join("\n")
}
