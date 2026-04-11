import process from "node:process"
import { assertEnvironmentIsValid } from "../../shared/utils/environment"

export default defineNitroPlugin(() => {
  assertEnvironmentIsValid(process.env, "Nuxt server runtime")
})
