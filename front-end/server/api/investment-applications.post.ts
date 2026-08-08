export default defineEventHandler(() => {
  throw createError({
    statusCode: 410,
    statusMessage: "This legacy submission route has been retired. Use the versioned investment workspace application flow.",
  })
})
