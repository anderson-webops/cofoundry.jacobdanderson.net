import globals from "globals"
import base from "../eslint.config.js"

export default base.append(
  {
    files: ["**/*.{js,mjs,cjs,ts}"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ["test/**/*.ts"],
    rules: {
      "test/no-import-node-test": "off",
    },
  },
  {
    ignores: ["dist/**"],
  },
)
