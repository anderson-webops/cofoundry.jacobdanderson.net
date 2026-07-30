export function sanitizeErrorResponseBody(body: string | Record<string, unknown>, pathname: string) {
  if (typeof body === "string")
    return body

  return {
    ...body,
    url: pathname,
  }
}
