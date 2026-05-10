import process from "node:process"
import { createClient } from "@supabase/supabase-js"
import { bootstrapAdmin, resolveBootstrapAdminEnvironment, resolveBootstrapAdminInput } from "../src/bootstrap-admin.js"

async function main() {
  const input = resolveBootstrapAdminInput(process.env)
  const environment = resolveBootstrapAdminEnvironment(process.env)
  const client = createClient(environment.supabaseUrl, environment.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  })

  const result = await bootstrapAdmin(client, input)
  console.log(`Bootstrapped CoFoundry ${result.role} user ${result.email || result.userId}.`)
  console.log(`Admin action recorded: ${result.actionId} at ${result.createdAt}.`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
