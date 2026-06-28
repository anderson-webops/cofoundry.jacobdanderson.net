import type { Profile, StartupOpportunity, StartupStage, WorkspaceSeed } from "../types/domain"
import { publicMarketingRoutes } from "../constants/route-surfaces"
import { contractGuidePages, trustCenterPages } from "../data/public-content"
import { formatStage } from "./format"
import { buildProfileReadiness, buildProfileTrustScore } from "./formation"
import { getProfileByUserId, getProfileSkills } from "./workspace"

const slugPattern = /[^a-z0-9]+/g
const trimHyphenPattern = /^-|-$/g
const userPrefixPattern = /^user_/
const excludedRoleLabels = new Set(["founder", "ceo"])

export interface PublicProfileEntry {
  slug: string
  profile: Profile
  roleSlugs: string[]
  industrySlugs: string[]
  stageSlugs: string[]
  skillLabels: string[]
  trustScore: number
  trustPercent: number
}

export interface PublicOpportunityEntry {
  slug: string
  opportunity: StartupOpportunity
  ownerProfile: Profile
  roleSlugs: string[]
  industrySlugs: string[]
  stageSlugs: string[]
}

export interface PublicHubEntry {
  slug: string
  label: string
  description: string
  profileCount: number
  opportunityCount: number
}

function buildSlug(value: string) {
  return value.toLowerCase().replaceAll(slugPattern, "-").replaceAll(trimHyphenPattern, "") || "general"
}

function uniqueBySlug(values: string[], filter?: (_value: string) => boolean) {
  const seen = new Set<string>()
  const entries: { label: string, slug: string }[] = []

  values.forEach((value) => {
    const label = value.trim()
    if (!label)
      return

    if (filter && !filter(label))
      return

    const slug = buildSlug(label)
    if (!slug || seen.has(slug))
      return

    seen.add(slug)
    entries.push({ label, slug })
  })

  return entries
}

function buildRoleSlugs(profile: Profile) {
  return uniqueBySlug(
    [...profile.roles, profile.roleScope.primaryRole],
    value => !excludedRoleLabels.has(value.trim().toLowerCase()),
  ).map(entry => entry.slug)
}

function buildOpportunityRoleSlugs(opportunity: StartupOpportunity) {
  return uniqueBySlug(
    opportunity.rolesNeeded,
    value => !excludedRoleLabels.has(value.trim().toLowerCase()),
  ).map(entry => entry.slug)
}

function buildStageSlugs(stages: StartupStage[]) {
  return stages.map(stage => buildSlug(formatStage(stage)))
}

function buildRoleDescription(label: string) {
  return `Public ${label} searches on CoFoundry, with real founder profiles, open startup opportunities, and a path into structured proposals.`
}

function buildIndustryDescription(label: string) {
  return `Founders, collaborators, and startup searches in ${label} that are public on CoFoundry.`
}

function buildStageDescription(label: string) {
  return `${label} founders and collaborators using CoFoundry to pressure-test fit before formal terms.`
}

function buildHubEntries(
  labels: { label: string, slug: string }[],
  profiles: PublicProfileEntry[],
  opportunities: PublicOpportunityEntry[],
  descriptionBuilder: (_label: string) => string,
  selector: "roleSlugs" | "industrySlugs" | "stageSlugs",
) {
  return labels
    .map((entry) => {
      const profileCount = profiles.filter(profile => profile[selector].includes(entry.slug)).length
      const opportunityCount = opportunities.filter(opportunity => opportunity[selector].includes(entry.slug)).length

      return {
        slug: entry.slug,
        label: entry.label,
        description: descriptionBuilder(entry.label),
        profileCount,
        opportunityCount,
      }
    })
    .filter(entry => entry.profileCount > 0 || entry.opportunityCount > 0)
    .sort((left, right) => {
      const leftTotal = left.profileCount + left.opportunityCount
      const rightTotal = right.profileCount + right.opportunityCount

      if (rightTotal !== leftTotal)
        return rightTotal - leftTotal

      return left.label.localeCompare(right.label)
    })
}

export function slugifySegment(value: string) {
  return buildSlug(value)
}

export function buildPublicProfileSlug(profile: Profile) {
  return `${buildSlug(profile.displayName)}-${profile.userId.replace(userPrefixPattern, "")}`
}

export function formatPublicDirectoryCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}

export function formatHubInventoryLabel(hub: Pick<PublicHubEntry, "profileCount" | "opportunityCount">) {
  return [
    formatPublicDirectoryCount(hub.profileCount, "profile"),
    formatPublicDirectoryCount(hub.opportunityCount, "search", "searches"),
  ].join(" · ")
}

export function formatPublicHubInventoryLabel(hub: Pick<PublicHubEntry, "profileCount" | "opportunityCount">) {
  return [
    formatPublicDirectoryCount(hub.profileCount, "public profile"),
    formatPublicDirectoryCount(hub.opportunityCount, "public startup search", "public startup searches"),
  ].join(" · ")
}

export function getPublicProfiles(seed: WorkspaceSeed) {
  return seed.profiles
    .filter((profile) => {
      if (profile.privacy.profileVisibility !== "public")
        return false

      return buildProfileReadiness(profile).trustReady
    })
    .map<PublicProfileEntry>(profile => ({
      slug: buildPublicProfileSlug(profile),
      profile,
      roleSlugs: buildRoleSlugs(profile),
      industrySlugs: uniqueBySlug(profile.industries).map(entry => entry.slug),
      stageSlugs: buildStageSlugs(profile.startupStagePreferences),
      skillLabels: getProfileSkills(seed, profile.id).map(entry => entry.skill.label),
      trustScore: buildProfileTrustScore(profile),
      trustPercent: buildProfileReadiness(profile).trustPercent,
    }))
    .sort((left, right) => right.trustScore - left.trustScore)
}

export function getPublicOpportunities(seed: WorkspaceSeed) {
  return seed.opportunities
    .map((opportunity) => {
      const ownerProfile = getProfileByUserId(seed, opportunity.ownerUserId)

      if (!ownerProfile)
        return null

      if (!opportunity.isOpen || ownerProfile.privacy.opportunityVisibility !== "public")
        return null

      return {
        slug: opportunity.slug,
        opportunity,
        ownerProfile,
        roleSlugs: buildOpportunityRoleSlugs(opportunity),
        industrySlugs: uniqueBySlug(opportunity.industries).map(entry => entry.slug),
        stageSlugs: [buildSlug(formatStage(opportunity.stage))],
      } satisfies PublicOpportunityEntry
    })
    .filter((entry): entry is PublicOpportunityEntry => Boolean(entry))
    .sort((left, right) => new Date(right.opportunity.updatedAt).getTime() - new Date(left.opportunity.updatedAt).getTime())
}

export function getPublicProfileBySlug(seed: WorkspaceSeed, slug: string) {
  return getPublicProfiles(seed).find(entry => entry.slug === slug)
}

export function getPublicOpportunityBySlug(seed: WorkspaceSeed, slug: string) {
  return getPublicOpportunities(seed).find(entry => entry.slug === slug)
}

export function getRoleHubs(seed: WorkspaceSeed) {
  const profiles = getPublicProfiles(seed)
  const opportunities = getPublicOpportunities(seed)
  const labels = uniqueBySlug(
    [
      ...profiles.flatMap(entry => entry.profile.roles),
      ...profiles.map(entry => entry.profile.roleScope.primaryRole),
      ...opportunities.flatMap(entry => entry.opportunity.rolesNeeded),
    ],
    value => !excludedRoleLabels.has(value.trim().toLowerCase()),
  )

  return buildHubEntries(labels, profiles, opportunities, buildRoleDescription, "roleSlugs")
}

export function getIndustryHubs(seed: WorkspaceSeed) {
  const profiles = getPublicProfiles(seed)
  const opportunities = getPublicOpportunities(seed)
  const labels = uniqueBySlug([
    ...profiles.flatMap(entry => entry.profile.industries),
    ...opportunities.flatMap(entry => entry.opportunity.industries),
  ])

  return buildHubEntries(labels, profiles, opportunities, buildIndustryDescription, "industrySlugs")
}

export function getStageHubs(seed: WorkspaceSeed) {
  const profiles = getPublicProfiles(seed)
  const opportunities = getPublicOpportunities(seed)
  const labels = uniqueBySlug([
    ...profiles.flatMap(entry => entry.profile.startupStagePreferences.map(stage => formatStage(stage))),
    ...opportunities.map(entry => formatStage(entry.opportunity.stage)),
  ])

  return buildHubEntries(labels, profiles, opportunities, buildStageDescription, "stageSlugs")
}

export function getPublicProfilesForRole(seed: WorkspaceSeed, slug: string) {
  return getPublicProfiles(seed).filter(entry => entry.roleSlugs.includes(slug))
}

export function getPublicProfilesForIndustry(seed: WorkspaceSeed, slug: string) {
  return getPublicProfiles(seed).filter(entry => entry.industrySlugs.includes(slug))
}

export function getPublicProfilesForStage(seed: WorkspaceSeed, slug: string) {
  return getPublicProfiles(seed).filter(entry => entry.stageSlugs.includes(slug))
}

export function getPublicOpportunitiesForRole(seed: WorkspaceSeed, slug: string) {
  return getPublicOpportunities(seed).filter(entry => entry.roleSlugs.includes(slug))
}

export function getPublicOpportunitiesForIndustry(seed: WorkspaceSeed, slug: string) {
  return getPublicOpportunities(seed).filter(entry => entry.industrySlugs.includes(slug))
}

export function getPublicOpportunitiesForStage(seed: WorkspaceSeed, slug: string) {
  return getPublicOpportunities(seed).filter(entry => entry.stageSlugs.includes(slug))
}

export function getPublicRoutePaths(seed: WorkspaceSeed) {
  return [
    ...publicMarketingRoutes,
    ...trustCenterPages.map(page => `/trust/${page.slug}`),
    ...contractGuidePages.map(page => `/contracts/${page.slug}`),
    ...getRoleHubs(seed).map(entry => `/roles/${entry.slug}`),
    ...getIndustryHubs(seed).map(entry => `/industries/${entry.slug}`),
    ...getStageHubs(seed).map(entry => `/stage/${entry.slug}`),
    ...getPublicProfiles(seed).map(entry => `/people/${entry.slug}`),
    ...getPublicOpportunities(seed).map(entry => `/startups/${entry.slug}`),
  ]
}

export function pickRelatedHubEntries(entries: PublicHubEntry[], currentSlug: string, limit = 3) {
  return entries.filter(entry => entry.slug !== currentSlug).slice(0, limit)
}
