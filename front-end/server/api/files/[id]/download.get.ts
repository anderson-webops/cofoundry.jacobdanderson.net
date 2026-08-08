import { getRouterParam, send, sendRedirect, setHeader } from "h3"
import { projectInvestmentWorkspaceForReviewer } from "~/shared/utils/investment-workspaces"
import { requireAuthenticatedSession } from "../../../utils/auth"
import { getFileUploadById } from "../../../utils/file-uploads"
import { findRawInvestmentWorkspaceDocumentByFileUploadId } from "../../../utils/investment-workspace-persistence"
import { assertInvestmentModuleEnabled } from "../../../utils/investment-workspaces"
import { readLocalFileUploadContent } from "../../../utils/local-operations-store"
import { assertRateLimit, buildRateLimitKey } from "../../../utils/rate-limit"
import { createSupabaseAdminClient, isSupabaseEnabled } from "../../../utils/supabase"

function safeFilename(filename: string) {
  return filename.replaceAll(/[^\w.-]+/g, "-").replace(/^\.+/, "").slice(0, 120) || "upload"
}

export default defineEventHandler(async (event) => {
  assertInvestmentModuleEnabled(event)
  const session = await requireAuthenticatedSession(event)
  const uploadId = getRouterParam(event, "id")
  if (!uploadId)
    throw createError({ statusCode: 400, statusMessage: "Upload id is required." })

  assertRateLimit(event, {
    key: buildRateLimitKey(event, session.id),
    limit: 60,
    scope: "files:member-download",
    windowMs: 60 * 60 * 1000,
  })

  const [upload, workspace] = await Promise.all([
    getFileUploadById(event, uploadId),
    findRawInvestmentWorkspaceDocumentByFileUploadId(event, uploadId),
  ])
  const reviewer = ["admin", "investor_admin"].includes(session.role)
  const applicantOwner = !reviewer && workspace?.applicantUserId === session.id
  const reviewerWorkspace = reviewer && workspace ? projectInvestmentWorkspaceForReviewer(workspace) : null
  const item = applicantOwner
    ? workspace.dataRoomItems.find(candidate => candidate.fileUploadId === uploadId)
    : reviewerWorkspace?.dataRoomItems.find(candidate => candidate.fileUploadId === uploadId)
  const authorized = Boolean(workspace && item && (
    applicantOwner
    || reviewerWorkspace
  ))
  const uploadMatchesWorkspace = Boolean(upload && workspace
    && upload.ownerUserId === workspace.applicantUserId
    && upload.purpose === "investment_document"
    && upload.relatedType === "investment_workspace"
    && [workspace.id, workspace.application.id].includes(upload.relatedId || ""))
  if (!upload || !authorized || !uploadMatchesWorkspace || upload.status !== "uploaded" || upload.scanStatus !== "clean" || upload.deletedAt)
    throw createError({ statusCode: 404, statusMessage: "The requested file is not available." })

  setHeader(event, "Cache-Control", "private, no-store")
  setHeader(event, "Content-Security-Policy", "default-src 'none'")
  setHeader(event, "Referrer-Policy", "no-referrer")
  setHeader(event, "X-Content-Type-Options", "nosniff")
  setHeader(event, "Content-Disposition", `attachment; filename="${safeFilename(upload.originalFilename)}"`)

  if (!isSupabaseEnabled(event)) {
    const content = await readLocalFileUploadContent(uploadId)
    if (!content)
      throw createError({ statusCode: 404, statusMessage: "The requested file content was not found." })
    return send(event, content.bytes, content.mimeType)
  }

  const adminClient = createSupabaseAdminClient(event)
  if (!adminClient)
    throw createError({ statusCode: 500, statusMessage: "Supabase admin client is unavailable." })
  const signed = await adminClient.storage
    .from(upload.bucket)
    .createSignedUrl(upload.objectPath, 60, { download: safeFilename(upload.originalFilename) })
  if (signed.error || !signed.data?.signedUrl)
    throw createError({ statusCode: 404, statusMessage: "A secure download URL could not be created." })
  return sendRedirect(event, signed.data.signedUrl, 302)
})
