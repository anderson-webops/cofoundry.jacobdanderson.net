import { fileURLToPath } from "node:url"
import vue from "@vitejs/plugin-vue"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [
    vue()
  ],
  resolve: {
    alias: [
      { find: /^~\/(components|composables|stores)\//, replacement: `${fileURLToPath(new URL("./src/", import.meta.url))}/$1/` },
      {
        find: "#app",
        replacement: fileURLToPath(new URL("./test/fixtures/nuxt-app.ts", import.meta.url))
      },
      {
        find: "#components",
        replacement: fileURLToPath(new URL("./test/fixtures/nuxt-components.ts", import.meta.url))
      },
      {
        find: "nitropack/runtime",
        replacement: fileURLToPath(new URL("./test/fixtures/nuxt-runtime.ts", import.meta.url))
      },
      { find: /^~\//, replacement: `${fileURLToPath(new URL(".", import.meta.url))}/` },
      { find: /^@\//, replacement: `${fileURLToPath(new URL(".", import.meta.url))}/` },
    ],
  },
  test: {
    environment: "happy-dom",
    globals: true,
    include: ["test/**/*.test.ts"],
  },
})
