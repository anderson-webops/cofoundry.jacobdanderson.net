import { readSession } from "~/server/utils/auth"

export default defineEventHandler((event) => {
  return { session: readSession(event) }
})
