import { z } from "zod"

const honeypotSchema = z
  .string()
  .trim()
  .max(500, "Honeypot content is too long.")
  .optional()
  .or(z.literal(""))
const identifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[\w-]+$/, "Use a valid identifier.")
const boundedText = (maximum = 500) => z.string().trim().max(maximum)
function boundedTextArray(maximumItems = 30, maximumLength = 160) {
  return z.array(boundedText(maximumLength)).max(maximumItems)
}
const boundedMetadataSchema = z
  .record(z.string().trim().min(1).max(120), z.unknown())
  .superRefine((value, context) => {
    if (Object.keys(value).length > 50) {
      context.addIssue({
        code: "custom",
        message: "Metadata may contain at most 50 fields.",
      })
    }

    try {
      if (JSON.stringify(value).length > 16_384) {
        context.addIssue({
          code: "custom",
          message: "Metadata is too large.",
        })
      }
    }
    catch {
      context.addIssue({
        code: "custom",
        message: "Metadata must be JSON serializable.",
      })
    }
  })
const safeHttpUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => {
    if (!value) return true

    try {
      const url = new URL(value)
      return ["http:", "https:"].includes(url.protocol)
        && Boolean(url.hostname)
        && !url.username
        && !url.password
    }
    catch {
      return false
    }
  }, "Only HTTP or HTTPS URLs are allowed.")
const accessInviteTokenSchema = z
  .string()
  .trim()
  .regex(/^[\w-]{43}$/, "Invite token is invalid.")

export const signInSchema = z
  .object({
    email: z.string().trim().email("Enter a valid email address.").max(254),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .max(256),
  })
  .strict()

export const signUpSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your full name.").max(120),
    email: z.string().trim().email("Enter a valid email address.").max(254),
    inviteToken: accessInviteTokenSchema.optional(),
    password: z
      .string()
      .min(12, "Password must be at least 12 characters.")
      .max(256),
  })
  .strict()

export const oauthSignInSchema = z
  .object({
    provider: z.enum(["google", "github"]),
  })
  .strict()

export const accessRequestSchema = z
  .object({
    company: z
      .string()
      .trim()
      .max(120, "Keep the company or project name concise.")
      .optional()
      .or(z.literal("")),
    companyStage: z.enum([
      "idea",
      "prototype",
      "mvp",
      "revenue",
      "growth",
      "not_sure",
    ]),
    email: z.string().trim().email("Enter a valid email.").max(254),
    name: z.string().trim().min(2, "Enter your name.").max(120),
    role: z.enum(["founder", "collaborator", "studio", "investor", "other"]),
    source: z.string().trim().max(120).optional().or(z.literal("")),
    timeline: z.enum(["now", "30_days", "90_days", "exploring"]),
    useCase: z
      .string()
      .trim()
      .min(40, "Add enough detail for an admin to evaluate the request.")
      .max(1600, "Keep the request focused."),
    website: honeypotSchema,
  })
  .strict()

export const adminAccessRequestStatusSchema = z
  .object({
    expectedUpdatedAt: z.string().datetime("Refresh the access request before updating it."),
    notes: z
      .string()
      .trim()
      .min(8, "Add a short admin note.")
      .max(1000, "Keep the admin note concise."),
    status: z.enum(["open", "approved", "denied"]),
  })
  .strict()

export const adminAccessInviteSchema = z
  .object({
    expectedUpdatedAt: z.string().datetime("Refresh the access request before issuing an invite."),
    notes: z
      .string()
      .trim()
      .min(8, "Add a short invite note.")
      .max(1000, "Keep the invite note concise."),
  })
  .strict()

export const accessInviteValidationSchema = z
  .object({
    email: z.string().trim().email().max(254),
    token: accessInviteTokenSchema,
  })
  .strict()

export const contactSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your name.").max(120),
    email: z.string().trim().email("Enter a valid email.").max(254),
    company: z.string().trim().max(160).optional(),
    subject: z.string().trim().min(3, "Add a short subject.").max(240),
    message: z
      .string()
      .trim()
      .min(20, "Please include enough detail for us to help.")
      .max(8000),
    website: honeypotSchema,
  })
  .strict()

export const minimumOnboardingSchema = z
  .object({
    intentMode: z.enum(["start", "join", "explore"]),
    displayName: boundedText(120).min(2, "Name is required."),
    photoUrl: safeHttpUrlSchema.refine(
      value => Boolean(value),
      "Add a valid profile photo URL.",
    ),
    headline: boundedText(240).min(10, "Write a clearer one-line summary."),
    bio: boundedText(5000).min(
      40,
      "Describe what you want to build or join with enough detail to evaluate fit.",
    ),
    location: boundedText(160).min(2, "Location is required."),
    remotePreference: z.enum(["remote", "hybrid", "in_person"]),
    primaryRole: boundedText(120).min(
      2,
      "Choose the main role you want to be evaluated for.",
    ),
    roles: boundedTextArray(20, 120).min(1, "Choose at least one role."),
    industries: boundedTextArray(30, 120).min(
      1,
      "Choose at least one industry.",
    ),
    timeCommitment: z.enum(["nights_weekends", "part_time", "full_time"]),
    weeklyAvailabilityHours: z.number().min(1).max(80),
    startTimeline: z.enum(["immediately", "30_days", "90_days", "exploring"]),
    fullTimeBy: boundedText(120).min(
      1,
      "Add the date by which this would need to become a full-time decision.",
    ),
    runwayBucket: z.enum([
      "under_3_months",
      "3_to_6_months",
      "6_to_12_months",
      "12_plus_months",
      "undisclosed",
    ]),
    equityPhilosophy: z.enum([
      "equal_unless_strong_reason",
      "contribution_weighted",
      "dynamic_over_time",
    ]),
    companyPreferences: boundedTextArray(30, 160).min(
      1,
      "Choose at least one company preference.",
    ),
    profileVisibility: z.enum(["public", "members", "private"]),
  })
  .strict()

export const onboardingSchema = z
  .object({
    displayName: boundedText(120).min(2, "Name is required."),
    photoUrl: safeHttpUrlSchema.refine(
      value => Boolean(value),
      "Add a valid profile photo URL.",
    ),
    headline: boundedText(240).min(10, "Write a clearer headline."),
    bio: boundedText(5000).min(
      60,
      "Tell people enough to understand your background.",
    ),
    location: boundedText(160).min(2, "Location is required."),
    remotePreference: z.enum(["remote", "hybrid", "in_person"]),
    primaryRole: boundedText(120).min(2, "Choose your primary role."),
    roles: boundedTextArray(20, 120).min(1, "Choose at least one role."),
    yearsExperience: z.number().min(0).max(40),
    industries: boundedTextArray(30, 120).min(
      1,
      "Choose at least one industry.",
    ),
    startupStagePreferences: z
      .array(z.enum(["idea", "prototype", "mvp", "revenue", "growth"]))
      .min(1, "Choose at least one stage."),
    compensationPreferences: z
      .array(
        z.enum(["equity_only", "cash_and_equity", "cash_only", "advisory"]),
      )
      .min(1, "Choose at least one compensation preference."),
    equityExpectationRange: boundedText(160).min(
      2,
      "Equity expectation is required.",
    ),
    timeCommitment: z.enum(["nights_weekends", "part_time", "full_time"]),
    weeklyAvailabilityHours: z.number().min(1).max(80),
    startTimeline: z.enum(["immediately", "30_days", "90_days", "exploring"]),
    fullTimeBy: boundedText(120).min(1, "Add a full-time target date."),
    runwayBucket: z.enum([
      "under_3_months",
      "3_to_6_months",
      "6_to_12_months",
      "12_plus_months",
      "undisclosed",
    ]),
    currentStatus: z.enum([
      "full_time_employed",
      "consulting_part_time",
      "between_roles",
      "full_time_on_startup",
      "exploring",
    ]),
    equityPhilosophy: z.enum([
      "equal_unless_strong_reason",
      "contribution_weighted",
      "dynamic_over_time",
    ]),
    leadershipPreference: z.enum([
      "wants_ceo_role",
      "open_to_ceo_role",
      "prefers_non_ceo_role",
    ]),
    decisionModelPreference: z.enum([
      "ceo_decides_with_input",
      "area_owner_decides",
      "consensus_for_big_bets",
    ]),
    deadlockPreference: z.enum([
      "advisor_tiebreaker",
      "rotating_decider",
      "board_mediator",
      "neutral_operator",
    ]),
    companyPreferences: boundedTextArray(30, 160).min(
      1,
      "Choose at least one company preference.",
    ),
    nonNegotiables: boundedTextArray(30, 500).min(
      1,
      "Choose at least one non-negotiable.",
    ),
    introCapacity: boundedText(500).min(
      6,
      "State how many conversations you can support right now.",
    ),
    nonResponsibilities: boundedTextArray(30, 500).min(
      1,
      "State at least one thing you do not want to own in the first year.",
    ),
    accountabilityMilestones: boundedTextArray(30, 500).min(
      1,
      "Add at least one accountability milestone.",
    ),
    existingAssets: boundedTextArray(30, 500).min(
      1,
      "Declare whether there is any pre-existing code, design, data, or domain ownership in play.",
    ),
    existingAssetsNotes: boundedText(3000).min(
      12,
      "Add enough detail for a future proposal or counsel review.",
    ),
    priorObligations: z.enum([
      "none_known",
      "possible_constraints",
      "confirmed_constraints",
    ]),
    readyToAssignIp: z.boolean(),
    linkedin: safeHttpUrlSchema,
    github: safeHttpUrlSchema,
    portfolio: safeHttpUrlSchema,
    website: safeHttpUrlSchema,
    hasIdea: z.boolean(),
    wantsToJoinIdea: z.boolean(),
    values: boundedTextArray(30, 160).min(1, "Add at least one value."),
    workStylePreferences: boundedTextArray(30, 160).min(
      1,
      "Add at least one work-style preference.",
    ),
    profileVisibility: z.enum(["public", "members", "private"]),
  })
  .strict()

export const opportunitySchema = z
  .object({
    startupName: boundedText(160).min(2, "Startup name is required."),
    oneLinePitch: boundedText(500).min(12, "Write a clearer one-line pitch."),
    problem: boundedText(5000).min(50, "Describe the problem in more detail."),
    targetUsers: boundedText(3000).min(20, "Describe the target users."),
    stage: z.enum(["idea", "prototype", "mvp", "revenue", "growth"]),
    traction: boundedText(5000).min(20, "Add concrete traction or evidence."),
    expectedCommitment: z.enum(["nights_weekends", "part_time", "full_time"]),
    compensationStructure: z.enum([
      "equity_only",
      "cash_and_equity",
      "cash_only",
      "advisory",
    ]),
    equityRange: boundedText(160).min(2, "Equity range is required."),
    location: boundedText(160).min(2, "Location is required."),
    remotePreference: z.enum(["remote", "hybrid", "in_person"]),
    officialWebsite: safeHttpUrlSchema,
    verificationMethod: z.enum(["none", "work_email", "domain", "github_org"]),
    industries: boundedTextArray(30, 120).min(1, "Add at least one industry."),
    rolesNeeded: boundedTextArray(30, 160).min(1, "Add at least one role."),
  })
  .strict()

export const proposalSchema = z
  .object({
    relationshipType: z.enum(["cofounder", "founding_team", "advisor"]),
    roleTitle: boundedText(160).min(2, "Role title is required."),
    responsibilities: boundedTextArray(30, 500).min(
      2,
      "Add at least two concrete responsibilities.",
    ),
    weeklyTimeCommitment: z.number().min(1).max(80),
    startDate: boundedText(80).min(1, "Start date is required."),
    fullTimeTrigger: boundedText(2000).min(
      10,
      "Explain what turns this into a full-time commitment.",
    ),
    ceoDecision: boundedText(2000).min(
      10,
      "Explain how the CEO / lead operator decision works.",
    ),
    trialScope: boundedText(3000).min(
      12,
      "Define the work trial before long-term terms lock in.",
    ),
    trialIpHandling: boundedText(3000).min(
      12,
      "Explain what happens to trial work if the relationship ends.",
    ),
    cashCompensation: boundedText(1000).min(2, "Describe the cash terms."),
    equity: boundedText(1000).min(2, "Describe the equity terms."),
    vestingSchedule: boundedText(1000).min(2, "Describe the vesting schedule."),
    cliff: boundedText(1000).min(2, "Describe the cliff."),
    decisionRights: boundedText(3000).min(
      10,
      "Explain how decision rights work.",
    ),
    ipAssignmentRequired: z.boolean(),
    confidentiality: boundedText(3000).min(
      10,
      "Explain confidentiality expectations.",
    ),
    exitTerms: boundedText(3000).min(10, "Explain exit terms."),
    notes: boundedText(3000).min(10, "Include additional context."),
  })
  .strict()

export const contractSignatureSchema = z.object({
  typedName: boundedText(160).min(2, "Type your full name to sign."),
}).strict()

export const contractVersionSchema = z
  .object({
    roleTitle: boundedText(240).min(3, "Agreement title is required."),
    scope: boundedText(8000).min(20, "Describe the agreement scope in more detail."),
    timeCommitment: boundedText(3000).min(10, "Describe the time commitment."),
    compensation: boundedText(3000).min(2, "Describe the compensation terms."),
    equity: boundedText(3000).min(2, "Describe the equity terms."),
    vesting: boundedText(3000).min(5, "Describe the vesting and cliff terms."),
    ipAssignment: boundedText(5000).min(10, "Describe the IP assignment terms."),
    confidentiality: boundedText(5000).min(10, "Describe the confidentiality terms."),
    decisionMaking: boundedText(5000).min(10, "Describe decision-making responsibilities."),
    termination: boundedText(5000).min(10, "Describe termination and off-ramp terms."),
    disputeResolution: boundedText(5000).min(10, "Describe the dispute-resolution process."),
    notes: boundedText(5000).min(10, "Summarize this revision and any remaining context."),
  })
  .strict()

export const contractLegalReviewRequestSchema = z
  .object({
    reviewerType: z.enum(["in_house_counsel", "outside_counsel"]),
    reviewerName: boundedText(160).min(2, "Reviewer name is required."),
    reviewerEmail: z.string().trim().email("Enter a valid reviewer email address.").max(254),
    reviewerOrganization: boundedText(240).min(2, "Organization or firm is required."),
    scope: z
      .array(z.enum(["full_agreement", "equity_vesting", "ip_confidentiality", "governance", "employment_tax", "formation"]))
      .min(1, "Choose at least one review area.")
      .max(6),
    message: boundedText(3000).min(10, "Add enough context for the reviewer."),
    shareAuthorized: z.literal(true, {
      error: "Confirm that you are authorized to share this agreement with the reviewer.",
    }),
  })
  .strict()

export const contractLegalReviewResponseSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("open") }).strict(),
  z
    .object({
      action: z.literal("respond"),
      authorityConfirmed: z.literal(true, {
        error: "Confirm that you are authorized to respond for the named reviewer or organization.",
      }),
      response: boundedText(5000).min(20, "Provide enough detail for the parties to act on the review."),
      respondedByName: boundedText(160).min(2, "Type your name as the person recording this response."),
      status: z.enum(["approved", "changes_requested"]),
    })
    .strict(),
])

const connectRequestPayloadSchema = z
  .object({
    note: boundedText(2000),
    structuredIntro: z
      .object({
        context: z.enum(["profile", "opportunity"]),
        roleContext: boundedText(240).min(2),
        whyFit: boundedText(2000).min(10),
        whyNow: boundedText(2000).min(10),
        proposedNextStep: z.enum([
          "intro_call",
          "working_session",
          "trial_sprint",
          "async_exchange",
        ]),
      })
      .strict(),
  })
  .strict()

export const collaborationMutationSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("send_connect_request"),
      payload: connectRequestPayloadSchema,
      toUserId: identifierSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("respond_connect_request"),
      declineReason: z
        .enum([
          "timing",
          "domain_mismatch",
          "commitment_mismatch",
          "values_mismatch",
          "role_mismatch",
        ])
        .nullable()
        .optional(),
      requestId: identifierSchema,
      status: z.enum(["accepted", "declined"]),
    })
    .strict(),
  z
    .object({
      action: z.literal("send_message"),
      attachments: z
        .array(z.never())
        .max(0, "Use the secure upload workflow for attachments.")
        .optional(),
      body: boundedText(8000).min(1),
      conversationId: identifierSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("mark_conversation_read"),
      conversationId: identifierSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("create_proposal"),
      conversationId: identifierSchema,
      opportunityId: identifierSchema.nullable(),
      payload: proposalSchema,
      recipientUserId: identifierSchema,
      title: boundedText(240).min(3),
    })
    .strict(),
  z
    .object({
      action: z.literal("update_proposal_status"),
      proposalId: identifierSchema,
      status: z.enum(["viewed", "accepted", "rejected"]),
    })
    .strict(),
  z
    .object({
      action: z.literal("create_proposal_counter_version"),
      payload: proposalSchema,
      proposalId: identifierSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("add_proposal_comment"),
      body: boundedText(4000).min(1),
      proposalId: identifierSchema,
      proposalVersionId: identifierSchema,
      section: z.enum([
        "partnership",
        "scope",
        "trial",
        "economics",
        "decision_rights",
        "ip_confidentiality",
        "exit",
      ]),
    })
    .strict(),
  z
    .object({
      action: z.literal("create_contract_from_proposal"),
      proposalId: identifierSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("update_contract_version"),
      contractId: identifierSchema,
      payload: contractVersionSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("sign_contract"),
      contractId: identifierSchema,
      typedName: boundedText(160).min(2),
    })
    .strict(),
  z
    .object({
      action: z.literal("start_trial"),
      matchId: identifierSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("acknowledge_trial"),
      trialId: identifierSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("add_relationship_decision"),
      body: boundedText(4000).min(1),
      matchId: identifierSchema,
      status: z.enum(["open", "documented"]),
      title: boundedText(240).min(2),
    })
    .strict(),
])

export const profileSearchSchema = z
  .object({
    query: boundedText(500),
    roles: boundedTextArray(30, 120),
    skills: boundedTextArray(50, 120),
    industries: boundedTextArray(30, 120),
  })
  .strict()

export const billingCheckoutSchema = z
  .object({
    plan: z.enum(["pro", "team"]),
    interval: z.enum(["monthly", "annual"]).default("monthly"),
  })
  .strict()

export const billingSubscriptionMutationSchema = z
  .object({
    action: z.enum(["cancel_at_period_end", "resume"]),
  })
  .strict()

export const fileUploadPolicySchema = z
  .object({
    filename: z
      .string()
      .trim()
      .min(1, "Filename is required.")
      .max(180, "Filename is too long."),
    mimeType: z
      .string()
      .trim()
      .min(3, "File type is required.")
      .max(120, "File type is too long."),
    purpose: z.enum([
      "message_attachment",
      "proposal_attachment",
      "contract_attachment",
      "trust_evidence",
    ]),
    relatedType: z
      .enum(["message", "proposal", "contract", "profile", "opportunity"])
      .nullable()
      .optional(),
    relatedId: z.string().trim().min(1).max(120).nullable().optional(),
    sizeBytes: z
      .number()
      .int()
      .positive("File size must be positive.")
      .max(10 * 1024 * 1024, "Files must be 10MB or smaller."),
  })
  .strict()
  .superRefine((payload, context) => {
    if (!payload.relatedType || !payload.relatedId) {
      context.addIssue({
        code: "custom",
        message: "A related workspace record is required for every upload.",
        path: ["relatedId"],
      })
      return
    }

    const validPair
      = (payload.purpose === "message_attachment"
        && payload.relatedType === "message")
      || (payload.purpose === "proposal_attachment"
        && payload.relatedType === "proposal")
      || (payload.purpose === "contract_attachment"
        && payload.relatedType === "contract")
      || (payload.purpose === "trust_evidence"
        && ["profile", "opportunity"].includes(payload.relatedType))

    if (!validPair) {
      context.addIssue({
        code: "custom",
        message: "The upload purpose does not match the related record type.",
        path: ["relatedType"],
      })
    }
  })

export const fileScanResultSchema = z.object({
  notes: z
    .string()
    .trim()
    .max(500, "Scan notes are too long.")
    .nullable()
    .optional(),
  scanStatus: z.enum(["clean", "flagged", "failed", "skipped"]),
}).strict()

export const adminFileScanResultSchema = z.object({
  expectedUpdatedAt: z.string().datetime("Refresh the file record before recording a manual verdict."),
  notes: z
    .string()
    .trim()
    .min(8, "Add a short manual-review note.")
    .max(500, "Keep the manual-review note concise."),
  scanStatus: z.enum(["clean", "flagged"]),
}).strict()

export const operationsBackupRunSchema = z.object({
  artifactUri: z
    .string()
    .trim()
    .max(500, "Artifact URI is too long.")
    .nullable()
    .optional(),
  completedAt: z
    .string()
    .datetime("Use an ISO timestamp.")
    .nullable()
    .optional(),
  id: z.string().trim().min(1).max(120).optional(),
  metadata: boundedMetadataSchema.default({}),
  notes: z
    .string()
    .trim()
    .max(1000, "Backup notes are too long.")
    .nullable()
    .optional(),
  provider: z.string().trim().min(2).max(120).default("external"),
  startedAt: z.string().datetime("Use an ISO timestamp.").optional(),
  status: z.enum(["scheduled", "running", "succeeded", "failed"]),
}).strict()

export const operationsDigestRunSchema = z.object({
  dryRun: z.boolean().default(false),
  maxUsers: z.number().int().min(1).max(200).default(100),
  onlyWithUnread: z.boolean().default(true),
  userId: z.string().trim().min(1).max(120).optional(),
}).strict()

const profileSchema = z
  .object({
    id: identifierSchema,
    userId: identifierSchema,
    displayName: boundedText(120).min(2),
    photoUrl: safeHttpUrlSchema,
    headline: boundedText(240),
    bio: boundedText(5000),
    location: boundedText(160),
    remotePreference: z.enum(["remote", "hybrid", "in_person"]),
    roles: boundedTextArray(20, 120),
    yearsExperience: z.number().int().min(0).max(80),
    industries: boundedTextArray(30, 120),
    startupStagePreferences: z
      .array(z.enum(["idea", "prototype", "mvp", "revenue", "growth"]))
      .max(5),
    compensationPreferences: z
      .array(
        z.enum(["equity_only", "cash_and_equity", "cash_only", "advisory"]),
      )
      .max(4),
    equityExpectationRange: boundedText(160),
    timeCommitment: z.enum(["nights_weekends", "part_time", "full_time"]),
    commitmentProfile: z
      .object({
        weeklyAvailabilityHours: z.number().int().min(0).max(100),
        fullTimeBy: boundedText(120),
        runwayBucket: z.enum([
          "under_3_months",
          "3_to_6_months",
          "6_to_12_months",
          "12_plus_months",
          "undisclosed",
        ]),
        currentStatus: z.enum([
          "full_time_employed",
          "consulting_part_time",
          "between_roles",
          "full_time_on_startup",
          "exploring",
        ]),
      })
      .strict(),
    governancePreferences: z
      .object({
        equityPhilosophy: z.enum([
          "equal_unless_strong_reason",
          "contribution_weighted",
          "dynamic_over_time",
        ]),
        leadershipPreference: z.enum([
          "wants_ceo_role",
          "open_to_ceo_role",
          "prefers_non_ceo_role",
        ]),
        decisionModelPreference: z.enum([
          "ceo_decides_with_input",
          "area_owner_decides",
          "consensus_for_big_bets",
        ]),
        deadlockPreference: z.enum([
          "advisor_tiebreaker",
          "rotating_decider",
          "board_mediator",
          "neutral_operator",
        ]),
      })
      .strict(),
    roleScope: z
      .object({
        primaryRole: boundedText(120),
        nonResponsibilities: boundedTextArray(30, 500),
        accountabilityMilestones: boundedTextArray(30, 500),
      })
      .strict(),
    ipReadiness: z
      .object({
        existingAssets: boundedTextArray(30, 500),
        existingAssetsNotes: boundedText(3000),
        priorObligations: z.enum([
          "none_known",
          "possible_constraints",
          "confirmed_constraints",
        ]),
        readyToAssignIp: z.boolean(),
      })
      .strict(),
    links: z
      .object({
        linkedin: safeHttpUrlSchema,
        github: safeHttpUrlSchema,
        portfolio: safeHttpUrlSchema,
        website: safeHttpUrlSchema,
      })
      .strict(),
    hasIdea: z.boolean(),
    wantsToJoinIdea: z.boolean(),
    values: boundedTextArray(30, 160),
    workStylePreferences: boundedTextArray(30, 160),
    privacy: z
      .object({
        profileVisibility: z.enum(["public", "members", "private"]),
        portfolioVisibility: z.enum(["public", "members", "private"]),
        opportunityVisibility: z.enum(["public", "members", "private"]),
        contactDetailsVisibleToMatchesOnly: z.boolean(),
        contactRevealStage: z.enum([
          "matches",
          "proposal_accepted",
          "contract_generated",
        ]),
      })
      .strict(),
    verificationBadges: z
      .object({
        profileComplete: z.boolean(),
        emailVerified: z.boolean(),
        linkedAccounts: z.boolean(),
      })
      .strict(),
    intent: z
      .object({
        startTimeline: z.enum([
          "immediately",
          "30_days",
          "90_days",
          "exploring",
        ]),
        companyPreferences: boundedTextArray(30, 160),
        nonNegotiables: boundedTextArray(30, 500),
        introCapacity: boundedText(500),
      })
      .strict(),
    trustSignals: z
      .object({
        replyRatePercent: z.number().min(0).max(100),
        medianReplyHours: z.number().min(0).max(8760),
        lastActiveAt: boundedText(80),
        identityVerified: z.boolean(),
        workHistoryVerified: z.boolean(),
        phoneVerified: z.boolean(),
        linkedInVerified: z.boolean(),
        githubVerified: z.boolean(),
        workDomainVerified: z.boolean(),
        websiteVerified: z.boolean(),
        governmentIdVerified: z.boolean(),
        builderProofs: z
          .array(
            z
              .object({
                id: identifierSchema,
                title: boundedText(160),
                summary: boundedText(2000),
                url: safeHttpUrlSchema,
                outcome: boundedText(1000),
              })
              .strict(),
          )
          .max(30),
      })
      .strict(),
    availability: boundedText(500),
    portfolio: z
      .array(
        z
          .object({
            id: identifierSchema,
            name: boundedText(160),
            summary: boundedText(2000),
            url: safeHttpUrlSchema,
            role: boundedText(160),
            outcome: boundedText(1000),
          })
          .strict(),
      )
      .max(30),
    ventures: z
      .array(
        z
          .object({
            id: identifierSchema,
            name: boundedText(160),
            role: boundedText(160),
            stage: z.enum(["idea", "prototype", "mvp", "revenue", "growth"]),
          })
          .strict(),
      )
      .max(30),
    summaryHighlights: boundedTextArray(10, 500),
  })
  .strict()

const opportunityWriteSchema = z
  .object({
    id: identifierSchema,
    ownerUserId: identifierSchema,
    startupName: boundedText(160).min(2),
    slug: boundedText(200),
    oneLinePitch: boundedText(500),
    problem: boundedText(5000),
    targetUsers: boundedText(3000),
    stage: z.enum(["idea", "prototype", "mvp", "revenue", "growth"]),
    traction: boundedText(5000),
    rolesNeeded: boundedTextArray(30, 160),
    expectedCommitment: z.enum(["nights_weekends", "part_time", "full_time"]),
    compensationStructure: z.enum([
      "equity_only",
      "cash_and_equity",
      "cash_only",
      "advisory",
    ]),
    equityRange: boundedText(160),
    industries: boundedTextArray(30, 120),
    location: boundedText(160),
    remotePreference: z.enum(["remote", "hybrid", "in_person"]),
    officialWebsite: safeHttpUrlSchema,
    verificationMethod: z.enum(["none", "work_email", "domain", "github_org"]),
    verificationStatus: z.enum([
      "unverified",
      "owner_verified",
      "domain_verified",
      "manual_review",
    ]),
    riskFlags: boundedTextArray(30, 160),
    createdAt: boundedText(80),
    updatedAt: boundedText(80),
    isOpen: z.boolean(),
  })
  .strict()

const searchFiltersSchema = z
  .object({
    query: boundedText(500),
    roles: boundedTextArray(30, 120),
    skills: boundedTextArray(50, 120),
    industries: boundedTextArray(30, 120),
    location: boundedText(160),
    remotePreference: z.enum(["remote", "hybrid", "in_person", "any"]),
    stage: z.enum(["idea", "prototype", "mvp", "revenue", "growth", "any"]),
    timeCommitment: z.enum([
      "nights_weekends",
      "part_time",
      "full_time",
      "any",
    ]),
    compensationType: z.enum([
      "equity_only",
      "cash_and_equity",
      "cash_only",
      "advisory",
      "any",
    ]),
    minimumWeeklyHours: boundedText(20),
    runwayBucket: z.enum([
      "under_3_months",
      "3_to_6_months",
      "6_to_12_months",
      "12_plus_months",
      "undisclosed",
      "any",
    ]),
    equityPhilosophy: z.enum([
      "equal_unless_strong_reason",
      "contribution_weighted",
      "dynamic_over_time",
      "any",
    ]),
    equityExpectationRange: boundedText(160),
  })
  .strict()

export const memberWorkspaceWriteEnvelopeSchema = z
  .object({
    state: z
      .object({
        onboardingCompleted: z.boolean(),
        notificationPreferences: z
          .object({
            unreadDigestEmail: z.boolean(),
            workflowEmail: z.boolean(),
          })
          .strict(),
        profile: profileSchema,
        opportunities: z.array(opportunityWriteSchema).max(50),
        bookmarks: z
          .array(
            z
              .object({
                id: identifierSchema,
                userId: identifierSchema,
                targetType: z.enum(["profile", "opportunity"]),
                targetId: identifierSchema,
                createdAt: boundedText(80),
              })
              .strict(),
          )
          .max(250),
        savedSearches: z
          .array(
            z
              .object({
                id: identifierSchema,
                userId: identifierSchema,
                label: boundedText(160).min(1),
                scope: z.enum(["profiles", "opportunities"]),
                filters: searchFiltersSchema,
                createdAt: boundedText(80),
              })
              .strict(),
          )
          .max(100),
      })
      .strict(),
  })
  .strict()

export const operationsMailSmokeSchema = z.object({
  dryRun: z.boolean().default(false),
  metadata: boundedMetadataSchema.default({}),
  subject: z
    .string()
    .trim()
    .min(3)
    .max(160)
    .default("CoFoundry mail smoke test"),
  toEmail: z.string().trim().email().max(254).optional(),
}).strict()

export const operationsLifecycleNotificationSchema = z.object({
  dryRun: z.boolean().default(false),
  eventType: z.enum([
    "intro.received",
    "intro.accepted",
    "match.created",
    "message.unread",
    "proposal.received",
    "proposal.updated",
    "contract.signature_required",
    "report.reviewed",
    "billing.state_changed",
    "subscription.changed",
  ]),
  metadata: boundedMetadataSchema.default({}),
  targetId: z.string().trim().min(1).max(160),
  targetType: z
    .enum([
      "connect_request",
      "match",
      "message",
      "conversation",
      "proposal",
      "contract",
      "report",
      "subscription",
    ])
    .nullable()
    .optional(),
  userId: z.string().trim().min(1).max(120),
}).strict()

export const operationsEmailSuppressionSchema = z.object({
  category: z.enum(["all", "digest", "workflow"]).default("all"),
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform(value => value.toLowerCase()),
  metadata: boundedMetadataSchema.default({}),
  provider: z.string().trim().min(2).max(120).default("external"),
  reason: z.enum([
    "bounce",
    "complaint",
    "manual",
    "provider_suppression",
    "unsubscribe",
  ]),
  sourceEventId: z.string().trim().min(1).max(200).nullable().optional(),
  suppressedAt: z.string().datetime("Use an ISO timestamp.").optional(),
}).strict()

export const operationsContractEnvelopeSchema = z.object({
  completedPdfFileUploadId: z
    .string()
    .trim()
    .min(1)
    .max(160)
    .nullable()
    .optional(),
  completedPdfSha256: z
    .string()
    .trim()
    .regex(
      /^[a-f0-9]{64}$/i,
      "Use a lowercase or uppercase SHA-256 hex digest.",
    )
    .nullable()
    .optional(),
  contractId: z.string().trim().min(1).max(160),
  contractVersionId: z.string().trim().min(1).max(160),
  metadata: boundedMetadataSchema.default({}),
  occurredAt: z.string().datetime("Use an ISO timestamp.").optional(),
  provider: z.string().trim().min(2).max(120).default("external"),
  providerEnvelopeId: z.string().trim().min(1).max(200),
  signedByUserIds: z
    .array(z.string().trim().min(1).max(120))
    .max(100)
    .default([]),
  sourceEventId: z.string().trim().min(1).max(200).nullable().optional(),
  status: z.enum([
    "created",
    "sent",
    "viewed",
    "completed",
    "declined",
    "voided",
    "failed",
  ]),
}).strict()

export const operationsTrustVerificationSchema = z.object({
  confidence: z.number().min(0).max(1).nullable().optional(),
  evidenceFileUploadId: z.string().trim().min(1).max(160).nullable().optional(),
  metadata: boundedMetadataSchema.default({}),
  occurredAt: z.string().datetime("Use an ISO timestamp.").optional(),
  provider: z.string().trim().min(2).max(120).default("external"),
  providerSubjectId: z.string().trim().min(1).max(200).nullable().optional(),
  sourceEventId: z.string().trim().min(1).max(200).nullable().optional(),
  status: z.enum(["verified", "failed", "manual_review", "expired"]),
  targetId: z.string().trim().min(1).max(160),
  targetType: z.enum(["profile", "user", "opportunity"]),
  verificationType: z.enum([
    "identity",
    "work_history",
    "phone",
    "linkedin",
    "github",
    "work_domain",
    "website",
    "government_id",
    "email",
    "opportunity_domain",
    "opportunity_owner",
  ]),
}).strict()

export const operationsEventSchema = z.object({
  actorUserId: z.string().trim().min(1).max(120).nullable().optional(),
  eventType: z.string().trim().min(2).max(120),
  metadata: boundedMetadataSchema.default({}),
  severity: z.enum(["info", "warning", "error"]).default("info"),
  source: z.string().trim().min(2).max(120),
  targetId: z.string().trim().min(1).max(120).nullable().optional(),
  targetType: z.string().trim().min(1).max(80).nullable().optional(),
}).strict()

export const reportSchema = z
  .object({
    reason: z.enum([
      "spam",
      "misrepresentation",
      "harassment",
      "off_platform_solicitation",
      "scam_fraud",
      "impersonation",
      "data_harvesting",
      "privacy_violation",
    ]),
    details: boundedText(4000).min(
      12,
      "Add enough detail for moderation to understand the issue.",
    ),
  })
  .strict()

export const reportSubmissionSchema = z
  .object({
    targetId: identifierSchema,
    targetType: z.enum(["profile", "message", "opportunity"]),
    reason: z.enum([
      "spam",
      "misrepresentation",
      "harassment",
      "off_platform_solicitation",
      "scam_fraud",
      "impersonation",
      "data_harvesting",
      "privacy_violation",
    ]),
    details: boundedText(4000).min(
      12,
      "Add enough detail for moderation to understand the issue.",
    ),
  })
  .strict()

export const investmentApplicationSubmissionSchema = z
  .object({
    opportunityId: identifierSchema,
    raiseAmount: boundedText(160).min(2),
    traction: boundedText(4000).min(20),
    deckLink: safeHttpUrlSchema.refine(
      value => Boolean(value),
      "Add a secure HTTP or HTTPS deck link.",
    ),
    teamSummary: boundedText(3000).min(20),
    reason: boundedText(4000).min(20),
  })
  .strict()

const organizationMemberRoleSchema = z.enum(["owner", "operator", "member", "reviewer", "billing", "counsel"])
const organizationAssignableRoleSchema = z.enum(["operator", "member", "reviewer", "billing", "counsel"])
const nullableIdentifierSchema = identifierSchema.nullable()
const nullableDateTimeSchema = z.string().datetime("Use an ISO timestamp.").nullable()

export const organizationCreateSchema = z.object({
  description: boundedText(3000).min(20, "Add a concise organization description."),
  kind: z.enum(["startup_team", "venture_studio"]),
  name: boundedText(120).min(2, "Organization name is required."),
  website: safeHttpUrlSchema,
}).strict()

export const organizationMutationEnvelopeSchema = z.object({
  expectedVersion: z.number().int().positive(),
  mutation: z.discriminatedUnion("action", [
    z.object({
      action: z.literal("update_organization"),
      description: boundedText(3000).min(20),
      name: boundedText(120).min(2),
      website: safeHttpUrlSchema,
    }).strict(),
    z.object({
      action: z.literal("update_settings"),
      allowOperatorInvites: z.boolean(),
      dataRetentionDays: z.number().int().min(30).max(3650),
      seatLimit: z.number().int().min(2).max(100),
    }).strict(),
    z.object({ action: z.literal("archive_organization") }).strict(),
    z.object({
      action: z.literal("invite_member"),
      displayName: boundedText(120).min(2),
      email: z.string().trim().email("Enter a valid email address.").max(254),
      role: organizationAssignableRoleSchema,
      title: boundedText(160).min(2),
    }).strict(),
    z.object({
      action: z.literal("respond_invitation"),
      invitationId: identifierSchema,
      response: z.enum(["accepted", "declined"]),
    }).strict(),
    z.object({ action: z.literal("revoke_invitation"), invitationId: identifierSchema }).strict(),
    z.object({
      action: z.literal("update_member"),
      membershipId: identifierSchema,
      role: organizationAssignableRoleSchema,
      title: boundedText(160).min(2),
    }).strict(),
    z.object({ action: z.literal("remove_member"), membershipId: identifierSchema }).strict(),
    z.object({ action: z.literal("transfer_ownership"), membershipId: identifierSchema }).strict(),
    z.object({
      action: z.literal("create_venture"),
      leadUserId: nullableIdentifierSchema,
      name: boundedText(160).min(2),
      opportunityId: nullableIdentifierSchema,
      stage: z.enum(["idea", "prototype", "mvp", "revenue", "growth"]),
      summary: boundedText(3000).min(20),
    }).strict(),
    z.object({
      action: z.literal("update_venture"),
      leadUserId: nullableIdentifierSchema,
      stage: z.enum(["idea", "prototype", "mvp", "revenue", "growth"]),
      status: z.enum(["incubating", "active", "paused", "graduated", "archived"]),
      summary: boundedText(3000).min(20),
      ventureId: identifierSchema,
    }).strict(),
    z.object({
      action: z.literal("create_project"),
      description: boundedText(4000).min(10),
      dueAt: nullableDateTimeSchema,
      ownerUserId: nullableIdentifierSchema,
      title: boundedText(200).min(2),
      ventureId: nullableIdentifierSchema,
    }).strict(),
    z.object({
      action: z.literal("update_project"),
      description: boundedText(4000).min(10),
      dueAt: nullableDateTimeSchema,
      ownerUserId: nullableIdentifierSchema,
      projectId: identifierSchema,
      status: z.enum(["planned", "active", "blocked", "completed", "archived"]),
      title: boundedText(200).min(2),
    }).strict(),
    z.object({
      action: z.literal("create_task"),
      assigneeUserId: nullableIdentifierSchema,
      dueAt: nullableDateTimeSchema,
      projectId: identifierSchema,
      title: boundedText(240).min(2),
    }).strict(),
    z.object({
      action: z.literal("update_task"),
      assigneeUserId: nullableIdentifierSchema,
      dueAt: nullableDateTimeSchema,
      status: z.enum(["todo", "in_progress", "blocked", "done"]),
      taskId: identifierSchema,
      title: boundedText(240).min(2),
    }).strict(),
    z.object({
      action: z.literal("create_decision"),
      context: boundedText(4000).min(10),
      decision: boundedText(4000).min(5),
      ownerUserId: identifierSchema,
      projectId: nullableIdentifierSchema,
      title: boundedText(240).min(2),
      ventureId: nullableIdentifierSchema,
    }).strict(),
    z.object({
      action: z.literal("resolve_decision"),
      decision: boundedText(4000).min(5),
      decisionId: identifierSchema,
      status: z.enum(["approved", "superseded"]),
    }).strict(),
    z.object({
      action: z.literal("create_policy"),
      allowOutsideCounsel: z.boolean(),
      approvalRoles: z.array(organizationMemberRoleSchema).min(1).max(6),
      description: boundedText(3000).min(10),
      isDefault: z.boolean(),
      name: boundedText(160).min(2),
      requiredClauses: boundedTextArray(30, 240),
      requiresInternalApproval: z.boolean(),
      requiresLegalReview: z.boolean(),
      separationOfDuties: z.boolean(),
    }).strict(),
    z.object({
      action: z.literal("update_policy"),
      allowOutsideCounsel: z.boolean(),
      approvalRoles: z.array(organizationMemberRoleSchema).min(1).max(6),
      description: boundedText(3000).min(10),
      isDefault: z.boolean(),
      name: boundedText(160).min(2),
      policyId: identifierSchema,
      requiredClauses: boundedTextArray(30, 240),
      requiresInternalApproval: z.boolean(),
      requiresLegalReview: z.boolean(),
      separationOfDuties: z.boolean(),
    }).strict(),
    z.object({
      action: z.literal("request_approval"),
      policyId: nullableIdentifierSchema,
      summary: boundedText(4000).min(10),
      targetId: identifierSchema,
      targetType: z.enum(["contract", "proposal", "venture", "project", "opportunity", "investment_application", "policy_exception"]),
      targetVersionId: nullableIdentifierSchema,
      title: boundedText(240).min(2),
    }).strict(),
    z.object({
      action: z.literal("resolve_approval"),
      approvalId: identifierSchema,
      decisionNote: boundedText(4000).min(8),
      status: z.enum(["approved", "changes_requested", "rejected"]),
    }).strict(),
    z.object({ action: z.literal("cancel_approval"), approvalId: identifierSchema }).strict(),
    z.object({
      action: z.literal("share_search"),
      filters: searchFiltersSchema,
      label: boundedText(160).min(2),
      scope: z.enum(["profiles", "opportunities"]),
      sourceSavedSearchId: nullableIdentifierSchema,
    }).strict(),
    z.object({ action: z.literal("remove_shared_search"), sharedSearchId: identifierSchema }).strict(),
    z.object({
      action: z.literal("link_resource"),
      label: boundedText(240).min(2),
      policyId: nullableIdentifierSchema,
      resourceId: identifierSchema,
      resourceType: z.enum(["relationship", "proposal", "contract", "opportunity", "investment_application"]),
    }).strict(),
    z.object({ action: z.literal("unlink_resource"), resourceLinkId: identifierSchema }).strict(),
  ]),
}).strict()

export const adminUserModerationSchema = z.object({
  action: z.enum(["suspend", "reinstate"]),
  notes: z
    .string()
    .trim()
    .min(8, "Add a short moderation note.")
    .max(300, "Keep the moderation note concise."),
}).strict()

export const adminUserRoleSchema = z.object({
  notes: z
    .string()
    .trim()
    .min(8, "Add a short role-change note.")
    .max(500, "Keep the role-change note concise."),
  role: z.enum(["founder", "collaborator", "admin", "investor_admin"]),
}).strict()

export const adminUserEmailVerificationSchema = z.object({
  notes: z
    .string()
    .trim()
    .min(8, "Add a short email-verification note.")
    .max(500, "Keep the email-verification note concise."),
}).strict()

export const adminReportStatusSchema = z.object({
  expectedStatus: z.enum(["open", "reviewed"]),
  status: z.enum(["reviewed", "resolved"]),
  notes: z
    .string()
    .trim()
    .min(8, "Add a short moderation note.")
    .max(500, "Keep the moderation note concise."),
}).strict()

export const adminPrivacyRequestStatusSchema = z.discriminatedUnion("status", [
  z.object({
    expectedStatus: z.literal("open"),
    notes: z
      .string()
      .trim()
      .min(8, "Add a short privacy-handling note.")
      .max(500, "Keep the privacy-handling note concise."),
    status: z.literal("reviewed"),
  }).strict(),
  z.object({
    completionConfirmed: z.literal(true, {
      error: "Confirm that the requested privacy action was actually completed before resolving it.",
    }),
    expectedStatus: z.enum(["open", "reviewed"]),
    notes: z
      .string()
      .trim()
      .min(8, "Add a short privacy-resolution note.")
      .max(500, "Keep the privacy-resolution note concise."),
    status: z.literal("resolved"),
  }).strict(),
])

export const adminOpportunityVerificationSchema = z.object({
  expectedUpdatedAt: z.string().datetime("Refresh the listing before recording this review."),
  notes: z
    .string()
    .trim()
    .min(8, "Add a short opportunity-verification note.")
    .max(500, "Keep the opportunity-verification note concise."),
  status: z.enum(["unverified", "owner_verified", "domain_verified"]),
}).strict()

export const adminCommandQueueActionSchema = z.object({
  action: z.enum(["assign", "escalate", "review_evidence"]),
  assignedAdminUserId: z
    .string()
    .trim()
    .min(1, "An assignee id is required.")
    .max(120, "Assignee id is too long.")
    .optional(),
  escalationQueue: z
    .enum(["trust_safety", "operations", "founder_success", "billing"])
    .optional(),
  notes: z
    .string()
    .trim()
    .min(8, "Add a short queue action note.")
    .max(500, "Keep the queue action note concise."),
  targetId: z
    .string()
    .trim()
    .min(1, "A queue target id is required.")
    .max(160, "Queue target id is too long."),
  targetType: z.enum([
    "access_request",
    "readiness_check",
    "file_upload",
    "report",
    "privacy_request",
    "opportunity",
  ]),
}).strict()

export const privacyRequestSchema = z
  .object({
    details: z
      .string()
      .trim()
      .min(12, "Add enough detail for support to handle the request.")
      .max(1000, "Keep the request concise."),
    type: z.enum([
      "data_export",
      "account_deletion",
      "correction",
      "visibility",
      "safety_privacy",
    ]),
  })
  .strict()

export const emailPreferenceApplySchema = z
  .object({
    token: z
      .string()
      .trim()
      .min(20, "Email preference token is incomplete.")
      .max(4096, "Email preference token is too long."),
  })
  .strict()

export const typingPresenceSchema = z.object({
  conversationId: identifierSchema,
  isTyping: z.boolean(),
}).strict()
