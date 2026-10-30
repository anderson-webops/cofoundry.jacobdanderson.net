import type { H3Event } from "h3"
import type { ContractLegalReview, SessionUser, WorkspaceSeed } from "../../shared/types/domain"
import type { OrganizationMutation, OrganizationWorkspaceDocument, OrganizationWorkspaceSnapshot } from "../../shared/types/organizations"
import { randomUUID } from "node:crypto"
import { workspaceSeed } from "../../shared/data/seed"
import {
  applyOrganizationMutation,
  createOrganizationWorkspaceDocument,
  getOrganizationContractGovernanceRequirements,
  OrganizationTransitionError,
  projectOrganizationWorkspaceForSession,
} from "../../shared/utils/organizations"
import { projectWorkspaceForSession } from "../../shared/utils/workspace-authorization"
import { resolveServerAppUrl } from "./app-url"
import { sendPlainTextEmail } from "./contact"
import { createContractLegalReviewUrl } from "./contract-legal-review-tokens"
import { listContractLegalReviewsForReviewerEmail } from "./contract-legal-reviews"
import { findRawInvestmentWorkspaceDocumentByResourceId } from "./investment-workspace-persistence"
import { readLocalMemberWorkspaceStates } from "./local-member-workspace"
import {
  createLocalOrganizationWorkspaceDocument,
  getLocalOrganizationWorkspaceDocument,
  listLocalOrganizationWorkspaceDocuments,
  updateLocalOrganizationWorkspaceDocument,
} from "./local-organization-workspaces"
import { loadMemberWorkspaceState } from "./member-workspace"
import { createSupabaseAdminClient, isSupabaseEnabled } from "./supabase"
import { emitWorkspaceRealtimeChange } from "./workspace-realtime"

interface OrganizationWorkspaceRow {
  id: string
  slug: string
  owner_user_id: string
  active_member_user_ids: string[]
  pending_invite_emails: string[]
  linked_resource_keys: string[]
  document: OrganizationWorkspaceDocument
  version: number
  created_at: string
  updated_at: string
}

interface CreateOrganizationPayload {
  description: string
  kind: "startup_team" | "venture_studio"
  name: string
  website: string
}

function createId(prefix: string) {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "")
    .slice(0, 80) || `organization-${randomUUID().slice(0, 8)}`
}

function rowToDocument(row: OrganizationWorkspaceRow) {
  return row.document
}

function activePendingInvitationEmails(document: OrganizationWorkspaceDocument) {
  const now = Date.now()
  return Array.from(new Set(document.invitations
    .filter(invitation => invitation.status === "pending" && new Date(invitation.expiresAt).getTime() > now)
    .map(invitation => normalizeEmail(invitation.email))))
}

function linkedResourceKeys(document: OrganizationWorkspaceDocument) {
  return Array.from(new Set(document.resourceLinks.map(link => `${link.resourceType}:${link.resourceId}`)))
}

function documentToRow(document: OrganizationWorkspaceDocument): OrganizationWorkspaceRow {
  return {
    active_member_user_ids: Array.from(new Set(document.memberships.map(membership => membership.userId))),
    created_at: document.organization.createdAt,
    document,
    id: document.organization.id,
    linked_resource_keys: linkedResourceKeys(document),
    owner_user_id: document.organization.ownerUserId,
    pending_invite_emails: activePendingInvitationEmails(document),
    slug: document.organization.slug,
    updated_at: document.organization.updatedAt,
    version: document.version,
  }
}

function transitionError(error: unknown) {
  if (error instanceof OrganizationTransitionError) {
    return createError({
      statusCode: error.statusCode,
      statusMessage: error.message,
    })
  }
  return error
}

function identity(session: SessionUser) {
  return {
    email: session.email,
    id: session.id,
    name: session.name,
    onboardingCompleted: session.onboardingCompleted,
    role: session.role,
    subscriptionPlan: session.subscriptionPlan,
  }
}

async function listSupabaseOrganizationDocuments(event: H3Event, session: SessionUser) {
  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })

  const email = normalizeEmail(session.email)
  const [memberResult, invitationResult] = await Promise.all([
    adminClient
      .from("organization_workspace_documents")
      .select("*")
      .contains("active_member_user_ids", [session.id]),
    adminClient
      .from("organization_workspace_documents")
      .select("*")
      .contains("pending_invite_emails", [email]),
  ])
  if (memberResult.error)
    throw memberResult.error
  if (invitationResult.error)
    throw invitationResult.error

  const rows = [
    ...(memberResult.data || []),
    ...(invitationResult.data || [])
  ] as OrganizationWorkspaceRow[]
  const byId = new Map(rows.map(row => [
    row.id,
    rowToDocument(row)
  ]))
  return [
    ...byId.values()
  ]
}

async function listRawOrganizationDocuments(event: H3Event, session: SessionUser) {
  if (!isSupabaseEnabled(event)) {
    const email = normalizeEmail(session.email)
    return (await listLocalOrganizationWorkspaceDocuments()).filter(document =>
      document.memberships.some(membership => membership.userId === session.id)
      || document.invitations.some(invitation => invitation.status === "pending" && normalizeEmail(invitation.email) === email),
    )
  }
  return listSupabaseOrganizationDocuments(event, session)
}

async function getRawOrganizationDocument(event: H3Event, organizationId: string) {
  if (!isSupabaseEnabled(event))
    return getLocalOrganizationWorkspaceDocument(organizationId)

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })
  const { data, error } = await adminClient
    .from("organization_workspace_documents")
    .select("*")
    .eq("id", organizationId)
    .maybeSingle()
  if (error)
    throw error
  return data
    ? rowToDocument(data as OrganizationWorkspaceRow)
    : null
}

async function listOrganizationDocumentsForResource(event: H3Event, resourceType: string, resourceId: string) {
  const key = `${resourceType}:${resourceId}`
  if (!isSupabaseEnabled(event))
    return (await listLocalOrganizationWorkspaceDocuments()).filter(document => linkedResourceKeys(document).includes(key))

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })
  const { data, error } = await adminClient
    .from("organization_workspace_documents")
    .select("*")
    .contains("linked_resource_keys", [key])
  if (error)
    throw error
  return ((data || []) as OrganizationWorkspaceRow[]).map(rowToDocument)
}

async function persistCreatedDocument(event: H3Event, document: OrganizationWorkspaceDocument) {
  if (!isSupabaseEnabled(event)) {
    const created = await createLocalOrganizationWorkspaceDocument(document)
    if (!created)
      throw createError({ statusCode: 409, statusMessage: "An organization with that name already exists." })
    return created
  }

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })
  const { data, error } = await adminClient
    .from("organization_workspace_documents")
    .insert(documentToRow(document))
    .select("*")
    .single()
  if (error?.code === "23505")
    throw createError({ statusCode: 409, statusMessage: "An organization with that name already exists." })
  if (error)
    throw error
  return rowToDocument(data as OrganizationWorkspaceRow)
}

async function persistUpdatedDocument(
  event: H3Event,
  document: OrganizationWorkspaceDocument,
  expectedVersion: number,
) {
  if (!isSupabaseEnabled(event)) {
    const updated = await updateLocalOrganizationWorkspaceDocument(document, expectedVersion)
    if (!updated)
      throw createError({ statusCode: 409, statusMessage: "The organization changed after this action began. Refresh and try again." })
    return updated
  }

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })
  const row = documentToRow(document)
  const { data, error } = await adminClient
    .from("organization_workspace_documents")
    .update({
      active_member_user_ids: row.active_member_user_ids,
      document: row.document,
      linked_resource_keys: row.linked_resource_keys,
      owner_user_id: row.owner_user_id,
      pending_invite_emails: row.pending_invite_emails,
      slug: row.slug,
      updated_at: row.updated_at,
      version: row.version,
    })
    .eq("id", row.id)
    .eq("version", expectedVersion)
    .select("*")
    .maybeSingle()
  if (error)
    throw error
  if (!data)
    throw createError({ statusCode: 409, statusMessage: "The organization changed after this action began. Refresh and try again." })
  return rowToDocument(data as OrganizationWorkspaceRow)
}

async function hasActiveTeamSponsor(event: H3Event, userId: string) {
  if (!isSupabaseEnabled(event)) {
    const localState = (await readLocalMemberWorkspaceStates()).find(state => state.user.id === userId)
    const subscription = localState?.subscription || workspaceSeed.subscriptions.find(item => item.userId === userId)
    return subscription?.plan === "team" && ["active", "trialing"].includes(subscription.status)
  }

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })
  const { data, error } = await adminClient
    .from("subscriptions")
    .select("plan,status")
    .eq("user_id", userId)
    .maybeSingle()
  if (error)
    throw error
  return data?.plan === "team" && ["active", "trialing"].includes(data.status)
}

async function buildLegalReviewQueue(event: H3Event, session: SessionUser, documents: OrganizationWorkspaceDocument[]) {
  const counselOrganizations = documents.filter(document => document.memberships.some(membership =>
    membership.userId === session.id && ["counsel", "reviewer"].includes(membership.role),
  ))
  if (!counselOrganizations.length)
    return []

  const reviews = await listContractLegalReviewsForReviewerEmail(event, session.email)
  return reviews.flatMap((review) => {
    const exactOrganization = counselOrganizations.find(document =>
      document.organization.name.trim().toLowerCase() === review.reviewerOrganization.trim().toLowerCase(),
    )
    const document = exactOrganization || (counselOrganizations.length === 1
      ? counselOrganizations[0]
      : null)
    if (!document)
      return []
    const reviewUrl = createContractLegalReviewUrl(event, review)
    if (!reviewUrl)
      return []
    return [
      {
        contractId: review.contractId,
        contractVersionId: review.contractVersionId,
        createdAt: review.createdAt,
        expiresAt: review.expiresAt,
        id: review.id,
        organizationId: document.organization.id,
        requestedByUserId: review.requestedByUserId,
        reviewerName: review.reviewerName,
        reviewerOrganization: review.reviewerOrganization,
        reviewerType: review.reviewerType,
        reviewUrl,
        scope: review.scope,
        status: review.status,
      }
    ]
  })
}

export async function loadOrganizationWorkspaceSnapshot(event: H3Event, session: SessionUser): Promise<OrganizationWorkspaceSnapshot> {
  const rawDocuments = await listRawOrganizationDocuments(event, session)
  const workspaces = rawDocuments
    .map(document => projectOrganizationWorkspaceForSession(document, session))
    .filter((document): document is OrganizationWorkspaceDocument => Boolean(document))
    .sort((left, right) => left.organization.name.localeCompare(right.organization.name))
  return {
    legalReviewQueue: await buildLegalReviewQueue(event, session, rawDocuments),
    workspaces,
  }
}

export async function createOrganizationWorkspace(event: H3Event, session: SessionUser, payload: CreateOrganizationPayload) {
  const workspace = await loadMemberWorkspaceState(event, identity(session))
  if (workspace.state.subscription.plan !== "team" || !["active", "trialing"].includes(workspace.state.subscription.status)) {
    throw createError({
      statusCode: 402,
      statusMessage: "Creating a Team or Studio workspace requires an active Team plan.",
    })
  }
  const now = new Date().toISOString()
  const document = createOrganizationWorkspaceDocument(session, {
    ...payload,
    slug: slugify(payload.name),
  }, { createId, now })
  const created = await persistCreatedDocument(event, document)
  await emitWorkspaceRealtimeChange([session.id], {
    metadata: { action: "organization.created", organizationId: created.organization.id },
    source: "organization.workspace",
  })
  return projectOrganizationWorkspaceForSession(created, session)!
}

async function assertVisibleResource(
  event: H3Event,
  seed: WorkspaceSeed,
  session: SessionUser,
  organization: OrganizationWorkspaceDocument,
  mutation: OrganizationMutation,
) {
  const investmentEnabled = useRuntimeConfig(event).public.featureInvestmentModule === true
  const canonicalInvestmentResource = investmentEnabled && mutation.action === "link_resource" && mutation.resourceType === "investment_application"
    ? await findRawInvestmentWorkspaceDocumentByResourceId(event, mutation.resourceId)
    : investmentEnabled && mutation.action === "request_approval" && mutation.targetType === "investment_application"
      ? await findRawInvestmentWorkspaceDocumentByResourceId(event, mutation.targetId)
      : null
  const canonicalInvestmentVisible = Boolean(canonicalInvestmentResource && (
    canonicalInvestmentResource.applicantUserId === session.id
    || canonicalInvestmentResource.organizationId === organization.organization.id
    || organization.resourceLinks.some(link => link.resourceType === "investment_application" && [canonicalInvestmentResource.id, canonicalInvestmentResource.application.id].includes(link.resourceId))
  ))

  if (mutation.action === "link_resource") {
    const visible = mutation.resourceType === "contract"
      ? seed.contracts.some(item => item.id === mutation.resourceId)
      : mutation.resourceType === "proposal"
        ? seed.proposals.some(item => item.id === mutation.resourceId)
        : mutation.resourceType === "opportunity"
          ? seed.opportunities.some(item => item.id === mutation.resourceId)
          : mutation.resourceType === "investment_application"
            ? canonicalInvestmentVisible || seed.investmentApplications.some(item => item.id === mutation.resourceId)
            : seed.matches.some(item => item.id === mutation.resourceId)
    if (!visible)
      throw createError({ statusCode: 404, statusMessage: "The selected workspace resource is not available to you." })
  }
  if (mutation.action === "request_approval" && [
    "contract",
    "proposal",
    "opportunity",
    "investment_application"
  ].includes(mutation.targetType)) {
    const visible = mutation.targetType === "contract"
      ? seed.contracts.some(item => item.id === mutation.targetId)
      : mutation.targetType === "proposal"
        ? seed.proposals.some(item => item.id === mutation.targetId)
        : mutation.targetType === "opportunity"
          ? seed.opportunities.some(item => item.id === mutation.targetId)
          : canonicalInvestmentVisible || seed.investmentApplications.some(item => item.id === mutation.targetId)
    if (!visible)
      throw createError({ statusCode: 404, statusMessage: "The selected approval target is not available to you." })
  }
}

async function deliverOrganizationInvitation(event: H3Event, document: OrganizationWorkspaceDocument, mutation: OrganizationMutation) {
  if (mutation.action !== "invite_member")
    return { delivered: false }
  const invitation = document.invitations.find(item => item.email === normalizeEmail(mutation.email) && item.status === "pending")
  if (!invitation)
    return { delivered: false }
  try {
    await sendPlainTextEmail({
      body: [
        `${mutation.displayName},`,
        "",
        `You were invited to join ${document.organization.name} on CoFoundry as ${mutation.role}.`,
        `Sign in with ${invitation.email} and open ${resolveServerAppUrl(event)}/app/studio to accept or decline.`,
        "",
        `This invitation expires ${invitation.expiresAt}.`,
      ].join("\n"),
      subject: `Invitation to ${document.organization.name} on CoFoundry`,
      toEmail: invitation.email,
    })
    return { delivered: true }
  }
  catch (error) {
    console.warn("[organization-workspaces] Invitation email was not delivered.", error)
    return { delivered: false }
  }
}

export async function mutateOrganizationWorkspace(
  event: H3Event,
  session: SessionUser,
  organizationId: string,
  expectedVersion: number,
  mutation: OrganizationMutation,
) {
  const current = await getRawOrganizationDocument(event, organizationId)
  if (!current)
    throw createError({ statusCode: 404, statusMessage: "Organization workspace not found." })
  if (current.version !== expectedVersion)
    throw createError({ statusCode: 409, statusMessage: "The organization changed after this action began. Refresh and try again." })

  const entitlementExemptActions = new Set(["respond_invitation", "archive_organization"])
  if (!entitlementExemptActions.has(mutation.action) && !await hasActiveTeamSponsor(event, current.organization.billingOwnerUserId)) {
    throw createError({
      statusCode: 402,
      statusMessage: "This organization needs an active Team sponsor before operational changes can continue.",
    })
  }

  if (["link_resource", "request_approval"].includes(mutation.action)) {
    const workspace = await loadMemberWorkspaceState(event, identity(session))
    await assertVisibleResource(event, projectWorkspaceForSession(workspace.seed, workspace.session), session, current, mutation)
  }

  let next: OrganizationWorkspaceDocument
  try {
    next = applyOrganizationMutation(current, session, mutation, {
      createId,
      now: new Date().toISOString(),
    })
  }
  catch (error) {
    throw transitionError(error)
  }
  const persisted = await persistUpdatedDocument(event, next, expectedVersion)
  const delivery = await deliverOrganizationInvitation(event, persisted, mutation)
  await emitWorkspaceRealtimeChange(persisted.memberships.map(membership => membership.userId), {
    metadata: { action: mutation.action, organizationId },
    source: "organization.workspace",
  })
  const projected = projectOrganizationWorkspaceForSession(persisted, session)
  if (!projected)
    throw createError({ statusCode: 403, statusMessage: "You no longer have access to this organization workspace." })
  return { delivery, workspace: projected }
}

export async function loadContractOrganizationGovernance(
  event: H3Event,
  contractId: string,
  contractVersionId: string,
  legalReviews: ContractLegalReview[],
) {
  const documents = await listOrganizationDocumentsForResource(event, "contract", contractId)
  const approvedVersionIds = new Set(legalReviews
    .filter(review => review.status === "approved")
    .map(review => review.contractVersionId))
  return getOrganizationContractGovernanceRequirements(documents, contractId, contractVersionId, approvedVersionIds)
}

export async function listOrganizationWorkspacesForResource(event: H3Event, resourceType: string, resourceId: string) {
  return listOrganizationDocumentsForResource(event, resourceType, resourceId)
}
