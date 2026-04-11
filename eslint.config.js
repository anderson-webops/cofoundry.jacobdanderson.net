import antfu from "@antfu/eslint-config"

export default antfu(
  {
    root: true,
    env: {
      browser: true,
      node: true,
      es2021: true,
    },
    unocss: true,
    stylistic: {
      linebreak: "unix",
      quotes: "double",
      semi: false,
    },
    formatters: {
      css: false,
      html: false,
      markdown: false,
    },
    ignores: [
      "**/*.d.ts",
      "**/.nuxt/**",
      "**/.output/**",
      "**/dist/**",
      "**/node_modules/**",
      "**/.data/**",
    ],
    rules: {
      "antfu/if-newline": "off",
      "no-console": "off",
      "style/comma-dangle": "off",
    },
  },
  {
    files: ["README.md"],
    rules: {
      "markdown/heading-increment": "off",
    },
  },
)
