import type { AuthProvider } from "~/shared/types/domain"

export interface DemoAuthAccount {
  email: string
  password: string
  providers: AuthProvider[]
  userId: string
}

export const demoAuthAccounts: DemoAuthAccount[] = [
  { email: "olivia@cofoundry.dev", password: "founder123", providers: ["email", "github"], userId: "user_olivia" },
  { email: "malik@cofoundry.dev", password: "builder123", providers: ["email", "google"], userId: "user_malik" },
  { email: "ava@cofoundry.dev", password: "admin123", providers: ["email"], userId: "user_ava" },
  { email: "emma@cofoundry.dev", password: "operator123", providers: ["email"], userId: "user_emma" },
]
