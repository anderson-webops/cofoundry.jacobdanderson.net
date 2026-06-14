import process from "node:process"
import { collectEnvironmentValidationErrors, isLocalDevelopmentEnvironment, readEnvironmentSnapshot } from "~/shared/utils/environment"
import { listAccessRequests } from "../../utils/access-requests"
import { requireAdminSession } from "../../utils/admin"
import { readAdminOperationsRows } from "../../utils/admin-operations"
import { readAdminPosture } from "../../utils/admin-posture"
import { isContactMailConfigured } from "../../utils/contact"
import { listPrivacyRequests } from "../../utils/privacy-requests"
import { buildProductionReadinessSnapshot } from "../../utils/production-readiness"
import { assertRateLimit, buildRateLimitKey } from "../../utils/rate-limit"

function hasValue(value?: string) {
  return Boolean(value?.trim())
}

function hasAnyValue(keys: string[]) {
  return keys.some(key => hasValue(process.env[key]))
}

export default defineEventHandler(async (event) => {
  const session = await requireAdminSession(event)

  assertRateLimit(event, {
    key: buildRateLimitKey(event, session.id),
    limit: 30,
    scope: "admin:readiness",
    windowMs: 60 * 1000,
  })

  const runtimeConfig = useRuntimeConfig(event)
  const [accessRequests, privacyRequests, operations, adminPosture] = await Promise.all([
    listAccessRequests(event),
    listPrivacyRequests(event),
    readAdminOperationsRows(event),
    readAdminPosture(event),
  ])

  return buildProductionReadinessSnapshot({
    accessRequests,
    adminPosture,
    contactMailConfigured: isContactMailConfigured(),
    environment: readEnvironmentSnapshot(process.env),
    environmentValidationErrors: collectEnvironmentValidationErrors(process.env),
    generatedAt: new Date().toISOString(),
    hasAlertWebhookConfigured: hasValue(process.env.COFOUNDRY_ALERT_WEBHOOK_URL),
    hasContractEnvelopeProviderConfigured: hasAnyValue([
      "COFOUNDRY_CONTRACT_ENVELOPE_PROVIDER",
      "COFOUNDRY_ESIGNATURE_PROVIDER",
      "COFOUNDRY_PDF_PROVIDER",
    ]),
    hasDurableLocalDataDir: hasValue(process.env.COFOUNDRY_LOCAL_DATA_DIR),
    hasEmailSuppressionProviderConfigured: hasAnyValue([
      "COFOUNDRY_EMAIL_SUPPRESSION_PROVIDER",
      "COFOUNDRY_MAIL_SUPPRESSION_PROVIDER",
    ]),
    hasOAuthProviderConfigured: hasAnyValue([
      "COFOUNDRY_OAUTH_PROVIDER",
      "COFOUNDRY_EXTERNAL_AUTH_PROVIDER",
      "COFOUNDRY_GOOGLE_OAUTH_PROVIDER",
      "COFOUNDRY_GITHUB_OAUTH_PROVIDER",
    ]),
    hasOperationsWorkerToken: hasValue(runtimeConfig.operationsWorkerToken) || hasValue(process.env.COFOUNDRY_OPERATIONS_TOKEN) || hasValue(process.env.OPERATIONS_WORKER_TOKEN),
    hasSessionSigningSecret: hasValue(process.env.NUXT_SESSION_SIGNING_SECRET) || hasValue(process.env.SESSION_SIGNING_SECRET),
    hasTrustVerificationProviderConfigured: hasAnyValue([
      "COFOUNDRY_TRUST_VERIFICATION_PROVIDER",
      "COFOUNDRY_IDENTITY_VERIFICATION_PROVIDER",
      "COFOUNDRY_DOMAIN_VERIFICATION_PROVIDER",
      "COFOUNDRY_SOCIAL_VERIFICATION_PROVIDER",
    ]),
    isLocalDevelopment: isLocalDevelopmentEnvironment(process.env),
    operations,
    privacyRequests,
  })
})
