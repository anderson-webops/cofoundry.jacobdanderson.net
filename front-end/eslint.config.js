import base from "../eslint.config.js"
import nuxt from "./.nuxt/eslint.config.mjs"

export default base.append(nuxt())
