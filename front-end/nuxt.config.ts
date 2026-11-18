import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import process from "node:process"
import { buildContentSecurityPolicyDirectives, buildSecurityHeaders } from "./server/utils/security-headers"
import { appDescription, appName } from "./shared/constants/app"
import { privateApiRoutePrefixes, privateWorkspaceRoutePrefixes } from "./shared/constants/route-surfaces"
import { workspaceSeed } from "./shared/data/seed"
import { getPublicRoutePaths } from "./shared/utils/directory"
import { assertEnvironmentIsValid, isLocalDevelopmentEnvironment, readDeploymentMetadata, readEnvironmentSnapshot, releaseTagFromPackageVersion } from "./shared/utils/environment"
import { isPublicSiteUrl } from "./shared/utils/seo"
import { defaultThemeSchemeDefinition } from "./shared/utils/theme"

function readGitMetadata(args: string[]) {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim()
  }
  catch {
    return ""
  }
}

function readFrontendPackageVersion() {
  try {
    const packageJson = JSON.parse(readFileSync(new URL("package.json", import.meta.url), "utf8")) as { version?: unknown }
    return typeof packageJson.version === "string"
      ? packageJson.version
      : ""
  }
  catch {
    return ""
  }
}

const environment = readEnvironmentSnapshot(process.env)
const isProductionLike = process.env.NODE_ENV === "production" || !isLocalDevelopmentEnvironment(process.env)
const explicitDeploymentMetadata = readDeploymentMetadata(process.env)
const packageRelease = releaseTagFromPackageVersion(readFrontendPackageVersion())
const buildDeploymentMetadata = {
  commitSha: explicitDeploymentMetadata.commitSha || readGitMetadata(["rev-parse", "HEAD"]),
  deployedAt: explicitDeploymentMetadata.deployedAt,
  release: explicitDeploymentMetadata.release || packageRelease || readGitMetadata([
    "describe",
    "--tags",
    "--exact-match",
    "HEAD"
  ]),
}
const publicRoutes = getPublicRoutePaths(workspaceSeed)
const prerenderPublicRoutes = isPublicSiteUrl(environment.public.appUrl)
  ? publicRoutes
  : []
const securityHeaders = buildSecurityHeaders({
  appUrl: environment.public.appUrl,
  backendMode: environment.public.backendMode,
  billingMode: environment.public.billingMode,
  includeContentSecurityPolicy: false,
  isProduction: isProductionLike,
  stripePublishableKey: environment.public.stripePublishableKey,
  supabaseUrl: environment.public.supabaseUrl,
})
const privateRouteHeaders = {
  ...securityHeaders,
  "X-Robots-Tag": "noindex, nofollow",
}
const privateRouteRules = Object.fromEntries(
  [
    ...privateWorkspaceRoutePrefixes,
    ...privateApiRoutePrefixes
  ]
    .flatMap(prefix => [
      [
        prefix,
        { headers: privateRouteHeaders }
      ] as const,
      [
        `${prefix}/**`,
        { headers: privateRouteHeaders }
      ] as const,
    ]),
)
const isNuxtAnalysisCommand = process.argv
  .slice(2)
  .some(argument => ["prepare", "typecheck"].includes(argument))
const contentSecurityPolicy = buildContentSecurityPolicyDirectives({
  appUrl: environment.public.appUrl,
  backendMode: environment.public.backendMode,
  billingMode: environment.public.billingMode,
  isProduction: process.env.NODE_ENV === "production",
  stripePublishableKey: environment.public.stripePublishableKey,
  supabaseUrl: environment.public.supabaseUrl,
})

if (!isNuxtAnalysisCommand)
  assertEnvironmentIsValid(process.env, "Nuxt configuration")

export default defineNuxtConfig({
  modules: [
    "nuxt-security",
    "@vueuse/nuxt",
    "@unocss/nuxt",
    "@pinia/nuxt",
    "@nuxtjs/color-mode",
    "@nuxt/eslint",
    "nuxt-explicit-imports",
  ],

  explicitImports: {
    mode: "strict",
  },

  components: [
    {
      path: "~/components",
      pathPrefix: false,
    },
  ],

  devtools: {
    enabled: !isProductionLike && process.env.NUXT_DEVTOOLS_ENABLED !== "false",
  },

  app: {
    head: {
      title: appName,
      titleTemplate: `%s · ${appName}`,
      viewport: "width=device-width,initial-scale=1",
      link: [
        { rel: "icon", href: "/favicon.ico", sizes: "any" },
        { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
        {
          rel: "icon",
          type: "image/png",
          sizes: "32x32",
          href: "/favicon-32x32.png"
        },
        {
          rel: "icon",
          type: "image/png",
          sizes: "16x16",
          href: "/favicon-16x16.png"
        },
        { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
        { rel: "manifest", href: "/site.webmanifest" },
      ],
      meta: [
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { name: "description", content: appDescription },
        { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
        { name: "theme-color", media: "(prefers-color-scheme: light)", content: defaultThemeSchemeDefinition.modes.light["--bg"] },
        { name: "theme-color", media: "(prefers-color-scheme: dark)", content: defaultThemeSchemeDefinition.modes.dark["--bg"] },
      ],
    },
  },
  css: ["~/assets/styles/main.css"],

  colorMode: {
    classSuffix: "",
  },
  runtimeConfig: {
    deploymentCommitSha: buildDeploymentMetadata.commitSha,
    deploymentDeployedAt: buildDeploymentMetadata.deployedAt,
    deploymentRelease: buildDeploymentMetadata.release,
    operationsWorkerToken: "",
    stripeSecretKey: "",
    stripeWebhookSecret: "",
    supabaseServiceRoleKey: "",
    public: {
      appName,
      appUrl: environment.public.appUrl,
      backendMode: environment.public.backendMode,
      billingMode: environment.public.billingMode,
      enableDemoAccess: environment.public.enableDemoAccess,
      featureInvestmentModule: environment.public.featureInvestmentModule,
      stripePriceProMonthly: environment.public.stripePriceProMonthly,
      stripePriceTeamMonthly: environment.public.stripePriceTeamMonthly,
      stripePublishableKey: environment.public.stripePublishableKey,
      supabaseAnonKey: environment.public.supabaseAnonKey,
      supabaseUrl: environment.public.supabaseUrl,
      supportEmail: environment.public.supportEmail,
    },
  },

  srcDir: "src",

  future: {
    compatibilityVersion: 4,
  },

  experimental: {
    payloadExtraction: false,
    renderJsonPayloads: true,
    typedPages: true,
  },

  compatibilityDate: "2024-08-14",

  nitro: {
    errorHandler: "./server/error-handler.ts",
    esbuild: {
      options: {
        target: "esnext",
      },
    },
    prerender: {
      crawlLinks: false,
      routes: prerenderPublicRoutes,
    },
    routeRules: {
      "/**": { headers: securityHeaders },
      ...privateRouteRules,
    },
  },
  vite: {
    build: {
      modulePreload: {
        // Avoid Vite 7's polyfill transform, which emits a sourcemap warning in Nuxt builds.
        polyfill: false,
      },
    },
  },

  eslint: {
    config: {
      standalone: false,
      nuxt: {
        sortConfigKeys: true,
      },
    },
  },
  security: {
    allowedMethodsRestricter: false,
    basicAuth: false,
    contentSecurityPolicyReportOnly: false,
    corsHandler: false,
    csrf: false,
    enabled: true,
    headers: {
      contentSecurityPolicy: isProductionLike
        ? contentSecurityPolicy
        : false,
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: false,
      crossOriginResourcePolicy: false,
      originAgentCluster: false,
      permissionsPolicy: false,
      referrerPolicy: false,
      strictTransportSecurity: false,
      xContentTypeOptions: false,
      xDNSPrefetchControl: false,
      xDownloadOptions: false,
      xFrameOptions: false,
      xPermittedCrossDomainPolicies: false,
      xXSSProtection: false,
    },
    hidePoweredBy: true,
    nonce: isProductionLike,
    rateLimiter: false,
    removeLoggers: false,
    requestSizeLimiter: false,
    sri: isProductionLike,
    ssg: isProductionLike
      ? {
          exportToPresets: true,
          hashScripts: true,
          hashStyles: false,
          meta: true,
          nitroHeaders: true,
        }
      : false,
    strict: false,
    xssValidator: false,
  },
})
