import { mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import process from "node:process"
import { createClient } from "@supabase/supabase-js"
import { workspaceSeed } from "../../front-end/shared/data/seed"
import { formatEnvironmentValidationError, readPublicEnvironment, readSecretEnvironment } from "../src/environment"

const localOutputPath = resolve(process.cwd(), "../.data/mock-seed.json")

interface SeedTable {
  name: string
  onConflict?: string
  rows: Record<string, unknown>[]
}

async function writeLocalSeedSnapshot() {
  await mkdir(dirname(localOutputPath), { recursive: true })
  await writeFile(localOutputPath, `${JSON.stringify(workspaceSeed, null, 2)}\n`, "utf-8")
  console.log(`Wrote local mock seed snapshot to ${localOutputPath}`)
}

function mapTables(): SeedTable[] {
  return [
    {
      name: "users",
      rows: workspaceSeed.users.map(user => ({
        id: user.id,
        email: user.email,
        role: user.role,
        created_at: user.createdAt,
        linked_providers: user.linkedProviders,
        verified_email: user.verifiedEmail,
        onboarding_completed: user.onboardingCompleted,
        email_digest_enabled: user.notificationPreferences.unreadDigestEmail,
        suspended_at: user.suspendedAt,
      })),
    },
    {
      name: "demo_auth_accounts",
      onConflict: "email",
      rows: workspaceSeed.authAccounts.map(account => ({
        email: account.email,
        password: account.password,
        providers: account.providers,
        user_id: account.userId,
      })),
    },
    {
      name: "profiles",
      rows: workspaceSeed.profiles.map(profile => ({
        id: profile.id,
        user_id: profile.userId,
        display_name: profile.displayName,
        headline: profile.headline,
        bio: profile.bio,
        location: profile.location,
        remote_preference: profile.remotePreference,
        roles: profile.roles,
        years_experience: profile.yearsExperience,
        industries: profile.industries,
        startup_stage_preferences: profile.startupStagePreferences,
        compensation_preferences: profile.compensationPreferences,
        equity_expectation_range: profile.equityExpectationRange,
        time_commitment: profile.timeCommitment,
        links: profile.links,
        has_idea: profile.hasIdea,
        wants_to_join_idea: profile.wantsToJoinIdea,
        values: profile.values,
        work_style_preferences: profile.workStylePreferences,
        privacy: profile.privacy,
        verification_badges: profile.verificationBadges,
        availability: profile.availability,
        portfolio: profile.portfolio,
        ventures: profile.ventures,
        summary_highlights: profile.summaryHighlights,
      })),
    },
    {
      name: "member_profile_state",
      rows: workspaceSeed.profiles.map(profile => ({
        user_id: profile.userId,
        profile,
        updated_at: new Date().toISOString(),
      })),
    },
    {
      name: "skills",
      rows: workspaceSeed.skills.map(skill => ({
        id: skill.id,
        label: skill.label,
        category: skill.category,
      })),
    },
    {
      name: "profile_skills",
      rows: workspaceSeed.profileSkills.map(profileSkill => ({
        id: profileSkill.id,
        profile_id: profileSkill.profileId,
        skill_id: profileSkill.skillId,
        level: profileSkill.level,
        years: profileSkill.years,
      })),
    },
    {
      name: "startup_opportunities",
      rows: workspaceSeed.opportunities.map(opportunity => ({
        id: opportunity.id,
        owner_user_id: opportunity.ownerUserId,
        startup_name: opportunity.startupName,
        slug: opportunity.slug,
        one_line_pitch: opportunity.oneLinePitch,
        problem: opportunity.problem,
        target_users: opportunity.targetUsers,
        stage: opportunity.stage,
        traction: opportunity.traction,
        roles_needed: opportunity.rolesNeeded,
        expected_commitment: opportunity.expectedCommitment,
        compensation_structure: opportunity.compensationStructure,
        equity_range: opportunity.equityRange,
        industries: opportunity.industries,
        location: opportunity.location,
        remote_preference: opportunity.remotePreference,
        official_website: opportunity.officialWebsite,
        verification_method: opportunity.verificationMethod,
        verification_status: opportunity.verificationStatus,
        risk_flags: opportunity.riskFlags,
        created_at: opportunity.createdAt,
        updated_at: opportunity.updatedAt,
        is_open: opportunity.isOpen,
      })),
    },
    {
      name: "opportunity_roles",
      rows: workspaceSeed.opportunityRoles.map(role => ({
        id: role.id,
        opportunity_id: role.opportunityId,
        title: role.title,
        summary: role.summary,
        skills: role.skills,
        commitment: role.commitment,
        compensation_type: role.compensationType,
        equity_range: role.equityRange,
        priority: role.priority,
      })),
    },
    { name: "bookmarks", rows: workspaceSeed.bookmarks.map(bookmark => ({ id: bookmark.id, user_id: bookmark.userId, target_type: bookmark.targetType, target_id: bookmark.targetId, created_at: bookmark.createdAt })) },
    { name: "connect_requests", rows: workspaceSeed.connectRequests.map(request => ({ id: request.id, from_user_id: request.fromUserId, to_user_id: request.toUserId, note: request.note, structured_intro: request.structuredIntro, status: request.status, decline_reason: request.declineReason, created_at: request.createdAt, responded_at: request.respondedAt })) },
    { name: "conversations", rows: workspaceSeed.conversations.map(conversation => ({ id: conversation.id, participant_ids: conversation.participantIds, last_message_at: conversation.lastMessageAt, unread_count_by_user: conversation.unreadCountByUser, typing_by_user_ids: conversation.typingByUserIds })) },
    { name: "matches", rows: workspaceSeed.matches.map(match => ({ id: match.id, participant_ids: match.participantIds, source: match.source, conversation_id: match.conversationId, created_at: match.createdAt })) },
    { name: "messages", rows: workspaceSeed.messages.map(message => ({ id: message.id, conversation_id: message.conversationId, sender_user_id: message.senderUserId, type: message.type, body: message.body, attachments: message.attachments, created_at: message.createdAt })) },
    { name: "proposals", rows: workspaceSeed.proposals.map(proposal => ({ id: proposal.id, conversation_id: proposal.conversationId, opportunity_id: proposal.opportunityId, created_by_user_id: proposal.createdByUserId, recipient_user_id: proposal.recipientUserId, title: proposal.title, current_version_id: proposal.currentVersionId, status: proposal.status, created_at: proposal.createdAt, updated_at: proposal.updatedAt })) },
    { name: "proposal_versions", rows: workspaceSeed.proposalVersions.map(version => ({ id: version.id, proposal_id: version.proposalId, version_number: version.versionNumber, relationship_type: version.relationshipType, role_title: version.roleTitle, responsibilities: version.responsibilities, weekly_time_commitment: version.weeklyTimeCommitment, start_date: version.startDate, full_time_trigger: version.fullTimeTrigger, ceo_decision: version.ceoDecision, trial_scope: version.trialScope, trial_ip_handling: version.trialIpHandling, cash_compensation: version.cashCompensation, equity: version.equity, vesting_schedule: version.vestingSchedule, cliff: version.cliff, decision_rights: version.decisionRights, ip_assignment_required: version.ipAssignmentRequired, confidentiality: version.confidentiality, exit_terms: version.exitTerms, notes: version.notes, summary: version.summary, created_by_user_id: version.createdByUserId, created_at: version.createdAt })) },
    { name: "proposal_comments", rows: workspaceSeed.proposalComments.map(comment => ({ id: comment.id, proposal_id: comment.proposalId, proposal_version_id: comment.proposalVersionId, author_user_id: comment.authorUserId, section: comment.section, body: comment.body, created_at: comment.createdAt })) },
    { name: "contracts", rows: workspaceSeed.contracts.map(contract => ({ id: contract.id, proposal_id: contract.proposalId, title: contract.title, status: contract.status, current_version_id: contract.currentVersionId, disclaimer_acknowledged: contract.disclaimerAcknowledged, created_at: contract.createdAt, updated_at: contract.updatedAt })) },
    { name: "contract_versions", rows: workspaceSeed.contractVersions.map(version => ({ id: version.id, contract_id: version.contractId, version_number: version.versionNumber, parties: version.parties, role_title: version.roleTitle, scope: version.scope, time_commitment: version.timeCommitment, compensation: version.compensation, equity: version.equity, vesting: version.vesting, ip_assignment: version.ipAssignment, confidentiality: version.confidentiality, decision_making: version.decisionMaking, termination: version.termination, dispute_resolution: version.disputeResolution, notes: version.notes, generated_from_proposal_version_id: version.generatedFromProposalVersionId, created_at: version.createdAt })) },
    { name: "signatures", rows: workspaceSeed.signatures.map(signature => ({ id: signature.id, contract_id: signature.contractId, contract_version_id: signature.contractVersionId, user_id: signature.userId, typed_name: signature.typedName, signed_at: signature.signedAt })) },
    { name: "trial_collaborations", rows: workspaceSeed.trialCollaborations.map(trial => ({ id: trial.id, match_id: trial.matchId, created_by_user_id: trial.createdByUserId, title: trial.title, objective: trial.objective, scope: trial.scope, weekly_hours: trial.weeklyHours, duration_weeks: trial.durationWeeks, check_in_cadence: trial.checkInCadence, deliverables: trial.deliverables, success_signals: trial.successSignals, status: trial.status, acknowledged_by_user_ids: trial.acknowledgedByUserIds, next_check_in_at: trial.nextCheckInAt, created_at: trial.createdAt, updated_at: trial.updatedAt })) },
    { name: "subscriptions", rows: workspaceSeed.subscriptions.map(subscription => ({ id: subscription.id, user_id: subscription.userId, plan: subscription.plan, status: subscription.status, billing_cycle: subscription.billingCycle, renews_at: subscription.renewsAt, cancel_at_period_end: subscription.cancelAtPeriodEnd, visibility_boost: subscription.visibilityBoost, unlimited_messaging: subscription.unlimitedMessaging, proposal_workflow: subscription.proposalWorkflow, contract_builder: subscription.contractBuilder, stripe_customer_id: subscription.stripeCustomerId || null, stripe_subscription_id: subscription.stripeSubscriptionId || null, stripe_price_id: subscription.stripePriceId || null, stripe_checkout_session_id: subscription.stripeCheckoutSessionId || null, stripe_current_period_end: subscription.stripeCurrentPeriodEnd || null, stripe_status: subscription.stripeStatus || null })) },
    { name: "reports", rows: workspaceSeed.reports.map(report => ({ id: report.id, reporter_user_id: report.reporterUserId, target_type: report.targetType, target_id: report.targetId, reason: report.reason, priority: report.priority, details: report.details, status: report.status, review_notes: report.reviewNotes, reviewed_at: report.reviewedAt, reviewed_by_user_id: report.reviewedByUserId, resolution_notes: report.resolutionNotes, resolved_at: report.resolvedAt, resolved_by_user_id: report.resolvedByUserId, created_at: report.createdAt })) },
    { name: "admin_actions", rows: workspaceSeed.adminActions.map(action => ({ id: action.id, admin_user_id: action.adminUserId, type: action.type, target_id: action.targetId, target_type: action.targetType, notes: action.notes, created_at: action.createdAt })) },
    { name: "investment_applications", rows: workspaceSeed.investmentApplications.map(application => ({ id: application.id, opportunity_id: application.opportunityId, applicant_user_id: application.applicantUserId, status: application.status, raise_amount: application.raiseAmount, traction: application.traction, deck_link: application.deckLink, team_summary: application.teamSummary, reason: application.reason, created_at: application.createdAt })) },
    { name: "notifications", rows: workspaceSeed.notifications.map(notification => ({ id: notification.id, user_id: notification.userId, type: notification.type, title: notification.title, body: notification.body, href: notification.href, read_at: notification.readAt, created_at: notification.createdAt })) },
    { name: "file_uploads", rows: workspaceSeed.fileUploads.map(file => ({ id: file.id, owner_user_id: file.ownerUserId, bucket: file.bucket, object_path: file.objectPath, original_filename: file.originalFilename, mime_type: file.mimeType, size_bytes: file.sizeBytes, purpose: file.purpose, related_type: file.relatedType, related_id: file.relatedId, status: file.status, scan_status: file.scanStatus, scan_notes: file.scanNotes, created_at: file.createdAt, updated_at: file.updatedAt, deleted_at: file.deletedAt })) },
    { name: "saved_searches", rows: workspaceSeed.savedSearches.map(search => ({ id: search.id, user_id: search.userId, label: search.label, scope: search.scope, filters: search.filters, created_at: search.createdAt })) },
  ]
}

async function seedSupabase() {
  const publicEnvironment = readPublicEnvironment(process.env)
  const secretEnvironment = readSecretEnvironment(process.env)
  const supabaseUrl = publicEnvironment.supabaseUrl
  const serviceRoleKey = secretEnvironment.supabaseServiceRoleKey

  if (!supabaseUrl || !serviceRoleKey) {
    if (publicEnvironment.backendMode === "supabase") {
      throw new Error(formatEnvironmentValidationError(process.env, "seed script") || "Supabase mode is enabled but the seed script is missing required Supabase environment variables.")
    }

    console.log("Supabase credentials not found. Local mock seed is ready and no remote writes were attempted.")
    return
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  })

  if (process.env.SEED_SUPABASE_AUTH !== "false") {
    for (const account of workspaceSeed.authAccounts) {
      const result = await supabase.auth.admin.createUser({
        email: account.email,
        password: account.password,
        email_confirm: true,
      })

      if (result.error && !result.error.message.toLowerCase().includes("already"))
        throw result.error
    }
  }

  for (const table of mapTables()) {
    if (!table.rows.length)
      continue

    const { error } = await supabase
      .from(table.name)
      .upsert(table.rows, { onConflict: table.onConflict || "id" })

    if (error)
      throw error

    console.log(`Seeded ${table.rows.length} row(s) into ${table.name}`)
  }
}

async function main() {
  await writeLocalSeedSnapshot()
  await seedSupabase()
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
