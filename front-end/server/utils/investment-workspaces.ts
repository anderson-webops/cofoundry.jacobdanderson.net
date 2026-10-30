import type { H3Event } from "h3"
import type { SessionUser } from "../../shared/types/domain"
import type {
  InvestmentApplicantMutation,
  InvestmentApplicantSnapshot,
  InvestmentReviewerMutation,
  InvestmentReviewerSnapshot,
  InvestmentWorkspaceDocument,
} from "../../shared/types/investment-workspaces"
import { randomUUID } from "node:crypto"
import { workspaceSeed } from "../../shared/data/seed"
import {
  applyInvestmentApplicantMutation,
  applyInvestmentReviewerMutation,
  createInvestmentWorkspaceDocument,
  investmentSupplementalTermsVersion,
  InvestmentTransitionError,
  projectInvestmentFileUpload,
  projectInvestmentWorkspaceForApplicant,
  projectInvestmentWorkspaceForReviewer,
} from "../../shared/utils/investment-workspaces"
import { persistUserNotification } from "./admin-persistence"
import { getFileUploadById, listFileUploadsByRelated } from "./file-uploads"
import {
  getRawInvestmentWorkspaceDocument,
  listRawInvestmentWorkspaceDocumentsForApplicant,
  listRawInvestmentWorkspaceDocumentsForReview,
  persistCreatedInvestmentWorkspaceDocument,
  persistUpdatedInvestmentWorkspaceDocument,
} from "./investment-workspace-persistence"
import { loadMemberWorkspaceState } from "./member-workspace"
import { loadOrganizationWorkspaceSnapshot } from "./organization-workspaces"
import { createSupabaseAdminClient, isSupabaseEnabled } from "./supabase"
import { emitWorkspaceRealtimeChange } from "./workspace-realtime"

interface CreateInvestmentWorkspacePayload {
  opportunityId: string
  organizationId: string | null
}

function createId(prefix: string) {
  return `${prefix}_${randomUUID().replaceAll("-", "")}`
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

function transitionError(error: unknown) {
  if (error instanceof InvestmentTransitionError) {
    return createError({
      statusCode: error.statusCode,
      statusMessage: error.message,
    })
  }
  return error
}

function investmentFileSelectors(workspaces: InvestmentWorkspaceDocument[]) {
  return workspaces.flatMap(workspace => [workspace.id, workspace.application.id].map(relatedId => ({
    relatedId,
    relatedType: "investment_workspace" as const,
  })))
}

export function assertInvestmentModuleEnabled(event: H3Event) {
  const runtimeConfig = useRuntimeConfig(event)
  if (runtimeConfig.public.featureInvestmentModule !== true)
    throw createError({ statusCode: 404, statusMessage: "The investment workspace is not enabled." })
}

function assertInvestmentApplicantSession(session: SessionUser) {
  if (["admin", "investor_admin"].includes(session.role))
    throw createError({ statusCode: 403, statusMessage: "Staff review accounts cannot use applicant investment workspaces." })
}

async function validateOrganizationAccess(event: H3Event, session: SessionUser, organizationId: string | null) {
  if (!organizationId)
    return
  const snapshot = await loadOrganizationWorkspaceSnapshot(event, session)
  const organization = snapshot.workspaces.find(item => item.organization.id === organizationId)
  if (!organization || !organization.memberships.some(membership => membership.userId === session.id))
    throw createError({ statusCode: 404, statusMessage: "The selected organization workspace is not available to you." })
}

async function validateAttachedFile(
  event: H3Event,
  session: SessionUser,
  document: InvestmentWorkspaceDocument,
  mutation: InvestmentApplicantMutation,
) {
  const uploadId = mutation.action === "add_data_room_item"
    ? mutation.fileUploadId
    : mutation.action === "update_data_room_item"
      ? document.dataRoomItems.find(item => item.id === mutation.dataRoomItemId)?.fileUploadId || null
      : null
  const shareWithProgram = mutation.action === "add_data_room_item" || mutation.action === "update_data_room_item"
    ? mutation.shareWithProgram
    : false
  if (!uploadId)
    return

  const upload = await getFileUploadById(event, uploadId)
  if (
    !upload
    || upload.ownerUserId !== session.id
    || upload.purpose !== "investment_document"
    || upload.relatedType !== "investment_workspace"
    || ![document.id, document.application.id].includes(upload.relatedId || "")
    || upload.status === "deleted"
    || upload.deletedAt
  ) {
    throw createError({ statusCode: 403, statusMessage: "The selected upload is not available to this investment workspace." })
  }
  if (shareWithProgram && (upload.status !== "uploaded" || upload.scanStatus !== "clean")) {
    throw createError({
      statusCode: 409,
      statusMessage: "Files must complete malware review before they can be shared with the program.",
    })
  }
}

async function listReviewerIdentities(event: H3Event) {
  if (!isSupabaseEnabled(event)) {
    const names = new Map(workspaceSeed.profiles.map(profile => [profile.userId, profile.displayName]))
    return workspaceSeed.users
      .filter(user => ["admin", "investor_admin"].includes(user.role) && user.verifiedEmail && !user.suspendedAt)
      .map(user => ({ id: user.id, name: names.get(user.id) || user.email }))
  }

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })
  const { data, error } = await adminClient
    .from("users")
    .select("id,email")
    .in("role", ["admin", "investor_admin"])
    .eq("verified_email", true)
    .is("suspended_at", null)
  if (error)
    throw error
  const reviewerIds = (data || []).map(row => row.id as string)
  const { data: profiles, error: profileError } = reviewerIds.length
    ? await adminClient
        .from("profiles")
        .select("user_id,display_name")
        .in("user_id", reviewerIds)
    : { data: [], error: null }
  if (profileError)
    throw profileError
  const names = new Map((profiles || []).map(profile => [profile.user_id as string, profile.display_name as string]))
  return (data || []).map((row) => {
    return {
      id: row.id as string,
      name: names.get(row.id as string) || row.email as string,
    }
  })
}

async function notifyUsers(event: H3Event, userIds: string[], payload: {
  body: string
  href: string
  title: string
}) {
  const createdAt = new Date().toISOString()
  await Promise.allSettled(Array.from(new Set(userIds)).map(userId => persistUserNotification(event, {
    body: payload.body,
    createdAt,
    href: payload.href,
    id: createId("notification"),
    readAt: null,
    title: payload.title,
    type: "admin",
    userId,
  })))
}

async function emitChange(document: InvestmentWorkspaceDocument, reviewerIds: string[], action: string) {
  await emitWorkspaceRealtimeChange([document.applicantUserId, ...reviewerIds], {
    metadata: { action, investmentWorkspaceId: document.id },
    source: "investment.workspace",
  })
}

export async function loadInvestmentApplicantSnapshot(event: H3Event, session: SessionUser): Promise<InvestmentApplicantSnapshot> {
  assertInvestmentModuleEnabled(event)
  assertInvestmentApplicantSession(session)
  const workspaces = (await listRawInvestmentWorkspaceDocumentsForApplicant(event, session.id))
    .map(document => projectInvestmentWorkspaceForApplicant(document, session.id))
    .filter((document): document is InvestmentWorkspaceDocument => Boolean(document))
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
  return {
    fileUploads: (await listFileUploadsByRelated(event, investmentFileSelectors(workspaces)))
      .filter(upload => upload.ownerUserId === session.id)
      .map(projectInvestmentFileUpload),
    supplementalTermsVersion: investmentSupplementalTermsVersion,
    workspaces,
  }
}

export async function loadInvestmentApplicantExport(event: H3Event, session: SessionUser) {
  return (await listRawInvestmentWorkspaceDocumentsForApplicant(event, session.id))
    .map(document => projectInvestmentWorkspaceForApplicant(document, session.id))
    .filter((document): document is InvestmentWorkspaceDocument => Boolean(document))
}

export async function createInvestmentWorkspace(
  event: H3Event,
  session: SessionUser,
  payload: CreateInvestmentWorkspacePayload,
) {
  assertInvestmentModuleEnabled(event)
  assertInvestmentApplicantSession(session)

  const workspace = await loadMemberWorkspaceState(event, identity(session))
  const opportunity = workspace.seed.opportunities.find(item => item.id === payload.opportunityId && item.ownerUserId === session.id)
  if (!opportunity)
    throw createError({ statusCode: 404, statusMessage: "Choose one of your active startup opportunities." })
  if (!opportunity.isOpen)
    throw createError({ statusCode: 409, statusMessage: "Fundraising workspaces require an open startup opportunity." })
  await validateOrganizationAccess(event, session, payload.organizationId)

  const now = new Date().toISOString()
  const document = createInvestmentWorkspaceDocument(session, {
    companyName: opportunity.startupName,
    opportunityId: opportunity.id,
    organizationId: payload.organizationId,
  }, { createId, now })
  const created = await persistCreatedInvestmentWorkspaceDocument(event, document)
  await emitWorkspaceRealtimeChange([session.id], {
    metadata: { action: "investment.workspace_created", investmentWorkspaceId: created.id },
    source: "investment.workspace",
  })
  return projectInvestmentWorkspaceForApplicant(created, session.id)!
}

export async function mutateInvestmentApplicantWorkspace(
  event: H3Event,
  session: SessionUser,
  workspaceId: string,
  expectedVersion: number,
  mutation: InvestmentApplicantMutation,
) {
  assertInvestmentModuleEnabled(event)
  assertInvestmentApplicantSession(session)
  const current = await getRawInvestmentWorkspaceDocument(event, workspaceId)
  if (!current || current.applicantUserId !== session.id)
    throw createError({ statusCode: 404, statusMessage: "Investment workspace not found." })
  if (current.version !== expectedVersion)
    throw createError({ statusCode: 409, statusMessage: "The investment workspace changed after this action began. Refresh and try again." })

  if (mutation.action === "update_workspace")
    await validateOrganizationAccess(event, session, mutation.organizationId)
  await validateAttachedFile(event, session, current, mutation)

  let next: InvestmentWorkspaceDocument
  try {
    next = applyInvestmentApplicantMutation(current, session, mutation, {
      createId,
      now: new Date().toISOString(),
    })
  }
  catch (error) {
    throw transitionError(error)
  }
  const persisted = await persistUpdatedInvestmentWorkspaceDocument(event, next, expectedVersion)
  const reviewers = await listReviewerIdentities(event)
  if (mutation.action === "submit_application") {
    await notifyUsers(event, reviewers.map(item => item.id), {
      body: `${persisted.companyName} submitted a program application for review.`,
      href: `/investment-review/${persisted.id}`,
      title: "Investment application submitted",
    })
  }
  else if (["respond_information_request", "respond_diligence_item"].includes(mutation.action)) {
    const recipients = persisted.review.assignedReviewerUserId
      ? [persisted.review.assignedReviewerUserId]
      : reviewers.map(item => item.id)
    await notifyUsers(event, recipients, {
      body: `${persisted.companyName} added a requested review response.`,
      href: `/investment-review/${persisted.id}`,
      title: "Investment review response received",
    })
  }
  await emitChange(persisted, reviewers.map(item => item.id), mutation.action)
  return projectInvestmentWorkspaceForApplicant(persisted, session.id)!
}

export async function loadInvestmentReviewerSnapshot(event: H3Event, session: SessionUser): Promise<InvestmentReviewerSnapshot> {
  assertInvestmentModuleEnabled(event)
  if (!["admin", "investor_admin"].includes(session.role))
    throw createError({ statusCode: 403, statusMessage: "Investment-review access is required." })
  const reviewers = await listReviewerIdentities(event)
  const workspaces = (await listRawInvestmentWorkspaceDocumentsForReview(event))
    .map(projectInvestmentWorkspaceForReviewer)
    .filter((document): document is InvestmentWorkspaceDocument => Boolean(document))
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
  const visibleUploadIds = new Set(workspaces.flatMap(workspace => workspace.dataRoomItems.flatMap(item => item.fileUploadId
    ? [item.fileUploadId]
    : [])))
  const fileUploads = (await listFileUploadsByRelated(event, investmentFileSelectors(workspaces)))
    .filter(upload => visibleUploadIds.has(upload.id))
    .map(projectInvestmentFileUpload)
  return {
    fileUploads,
    reviewers,
    supplementalTermsVersion: investmentSupplementalTermsVersion,
    workspaces,
  }
}

export async function loadInvestmentReviewerWorkspace(event: H3Event, session: SessionUser, workspaceId: string) {
  assertInvestmentModuleEnabled(event)
  if (!["admin", "investor_admin"].includes(session.role))
    throw createError({ statusCode: 403, statusMessage: "Investment-review access is required." })
  const current = await getRawInvestmentWorkspaceDocument(event, workspaceId)
  const workspace = current
    ? projectInvestmentWorkspaceForReviewer(current)
    : null
  if (!workspace)
    throw createError({ statusCode: 404, statusMessage: "Review case not found." })
  const visibleUploadIds = new Set(workspace.dataRoomItems.flatMap(item => item.fileUploadId
    ? [item.fileUploadId]
    : []))
  const fileUploads = (await listFileUploadsByRelated(event, investmentFileSelectors([workspace])))
    .filter(upload => visibleUploadIds.has(upload.id))
    .map(projectInvestmentFileUpload)
  return {
    fileUploads,
    reviewers: await listReviewerIdentities(event),
    supplementalTermsVersion: investmentSupplementalTermsVersion,
    workspace,
  }
}

export async function mutateInvestmentReviewerWorkspace(
  event: H3Event,
  session: SessionUser,
  workspaceId: string,
  expectedVersion: number,
  mutation: InvestmentReviewerMutation,
) {
  assertInvestmentModuleEnabled(event)
  if (!["admin", "investor_admin"].includes(session.role))
    throw createError({ statusCode: 403, statusMessage: "Investment-review access is required." })
  const current = await getRawInvestmentWorkspaceDocument(event, workspaceId)
  if (!current || !projectInvestmentWorkspaceForReviewer(current))
    throw createError({ statusCode: 404, statusMessage: "Review case not found." })
  if (current.version !== expectedVersion)
    throw createError({ statusCode: 409, statusMessage: "The review case changed after this action began. Refresh and try again." })

  const reviewers = await listReviewerIdentities(event)
  if (mutation.action === "assign_reviewer" && mutation.reviewerUserId && !reviewers.some(item => item.id === mutation.reviewerUserId))
    throw createError({ statusCode: 400, statusMessage: "Choose an active investment reviewer." })

  let next: InvestmentWorkspaceDocument
  try {
    next = applyInvestmentReviewerMutation(current, session, mutation, {
      createId,
      now: new Date().toISOString(),
    })
  }
  catch (error) {
    throw transitionError(error)
  }
  const persisted = await persistUpdatedInvestmentWorkspaceDocument(event, next, expectedVersion)
  const applicantVisibleActions = new Set([
    "set_application_status",
    "request_information",
    "close_information_request",
    "create_diligence_item",
    "resolve_diligence_item",
    "record_decision",
    "create_partner_handoff",
    "update_partner_handoff",
  ])
  if (applicantVisibleActions.has(mutation.action)) {
    await notifyUsers(event, [persisted.applicantUserId], {
      body: `${persisted.companyName}'s program review has an update.`,
      href: "/app/investment",
      title: "Investment review updated",
    })
  }
  await emitChange(persisted, reviewers.map(item => item.id), mutation.action)
  return projectInvestmentWorkspaceForReviewer(persisted)!
}
