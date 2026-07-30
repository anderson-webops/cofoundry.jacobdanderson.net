import type { Profile, StartupOpportunity, StartupStage, TrustTier, WorkspaceSeed } from "../types/domain"
import { publicMarketingRoutes } from "../constants/route-surfaces"
import { contractGuidePages, trustCenterPages } from "../data/public-content"
import { formatStage } from "./format"
import { buildProfileReadiness, buildProfileTrustScore, buildProfileTrustTier } from "./formation"
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
  trustSummary: PublicTrustSummary
}

export interface PublicOpportunityEntry {
  slug: string
  opportunity: StartupOpportunity
  ownerProfile: Profile
  roleSlugs: string[]
  industrySlugs: string[]
  stageSlugs: string[]
  ownerTrustSummary: PublicTrustSummary
}

export interface PublicHubEntry {
  slug: string
  label: string
  description: string
  profileCount: number
  opportunityCount: number
}

export interface PublicDirectorySnapshot {
  industryHubs: PublicHubEntry[]
  opportunities: PublicOpportunityEntry[]
  profiles: PublicProfileEntry[]
  roleHubs: PublicHubEntry[]
  stageHubs: PublicHubEntry[]
}

export interface PublicTrustSummary {
  completedCount: number
  percent: number
  ready: boolean
  tier: TrustTier
  totalCount: number
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

export function projectProfileForPublicDirectory(profile: Profile): Profile {
  const revealLinks = !profile.privacy.contactDetailsVisibleToMatchesOnly

  return {
    id: "",
    userId: profile.userId,
    displayName: profile.displayName,
    photoUrl: "",
    headline: profile.headline,
    bio: profile.bio,
    location: profile.location,
    remotePreference: profile.remotePreference,
    roles: [...profile.roles],
    yearsExperience: profile.yearsExperience,
    industries: [...profile.industries],
    startupStagePreferences: [...profile.startupStagePreferences],
    availability: "",
    compensationPreferences: [],
    equityExpectationRange: "",
    timeCommitment: profile.timeCommitment,
    commitmentProfile: {
      weeklyAvailabilityHours: profile.commitmentProfile.weeklyAvailabilityHours,
      currentStatus: "exploring",
      fullTimeBy: "",
      runwayBucket: "undisclosed",
    },
    governancePreferences: {
      equityPhilosophy: "equal_unless_strong_reason",
      leadershipPreference: "open_to_ceo_role",
      decisionModelPreference: "area_owner_decides",
      deadlockPreference: "neutral_operator",
    },
    intent: {
      startTimeline: profile.intent.startTimeline,
      companyPreferences: [],
      introCapacity: "",
      nonNegotiables: [],
    },
    ipReadiness: {
      existingAssets: [],
      existingAssetsNotes: "",
      priorObligations: "none_known",
      readyToAssignIp: false,
    },
    links: revealLinks
      ? profile.links
      : {
          github: "",
          linkedin: "",
          portfolio: "",
          website: "",
        },
    hasIdea: profile.hasIdea,
    wantsToJoinIdea: profile.wantsToJoinIdea,
    values: [],
    workStylePreferences: [],
    privacy: {
      contactDetailsVisibleToMatchesOnly: profile.privacy.contactDetailsVisibleToMatchesOnly,
      contactRevealStage: profile.privacy.contactRevealStage,
      opportunityVisibility: profile.privacy.opportunityVisibility === "public" ? "public" : "private",
      portfolioVisibility: profile.privacy.portfolioVisibility === "public" ? "public" : "private",
      profileVisibility: "public",
    },
    verificationBadges: {
      emailVerified: profile.verificationBadges.emailVerified,
      linkedAccounts: profile.verificationBadges.linkedAccounts,
      profileComplete: profile.verificationBadges.profileComplete,
    },
    trustSignals: {
      builderProofs: profile.trustSignals.builderProofs.map((artifact, index) => ({
        id: `public-proof-${index + 1}`,
        outcome: artifact.outcome,
        summary: artifact.summary,
        title: artifact.title,
        url: artifact.url,
      })),
      githubVerified: profile.trustSignals.githubVerified,
      governmentIdVerified: profile.trustSignals.governmentIdVerified,
      identityVerified: profile.trustSignals.identityVerified,
      lastActiveAt: profile.trustSignals.lastActiveAt,
      linkedInVerified: profile.trustSignals.linkedInVerified,
      medianReplyHours: profile.trustSignals.medianReplyHours,
      phoneVerified: profile.trustSignals.phoneVerified,
      replyRatePercent: profile.trustSignals.replyRatePercent,
      websiteVerified: profile.trustSignals.websiteVerified,
      workDomainVerified: profile.trustSignals.workDomainVerified,
      workHistoryVerified: profile.trustSignals.workHistoryVerified,
    },
    portfolio: profile.privacy.portfolioVisibility === "public"
      ? profile.portfolio.map((project, index) => ({
          id: `public-project-${index + 1}`,
          name: project.name,
          outcome: project.outcome,
          role: project.role,
          summary: project.summary,
          url: project.url,
        }))
      : [],
    ventures: profile.ventures.map((venture, index) => ({
      id: `public-venture-${index + 1}`,
      name: venture.name,
      role: venture.role,
      stage: venture.stage,
    })),
    roleScope: {
      primaryRole: profile.roleScope.primaryRole,
      accountabilityMilestones: [],
      nonResponsibilities: [],
    },
    summaryHighlights: [],
  }
}

export function projectOpportunityForPublicDirectory(opportunity: StartupOpportunity): StartupOpportunity {
  return {
    id: "",
    ownerUserId: "",
    startupName: opportunity.startupName,
    slug: opportunity.slug,
    oneLinePitch: opportunity.oneLinePitch,
    problem: opportunity.problem,
    targetUsers: opportunity.targetUsers,
    stage: opportunity.stage,
    traction: opportunity.traction,
    rolesNeeded: [...opportunity.rolesNeeded],
    expectedCommitment: opportunity.expectedCommitment,
    compensationStructure: opportunity.compensationStructure,
    equityRange: opportunity.equityRange,
    industries: [...opportunity.industries],
    location: opportunity.location,
    remotePreference: opportunity.remotePreference,
    officialWebsite: opportunity.officialWebsite,
    verificationMethod: "none",
    verificationStatus: opportunity.verificationStatus,
    riskFlags: [],
    createdAt: opportunity.createdAt,
    updatedAt: opportunity.updatedAt,
    isOpen: true,
  }
}

function buildPublicTrustSummary(profile: Profile): PublicTrustSummary {
  const readiness = buildProfileReadiness(profile)
  return {
    completedCount: readiness.trustCompletedCount,
    percent: readiness.trustPercent,
    ready: readiness.trustReady,
    tier: buildProfileTrustTier(profile),
    totalCount: readiness.trustTotalCount,
  }
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
    .map<PublicProfileEntry>((sourceProfile) => {
      const profile = projectProfileForPublicDirectory(sourceProfile)
      return {
        slug: buildPublicProfileSlug(sourceProfile),
        profile,
        roleSlugs: buildRoleSlugs(profile),
        industrySlugs: uniqueBySlug(profile.industries).map(entry => entry.slug),
        stageSlugs: buildStageSlugs(profile.startupStagePreferences),
        skillLabels: getProfileSkills(seed, sourceProfile.id).map(entry => entry.skill.label),
        trustScore: buildProfileTrustScore(sourceProfile),
        trustPercent: buildProfileReadiness(sourceProfile).trustPercent,
        trustSummary: buildPublicTrustSummary(sourceProfile),
      }
    })
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
        opportunity: projectOpportunityForPublicDirectory(opportunity),
        ownerProfile: projectProfileForPublicDirectory(ownerProfile),
        ownerTrustSummary: buildPublicTrustSummary(ownerProfile),
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

export function buildPublicDirectorySnapshot(seed: WorkspaceSeed): PublicDirectorySnapshot {
  return {
    industryHubs: getIndustryHubs(seed),
    opportunities: getPublicOpportunities(seed),
    profiles: getPublicProfiles(seed),
    roleHubs: getRoleHubs(seed),
    stageHubs: getStageHubs(seed),
  }
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
