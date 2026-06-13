import { getRouterParam, setHeader } from "h3"
import { renderContractCertificateText } from "~/shared/utils/contract-documents"
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

  assertRateLimit(event, {
    key: buildRateLimitKey(event, session.id),
    limit: 30,
    scope: "contracts:certificate",
    windowMs: 60 * 60 * 1000,
  })

  const contractId = getRouterParam(event, "id")
  if (!contractId)
    throw createError({ statusCode: 400, statusMessage: "Contract id is required." })

  const context = await loadContractArtifactContext(event, contractId)
  const certificate = buildContractExecutionCertificate(context)

  setHeader(event, "Content-Type", "text/plain; charset=utf-8")
  setHeader(event, "Content-Disposition", `attachment; filename="${safeFilename(context.contract.title)}-v${context.version.versionNumber}-certificate.txt"`)

  return renderContractCertificateText(certificate)
})
