import type {
  AdminAction,
  FileScanStatus,
  FileUpload,
  FileUploadPurpose,
  FileUploadRelatedType,
  FileUploadStatus,
  PrivacyRequest,
  WorkspaceSeed,
} from "../types/domain"
import { getProfileByUserId, getUserById } from "./workspace"

export type AdminEvidencePackageState = "needs_scan" | "flagged" | "needs_review" | "reviewed" | "request_only" | "resolved"

export interface AdminEvidencePackage {
  createdAt: string
  filename: string | null
  id: string
  mimeType: string | null
  ownerLabel: string
  purpose: FileUploadPurpose | "safety_privacy_request"
  relatedId: string | null
  relatedType: FileUploadRelatedType | null
  reviewedAt: string | null
  reviewedByLabel: string | null
  reviewedByUserId: string | null
  scanNotes: string | null
  scanStatus: FileScanStatus | null
  sizeBytes: number | null
  source: "file_upload" | "privacy_request"
  state: AdminEvidencePackageState
  stateLabel: string
  summary: string
  targetId: string
  targetType: "file_upload" | "privacy_request"
  title: string
  uploadStatus: FileUploadStatus | null
  updatedAt: string
  userId: string
  privacyRequestDetails: string | null
  privacyRequestId: string | null
  privacyRequestStatus: PrivacyRequest["status"] | null
}

export interface AdminEvidencePackageInput {
  adminActions?: AdminAction[]
  fileUploads?: Array<FileUpload | Record<string, unknown>>
  privacyRequests?: PrivacyRequest[]
  seed: WorkspaceSeed
}

const fileScanStatuses = new Set<FileScanStatus>([
  "pending",
  "clean",
  "flagged",
  "failed",
  "skipped"
])
const fileUploadStatuses = new Set<FileUploadStatus>([
  "pending",
  "uploaded",
  "blocked",
  "deleted"
])
const fileUploadPurposes = new Set<FileUploadPurpose>([
  "message_attachment",
  "proposal_attachment",
  "contract_attachment",
  "trust_evidence",
  "investment_document"
])
const fileUploadRelatedTypes = new Set<FileUploadRelatedType>([
  "message",
  "proposal",
  "contract",
  "profile",
  "opportunity",
  "investment_workspace"
])

function stringValue(row: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "string")
      return value
  }

  return null
}

function numberValue(row: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "number" && Number.isFinite(value))
      return value
  }

  return null
}

function nullableStringValue(row: Record<string, unknown>, ...keys: string[]) {
  const value = stringValue(row, ...keys)
  return value && value.length
    ? value
    : null
}

function coercePurpose(value: string | null) {
  return value && fileUploadPurposes.has(value as FileUploadPurpose)
    ? value as FileUploadPurpose
    : null
}

function coerceUploadStatus(value: string | null) {
  return value && fileUploadStatuses.has(value as FileUploadStatus)
    ? value as FileUploadStatus
    : "pending"
}

function coerceScanStatus(value: string | null) {
  return value && fileScanStatuses.has(value as FileScanStatus)
    ? value as FileScanStatus
    : "pending"
}

function coerceRelatedType(value: string | null) {
  return value && fileUploadRelatedTypes.has(value as FileUploadRelatedType)
    ? value as FileUploadRelatedType
    : null
}

function normalizeFileUpload(input: FileUpload | Record<string, unknown>): FileUpload | null {
  const row = input as Record<string, unknown>
  const id = stringValue(row, "id")
  const ownerUserId = stringValue(row, "ownerUserId", "owner_user_id")
  const purpose = coercePurpose(stringValue(row, "purpose"))

  if (!id || !ownerUserId || purpose !== "trust_evidence")
    return null

  return {
    id,
    ownerUserId,
    bucket: stringValue(row, "bucket") || "",
    objectPath: stringValue(row, "objectPath", "object_path") || "",
    originalFilename: stringValue(row, "originalFilename", "original_filename") || "Evidence upload",
    mimeType: stringValue(row, "mimeType", "mime_type") || "application/octet-stream",
    sizeBytes: numberValue(row, "sizeBytes", "size_bytes") || 0,
    purpose,
    relatedType: coerceRelatedType(nullableStringValue(row, "relatedType", "related_type")),
    relatedId: nullableStringValue(row, "relatedId", "related_id"),
    status: coerceUploadStatus(stringValue(row, "status")),
    scanStatus: coerceScanStatus(stringValue(row, "scanStatus", "scan_status")),
    scanNotes: nullableStringValue(row, "scanNotes", "scan_notes"),
    createdAt: stringValue(row, "createdAt", "created_at") || new Date(0).toISOString(),
    updatedAt: stringValue(row, "updatedAt", "updated_at") || stringValue(row, "createdAt", "created_at") || new Date(0).toISOString(),
    deletedAt: nullableStringValue(row, "deletedAt", "deleted_at"),
  }
}

function newestFirst<T extends { createdAt: string }>(rows: T[]) {
  return [...rows].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
}

function getOwnerLabel(seed: WorkspaceSeed, userId: string) {
  const profile = getProfileByUserId(seed, userId)
  const user = getUserById(seed, userId)
  return profile?.displayName || user?.email || userId
}

function getLatestEvidenceReview(actions: AdminAction[], targetType: AdminEvidencePackage["targetType"], targetId: string) {
  return newestFirst(actions.filter(action => (
    action.targetType === targetType
    && action.targetId === targetId
    && action.type === "review_evidence"
  ))).at(0) || null
}

function getMatchingPrivacyRequest(upload: FileUpload, privacyRequests: PrivacyRequest[]) {
  return newestFirst(privacyRequests.filter(request => (
    request.userId === upload.ownerUserId
    && request.type === "safety_privacy"
  ))).at(0) || null
}

function stateForUpload(upload: FileUpload, reviewAction: AdminAction | null): AdminEvidencePackageState {
  if (upload.scanStatus === "flagged" || upload.status === "blocked")
    return "flagged"

  if (["pending", "failed", "skipped"].includes(upload.scanStatus))
    return "needs_scan"

  return reviewAction ? "reviewed" : "needs_review"
}

function stateLabel(state: AdminEvidencePackageState) {
  return {
    flagged: "Flagged",
    needs_review: "Needs review",
    needs_scan: "Needs scan",
    request_only: "Needs evidence",
    resolved: "Resolved",
    reviewed: "Reviewed",
  }[state]
}

function summaryForUpload(upload: FileUpload, request: PrivacyRequest | null) {
  const scanText = upload.scanNotes || `Scan status: ${upload.scanStatus}.`
  if (!request)
    return scanText

  return `${scanText} Linked safety/privacy request: ${request.details}`
}

export function buildAdminEvidencePackages(input: AdminEvidencePackageInput) {
  const privacyRequests = input.privacyRequests || []
  const actions = input.adminActions || input.seed.adminActions
  const uploadById = new Map<string, FileUpload>()

  for (const upload of [
    ...input.seed.fileUploads,
    ...(input.fileUploads || [])
  ]) {
    const normalizedUpload = normalizeFileUpload(upload)
    if (normalizedUpload?.deletedAt)
      uploadById.delete(normalizedUpload.id)
    else if (normalizedUpload)
      uploadById.set(normalizedUpload.id, normalizedUpload)
  }

  const uploadPackages: AdminEvidencePackage[] = [
    ...uploadById.values()
  ].map((upload) => {
    const request = getMatchingPrivacyRequest(upload, privacyRequests)
    const reviewAction = getLatestEvidenceReview(actions, "file_upload", upload.id)
    const reviewedByLabel = reviewAction
      ? getOwnerLabel(input.seed, reviewAction.adminUserId)
      : null
    const state = stateForUpload(upload, reviewAction)
    const ownerLabel = getOwnerLabel(input.seed, upload.ownerUserId)

    return {
      createdAt: upload.createdAt,
      filename: upload.originalFilename,
      id: `file_upload:${upload.id}`,
      mimeType: upload.mimeType,
      ownerLabel,
      purpose: upload.purpose,
      relatedId: upload.relatedId,
      relatedType: upload.relatedType,
      reviewedAt: reviewAction?.createdAt || null,
      reviewedByLabel,
      reviewedByUserId: reviewAction?.adminUserId || null,
      scanNotes: upload.scanNotes,
      scanStatus: upload.scanStatus,
      sizeBytes: upload.sizeBytes,
      source: "file_upload",
      state,
      stateLabel: stateLabel(state),
      summary: summaryForUpload(upload, request),
      targetId: upload.id,
      targetType: "file_upload",
      title: upload.originalFilename,
      uploadStatus: upload.status,
      updatedAt: upload.updatedAt,
      userId: upload.ownerUserId,
      privacyRequestDetails: request?.details || null,
      privacyRequestId: request?.id || null,
      privacyRequestStatus: request?.status || null,
    }
  })

  const coveredRequestIds = new Set(uploadPackages.map(item => item.privacyRequestId).filter(Boolean))
  const requestPackages: AdminEvidencePackage[] = newestFirst(privacyRequests)
    .filter(request => request.type === "safety_privacy" && !coveredRequestIds.has(request.id))
    .map((request) => {
      const reviewAction = getLatestEvidenceReview(actions, "privacy_request", request.id)
      const reviewedByLabel = reviewAction
        ? getOwnerLabel(input.seed, reviewAction.adminUserId)
        : null
      const state: AdminEvidencePackageState = request.status === "resolved"
        ? "resolved"
        : reviewAction || request.status === "reviewed"
          ? "reviewed"
          : "request_only"

      return {
        createdAt: request.createdAt,
        filename: null,
        id: `privacy_request:${request.id}`,
        mimeType: null,
        ownerLabel: getOwnerLabel(input.seed, request.userId),
        purpose: "safety_privacy_request",
        relatedId: null,
        relatedType: null,
        reviewedAt: reviewAction?.createdAt || request.reviewedAt,
        reviewedByLabel,
        reviewedByUserId: reviewAction?.adminUserId || request.reviewedByUserId,
        scanNotes: null,
        scanStatus: null,
        sizeBytes: null,
        source: "privacy_request",
        state,
        stateLabel: stateLabel(state),
        summary: request.details,
        targetId: request.id,
        targetType: "privacy_request",
        title: "Safety/privacy evidence request",
        uploadStatus: null,
        updatedAt: request.resolvedAt || request.reviewedAt || request.createdAt,
        userId: request.userId,
        privacyRequestDetails: request.details,
        privacyRequestId: request.id,
        privacyRequestStatus: request.status,
      }
    })

  return newestFirst([
    ...uploadPackages,
    ...requestPackages
  ])
}
