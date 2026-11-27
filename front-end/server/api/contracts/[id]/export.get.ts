import { createError, defineEventHandler, getQuery, getRouterParam, setHeader } from "h3"
import { renderContractHtmlDocument } from "~/shared/utils/contract-documents"
import { requireAuthenticatedSession } from "../../../utils/auth"
import { loadContractArtifactContext } from "../../../utils/contract-artifacts"
import { buildContractExecutionCertificate } from "../../../utils/contract-certificate"
import { assertRateLimit, buildRateLimitKey } from "../../../utils/rate-limit"

const unsafeFilenamePattern = /[^\w.-]+/g

function safeFilename(value: string) {
  return value.toLowerCase().replaceAll(unsafeFilenamePattern, "-").replace(/^-|-$/g, "") || "cofoundry-contract"
}

export default defineEventHandler(async (event) => {
  const session = await requireAuthenticatedSession(event)
  const query = getQuery(event)

  assertRateLimit(event, {
    key: buildRateLimitKey(event, session.id),
    limit: 30,
    scope: "contracts:export",
    windowMs: 60 * 60 * 1000,
  })

  const contractId = getRouterParam(event, "id")
  if (!contractId)
    throw createError({ statusCode: 400, statusMessage: "Contract id is required." })

  const context = await loadContractArtifactContext(event, contractId)
  const format = query.format === "text" || query.format === "txt"
    ? "text"
    : "html"

  if (format === "text") {
    setHeader(event, "Content-Type", "text/plain; charset=utf-8")
    setHeader(event, "Content-Disposition", `attachment; filename="${safeFilename(context.contract.title)}-v${context.version.versionNumber}.txt"`)

    return context.documentText
  }

  const certificate = buildContractExecutionCertificate(context)
  const document = renderContractHtmlDocument(context.contract, context.version, context.signatures, certificate)

  setHeader(event, "Content-Type", "text/html; charset=utf-8")
  setHeader(event, "Content-Disposition", `attachment; filename="${safeFilename(context.contract.title)}-v${context.version.versionNumber}.html"`)

  return document
})
