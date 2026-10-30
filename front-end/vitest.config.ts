import { fileURLToPath } from "node:url"
import vue from "@vitejs/plugin-vue"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [
    vue()
  ],
  resolve: {
    alias: [
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
