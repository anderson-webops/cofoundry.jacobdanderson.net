import { createEventStream } from "h3"
import { requireAuthenticatedSession } from "~/server/utils/auth"
import { safePushWorkspaceRealtimeSink, subscribeWorkspaceRealtime } from "../../utils/workspace-realtime"

export default defineEventHandler(async (event) => {
  const session = await requireAuthenticatedSession(event)
  const stream = createEventStream(event)
  const streamState = { closed: false }
  const unsubscribe = subscribeWorkspaceRealtime(session.id, stream)
  const heartbeat = setInterval(() => {
    void safePushWorkspaceRealtimeSink(stream, {
      data: JSON.stringify({
        createdAt: new Date().toISOString(),
        userId: session.id,
      }),
      event: "heartbeat",
    }, streamState)
  }, 30_000)

  stream.onClosed(async () => {
    streamState.closed = true
    clearInterval(heartbeat)
    unsubscribe()
    try {
      await stream.close()
    }
    catch {}
  })

  await safePushWorkspaceRealtimeSink(stream, {
    data: JSON.stringify({
      createdAt: new Date().toISOString(),
      source: "workspace.realtime.connected",
      userId: session.id,
    }),
    event: "connected",
    retry: 5000,
  }, streamState)

  return stream.send()
})
