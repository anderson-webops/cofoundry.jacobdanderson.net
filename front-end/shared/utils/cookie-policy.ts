export function getSessionCookieSecurityOptions(secure: boolean) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax" as const,
    secure,
  }
}

export function getSessionCookieWriteOptions(secure: boolean, maxAge: number) {
  return {
    ...getSessionCookieSecurityOptions(secure),
    maxAge,
  }
}

export function getPreferenceCookieOptions(secure: boolean, maxAge: number) {
  return {
    httpOnly: false,
    maxAge,
    path: "/",
    sameSite: "lax" as const,
    secure,
  }
}
