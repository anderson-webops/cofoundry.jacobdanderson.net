import { describe, expect, it } from "vitest"
import { accessRequestSchema, adminAccessInviteSchema, adminAccessRequestStatusSchema, adminCommandQueueActionSchema, adminOpportunityVerificationSchema, adminReportStatusSchema, adminUserModerationSchema, adminUserRoleSchema, billingCheckoutSchema, contactSchema, minimumOnboardingSchema, onboardingSchema, operationsBackupRunSchema, operationsContractEnvelopeSchema, operationsDigestRunSchema, operationsEmailSuppressionSchema, operationsEventSchema, operationsTrustVerificationSchema, opportunitySchema, privacyRequestSchema, proposalSchema, reportSchema, signUpSchema } from "../../shared/utils/validation"

describe("validation schemas", () => {
  it("accepts a valid sign-up payload", () => {
    const result = signUpSchema.safeParse({
      name: "Olivia Chen",
      email: "olivia@cofoundry.dev",
      inviteToken: "invite_token_12345678901234567890",
      password: "founder123",
    })

    expect(result.success).toBe(true)
  })

  it("accepts access-request and admin invite payloads", () => {
    const request = accessRequestSchema.safeParse({
      company: "LedgerLoop",
      companyStage: "prototype",
      email: "olivia@cofoundry.dev",
      name: "Olivia Chen",
      role: "founder",
      source: "auth-sign-up",
      timeline: "30_days",
      useCase: "I need a structured workspace to evaluate cofounder fit, document proposal terms, and move to agreement.",
      website: "",
    })
    const status = adminAccessRequestStatusSchema.safeParse({
      notes: "Approved after workspace fit review.",
      status: "approved",
    })
    const invite = adminAccessInviteSchema.safeParse({
      notes: "Issued invite after access review.",
    })

    expect(request.success).toBe(true)
    expect(status.success).toBe(true)
    expect(invite.success).toBe(true)
  })

  it("accepts admin command queue action payloads", () => {
    const valid = adminCommandQueueActionSchema.safeParse({
      action: "assign",
      assignedAdminUserId: "user_priya",
      notes: "Claimed this command queue case for review.",
      targetId: "report_3",
      targetType: "report",
    })
    const escalation = adminCommandQueueActionSchema.safeParse({
      action: "escalate",
      escalationQueue: "trust_safety",
      notes: "Escalated this case to trust and safety for priority operator review.",
      targetId: "report_3",
      targetType: "report",
    })
    const fileUploadReview = adminCommandQueueActionSchema.safeParse({
      action: "review_evidence",
      notes: "Reviewed the trust evidence package and recorded the operator decision.",
      targetId: "file_trust_olivia_linkedin",
      targetType: "file_upload",
    })
    const opportunityReview = adminCommandQueueActionSchema.safeParse({
      action: "review_evidence",
      notes: "Reviewed the opportunity ownership evidence and recorded the operator decision.",
      targetId: "opp_ledgerloop",
      targetType: "opportunity",
    })
    const invalid = adminCommandQueueActionSchema.safeParse({
      action: "assign",
      notes: "short",
      targetId: "",
      targetType: "user",
    })

    expect(valid.success).toBe(true)
    expect(escalation.success).toBe(true)
    expect(fileUploadReview.success).toBe(true)
    expect(opportunityReview.success).toBe(true)
    expect(invalid.success).toBe(false)
  })

  it("accepts operator opportunity-verification decisions but not pending review as a decision", () => {
    const valid = adminOpportunityVerificationSchema.safeParse({
      notes: "Verified the startup domain against submitted evidence.",
      status: "domain_verified",
    })
    const invalid = adminOpportunityVerificationSchema.safeParse({
      notes: "Leaving this in review should not be a resolution.",
      status: "manual_review",
    })

    expect(valid.success).toBe(true)
    expect(invalid.success).toBe(false)
  })

  it("rejects contact submissions without enough detail", () => {
    const result = contactSchema.safeParse({
      name: "OC",
      email: "olivia@cofoundry.dev",
      company: "LedgerLoop",
      subject: "Hi",
      message: "Too short",
    })

    expect(result.success).toBe(false)
  })

  it("accepts filled public-form honeypot fields so routes can silently drop bot submissions", () => {
    const contact = contactSchema.safeParse({
      company: "LedgerLoop",
      email: "olivia@cofoundry.dev",
      message: "I need help evaluating whether CoFoundry can support a founder matching workflow for structured proposals.",
      name: "Olivia Chen",
      subject: "Workspace access",
      website: "https://bot-filled.example",
    })
    const accessRequest = accessRequestSchema.safeParse({
      company: "LedgerLoop",
      companyStage: "prototype",
      email: "olivia@cofoundry.dev",
      name: "Olivia Chen",
      role: "founder",
      source: "auth-sign-up",
      timeline: "30_days",
      useCase: "I need a structured workspace to evaluate cofounder fit, document proposal terms, and move to agreement.",
      website: "https://bot-filled.example",
    })

    expect(contact.success).toBe(true)
    expect(accessRequest.success).toBe(true)
  })

  it("requires structured onboarding data", () => {
    const result = onboardingSchema.safeParse({
      displayName: "Malik Thompson",
      photoUrl: "https://example.com/malik.jpg",
      headline: "Staff engineer building a long-term company with a serious founder.",
      bio: "I want a high-trust founder partnership with clear customer access, strong judgment, and enough detail to evaluate fit well.",
      location: "Austin, TX",
      remotePreference: "remote",
      primaryRole: "Technical Co-Founder",
      roles: ["Technical Co-Founder"],
      yearsExperience: 9,
      industries: ["Fintech"],
      startupStagePreferences: ["idea"],
      compensationPreferences: ["equity_only"],
      equityExpectationRange: "15% - 30%",
      timeCommitment: "full_time",
      weeklyAvailabilityHours: 45,
      startTimeline: "30_days",
      fullTimeBy: "2026-06-01",
      runwayBucket: "6_to_12_months",
      currentStatus: "full_time_employed",
      equityPhilosophy: "contribution_weighted",
      leadershipPreference: "open_to_ceo_role",
      decisionModelPreference: "area_owner_decides",
      deadlockPreference: "advisor_tiebreaker",
      companyPreferences: ["Developer tools"],
      nonNegotiables: ["Need clear decision rights"],
      introCapacity: "One strong founder match this month.",
      nonResponsibilities: ["I do not want to own sales alone."],
      accountabilityMilestones: ["Ship the first production system."],
      existingAssets: ["Architecture notes"],
      existingAssetsNotes: "I may bring system design notes but not employer-owned code.",
      priorObligations: "possible_constraints",
      readyToAssignIp: true,
      linkedin: "https://linkedin.com/in/malikthompson",
      github: "https://github.com/malikthompson",
      portfolio: "",
      website: "https://malik.dev",
      hasIdea: false,
      wantsToJoinIdea: true,
      values: ["Candor"],
      workStylePreferences: ["Async updates"],
      profileVisibility: "members",
    })

    expect(result.success).toBe(true)
  })

  it("requires proposal responsibilities and narrative sections", () => {
    const result = proposalSchema.safeParse({
      relationshipType: "cofounder",
      roleTitle: "CTO",
      responsibilities: ["Architecture"],
      weeklyTimeCommitment: 45,
      startDate: "2026-05-01",
      fullTimeTrigger: "Once we confirm the first paying pilot and both founders commit full-time.",
      ceoDecision: "Founder remains CEO and final company-level decision-maker.",
      trialScope: "Ship one real workflow slice together and review how the working relationship felt.",
      trialIpHandling: "Trial artifacts stay confidential and transfer only through signed company docs.",
      cashCompensation: "$0 until funding",
      equity: "20%",
      vestingSchedule: "4 years",
      cliff: "1 year",
      decisionRights: "Product",
      ipAssignmentRequired: true,
      confidentiality: "Keep secrets",
      exitTerms: "We will discuss later",
      notes: "Short",
    })

    expect(result.success).toBe(false)
  })

  it("defaults billing interval to monthly", () => {
    const result = billingCheckoutSchema.parse({
      plan: "pro",
    })

    expect(result.interval).toBe("monthly")
  })

  it("accepts trust metadata on opportunity creation", () => {
    const result = opportunitySchema.safeParse({
      startupName: "LedgerLoop",
      oneLinePitch: "Compliance workflow software for fast-moving fintech teams.",
      problem: "Compliance review still lives across spreadsheets, email, and internal tickets, which slows launches and burns expensive operator time.",
      targetUsers: "Fintech operations and compliance teams at startups with 15 to 300 employees.",
      stage: "prototype",
      traction: "Three design partners, one pilot scheduled, and strong founder-introduced pipeline.",
      expectedCommitment: "full_time",
      compensationStructure: "cash_and_equity",
      equityRange: "15% - 30%",
      location: "New York, NY",
      remotePreference: "hybrid",
      officialWebsite: "https://ledgerloop.co",
      verificationMethod: "domain",
      industries: ["Fintech"],
      rolesNeeded: ["Technical Co-Founder"],
    })

    expect(result.success).toBe(true)
  })

  it("accepts the shorter minimum onboarding payload", () => {
    const result = minimumOnboardingSchema.safeParse({
      intentMode: "join",
      displayName: "Malik Thompson",
      photoUrl: "https://example.com/malik.jpg",
      headline: "Technical co-founder looking for a serious workflow software founder.",
      bio: "I want to join a technical, high-trust founding team where customer access and decision rights are clear from day one.",
      location: "Austin, TX",
      remotePreference: "remote",
      primaryRole: "Technical Co-Founder",
      roles: ["Technical Co-Founder"],
      industries: ["Developer Tools"],
      timeCommitment: "full_time",
      weeklyAvailabilityHours: 45,
      startTimeline: "30_days",
      fullTimeBy: "2026-06-01",
      runwayBucket: "6_to_12_months",
      equityPhilosophy: "contribution_weighted",
      companyPreferences: ["Workflow software"],
      profileVisibility: "members",
    })

    expect(result.success).toBe(true)
  })

  it("requires enough detail in safety reports", () => {
    const result = reportSchema.safeParse({
      reason: "impersonation",
      details: "Asked me to move the chat to WhatsApp and pay a diligence fee.",
    })

    expect(result.success).toBe(true)
  })

  it("accepts admin moderation payloads with short notes", () => {
    const userAction = adminUserModerationSchema.safeParse({
      action: "suspend",
      notes: "Suspended after manual review.",
    })

    const reportAction = adminReportStatusSchema.safeParse({
      status: "reviewed",
      notes: "Reviewed and queued for follow-up.",
    })

    expect(userAction.success).toBe(true)
    expect(reportAction.success).toBe(true)
  })

  it("accepts audited admin role changes", () => {
    const roleAction = adminUserRoleSchema.safeParse({
      notes: "Promoted after operator review.",
      role: "admin",
    })

    expect(roleAction.success).toBe(true)
  })

  it("requires useful detail for privacy requests", () => {
    const valid = privacyRequestSchema.safeParse({
      details: "Please delete my account and confirm whether any legal hold applies.",
      type: "account_deletion",
    })
    const invalid = privacyRequestSchema.safeParse({
      details: "Delete it.",
      type: "account_deletion",
    })

    expect(valid.success).toBe(true)
    expect(invalid.success).toBe(false)
  })

  it("accepts operations worker payloads", () => {
    const digestRun = operationsDigestRunSchema.parse({})
    const backupRun = operationsBackupRunSchema.safeParse({
      artifactUri: "s3://cofoundry-backups/prod/2026-04-29.sql.gz",
      completedAt: "2026-04-29T04:10:00.000Z",
      metadata: { bytes: 1024 },
      provider: "supabase-pg-dump",
      startedAt: "2026-04-29T04:00:00.000Z",
      status: "succeeded",
    })
    const operationalEvent = operationsEventSchema.safeParse({
      eventType: "backup.completed",
      metadata: { runId: "backup-20260429" },
      severity: "info",
      source: "systemd-timer",
    })
    const suppression = operationsEmailSuppressionSchema.safeParse({
      category: "digest",
      email: "Suppressed@Example.com",
      metadata: { providerType: "complaint" },
      provider: "postmark",
      reason: "complaint",
      sourceEventId: "provider-event-1",
      suppressedAt: "2026-04-29T05:00:00.000Z",
    })
    const contractEnvelope = operationsContractEnvelopeSchema.safeParse({
      completedPdfFileUploadId: "upload_completed_pdf",
      completedPdfSha256: "a".repeat(64),
      contractId: "contract_ledgerloop",
      contractVersionId: "contract_ledgerloop_version_1",
      metadata: { providerStatus: "completed" },
      occurredAt: "2026-04-29T06:00:00.000Z",
      provider: "docusign",
      providerEnvelopeId: "envelope_123",
      signedByUserIds: ["user_olivia", "user_malik"],
      sourceEventId: "provider-envelope-event-1",
      status: "completed",
    })
    const trustVerification = operationsTrustVerificationSchema.safeParse({
      confidence: 0.94,
      evidenceFileUploadId: "upload_trust_evidence",
      metadata: { providerResult: "domain_match" },
      occurredAt: "2026-04-29T07:00:00.000Z",
      provider: "veriff",
      providerSubjectId: "provider-subject-1",
      sourceEventId: "provider-trust-event-1",
      status: "verified",
      targetId: "profile_user_olivia",
      targetType: "profile",
      verificationType: "government_id",
    })

    expect(digestRun).toEqual({
      dryRun: false,
      maxUsers: 100,
      onlyWithUnread: true,
    })
    expect(backupRun.success).toBe(true)
    expect(operationalEvent.success).toBe(true)
    expect(suppression).toMatchObject({
      data: {
        email: "suppressed@example.com",
      },
      success: true,
    })
    expect(contractEnvelope.success).toBe(true)
    expect(trustVerification.success).toBe(true)
  })
})
