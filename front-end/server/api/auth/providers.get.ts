import process from "node:process"
import { setHeader } from "h3"
import { readConfiguredOAuthProviders } from "~/shared/utils/oauth-providers"
import { isSupabaseEnabled } from "../../utils/supabase"

export default defineEventHandler((event) => {
  setHeader(event, "Cache-Control", "no-store")

  return {
    providers: isSupabaseEnabled(event)
      ? [
          ...readConfiguredOAuthProviders(process.env)
        ]
      : [],
  }
})
