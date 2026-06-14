import process from "node:process"
import { buildSecurityHeaders } from "./server/utils/security-headers"
import { appDescription, appName } from "./shared/constants/app"
import { privateApiRoutePrefixes, privateWorkspaceRoutePrefixes } from "./shared/constants/route-surfaces"
import { workspaceSeed } from "./shared/data/seed"
import { getPublicRoutePaths } from "./shared/utils/directory"
import { assertEnvironmentIsValid, readEnvironmentSnapshot } from "./shared/utils/environment"
import { isPublicSiteUrl } from "./shared/utils/seo"
import { defaultThemeSchemeDefinition } from "./shared/utils/theme"

const environment = readEnvironmentSnapshot(process.env)
const publicRoutes = getPublicRoutePaths(workspaceSeed)
const prerenderPublicRoutes = isPublicSiteUrl(environment.public.appUrl) ? publicRoutes : []
const securityHeaders = buildSecurityHeaders({
  appUrl: environment.public.appUrl,
  backendMode: environment.public.backendMode,
  billingMode: environment.public.billingMode,
  isProduction: process.env.NODE_ENV === "production",
  stripePublishableKey: environment.public.stripePublishableKey,
  supabaseUrl: environment.public.supabaseUrl,
})
const privateRouteHeaders = {
  ...securityHeaders,
  "X-Robots-Tag": "noindex, nofollow",
}
const privateRouteRules = Object.fromEntries(
  [...privateWorkspaceRoutePrefixes, ...privateApiRoutePrefixes]
    .flatMap(prefix => [
      [prefix, { headers: privateRouteHeaders }] as const,
      [`${prefix}/**`, { headers: privateRouteHeaders }] as const,
    ]),
)

assertEnvironmentIsValid(process.env, "Nuxt configuration")

export default defineNuxtConfig({
  modules: [
    "@vueuse/nuxt",
    "@unocss/nuxt",
    "@pinia/nuxt",
    "@nuxtjs/color-mode",
    "@nuxt/eslint",
  ],

  components: [
    {
      path: "~/components",
      pathPrefix: false,
    },
  ],

  devtools: {
    enabled: true,
  },

  app: {
    head: {
      title: appName,
      titleTemplate: `%s · ${appName}`,
      viewport: "width=device-width,initial-scale=1",
      link: [
        { rel: "icon", href: "/favicon.ico", sizes: "any" },
        { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
        { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32x32.png" },
        { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16x16.png" },
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
    operationsWorkerToken: environment.secret.operationsWorkerToken,
    stripeSecretKey: environment.secret.stripeSecretKey,
    stripeWebhookSecret: environment.secret.stripeWebhookSecret,
    supabaseServiceRoleKey: environment.secret.supabaseServiceRoleKey,
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
})
