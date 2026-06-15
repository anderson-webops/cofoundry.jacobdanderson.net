import { createEventStream } from "h3"
import { requireAuthenticatedSession } from "~/server/utils/auth"
import { subscribeWorkspaceRealtime } from "../../utils/workspace-realtime"

export default defineEventHandler(async (event) => {
  const session = await requireAuthenticatedSession(event)
  const stream = createEventStream(event)
  const unsubscribe = subscribeWorkspaceRealtime(session.id, stream)
  const heartbeat = setInterval(() => {
    void stream.push({
      data: JSON.stringify({
        createdAt: new Date().toISOString(),
        userId: session.id,
      }),
      event: "heartbeat",
    })
  }, 30_000)

  stream.onClosed(async () => {
    clearInterval(heartbeat)
    unsubscribe()
    await stream.close()
  })

  await stream.push({
    data: JSON.stringify({
      createdAt: new Date().toISOString(),
      source: "workspace.realtime.connected",
      userId: session.id,
    }),
    event: "connected",
    retry: 5000,
  })

  return stream.send()
})
