import process from "node:process"
import { appDescription, appName } from "./shared/constants/app"
import { assertEnvironmentIsValid, readEnvironmentSnapshot } from "./shared/utils/environment"

const environment = readEnvironmentSnapshot(process.env)

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
        { rel: "icon", type: "image/svg+xml", href: "/nuxt.svg" },
        { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      ],
      meta: [
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { name: "description", content: appDescription },
        { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
        { name: "theme-color", media: "(prefers-color-scheme: light)", content: "#f7f6f2" },
        { name: "theme-color", media: "(prefers-color-scheme: dark)", content: "#101313" },
      ],
    },
  },
  css: ["~/assets/styles/main.css"],

  colorMode: {
    classSuffix: "",
  },
  runtimeConfig: {
    stripeSecretKey: environment.secret.stripeSecretKey,
    stripeWebhookSecret: environment.secret.stripeWebhookSecret,
    supabaseServiceRoleKey: environment.secret.supabaseServiceRoleKey,
    public: {
      appName,
      appUrl: environment.public.appUrl,
      backendMode: environment.public.backendMode,
      billingMode: environment.public.billingMode,
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
      routes: ["/", "/how-it-works", "/pricing", "/faq", "/safety", "/terms", "/privacy", "/contact"],
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
