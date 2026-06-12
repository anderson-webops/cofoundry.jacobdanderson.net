import { requireAuthenticatedSession } from "~/server/utils/auth"
import { loadInboxReadModel } from "../utils/inbox-read-model"

export default defineEventHandler(async (event) => {
  const session = await requireAuthenticatedSession(event)
  const readModel = await loadInboxReadModel(event, session)

  return {
    inbox: readModel.snapshot,
  }
})
