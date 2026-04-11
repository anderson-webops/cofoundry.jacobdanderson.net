import process from "node:process"
import { appDescription, appName } from "./shared/constants/app"
import { pwa } from "./src/config/pwa"

export default defineNuxtConfig({
  modules: [
    "@vueuse/nuxt",
    "@unocss/nuxt",
    "@pinia/nuxt",
    "@nuxtjs/color-mode",
    "@vite-pwa/nuxt",
    "@nuxt/eslint",
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
    stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    public: {
      appName,
      appUrl: process.env.NUXT_PUBLIC_APP_URL || "http://localhost:3000",
      backendMode: process.env.NUXT_PUBLIC_BACKEND_MODE || "mock",
      billingMode: process.env.NUXT_PUBLIC_BILLING_MODE || "mock",
      featureInvestmentModule: process.env.NUXT_PUBLIC_FEATURE_INVESTMENT_MODULE === "true",
      stripePriceProMonthly: process.env.NUXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY || "",
      stripePriceTeamMonthly: process.env.NUXT_PUBLIC_STRIPE_PRICE_TEAM_MONTHLY || "",
      stripePublishableKey: process.env.NUXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "",
      supabaseAnonKey: process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY || "",
      supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL || "",
      supportEmail: process.env.NUXT_PUBLIC_SUPPORT_EMAIL || "support@cofoundry.dev",
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

  pwa,
})
