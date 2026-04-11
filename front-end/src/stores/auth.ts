import type { SessionUser } from "~/shared/types/domain"
import { acceptHMRUpdate, defineStore } from "pinia"
import { useSessionState } from "~/composables/useSessionState"
import { useWorkspaceStore } from "~/stores/workspace"

interface AuthResponse {
  session: SessionUser
}

export const useAuthStore = defineStore("auth", () => {
  const pending = ref(false)
  const error = ref("")
  const { session, setSession } = useSessionState()
  const workspaceStore = useWorkspaceStore()

  const currentUser = computed(() => session.value)
  const isAuthenticated = computed(() => Boolean(session.value))
  const isAdmin = computed(() => ["admin", "investor_admin"].includes(session.value?.role || ""))

  function clearError() {
    error.value = ""
  }

  async function signIn(payload: { email: string, password: string }) {
    pending.value = true
    clearError()

    try {
      const response = await $fetch<AuthResponse>("/api/auth/sign-in", {
        method: "POST",
        body: payload,
      })

      setSession(response.session)
      workspaceStore.ensureSessionUser(response.session)
      return response.session
    }
    catch (caughtError) {
      error.value = caughtError instanceof Error ? caughtError.message : "Unable to sign in."
      throw caughtError
    }
    finally {
      pending.value = false
    }
  }

  async function signUp(payload: { name: string, email: string, password: string }) {
    pending.value = true
    clearError()

    try {
      const response = await $fetch<AuthResponse>("/api/auth/sign-up", {
        method: "POST",
        body: payload,
      })

      setSession(response.session)
      workspaceStore.ensureSessionUser(response.session)
      workspaceStore.createDraftUserFromSignUp(response.session, payload.name)
      return response.session
    }
    catch (caughtError) {
      error.value = caughtError instanceof Error ? caughtError.message : "Unable to create account."
      throw caughtError
    }
    finally {
      pending.value = false
    }
  }

  async function signInWithProvider(provider: "google" | "github") {
    pending.value = true
    clearError()

    try {
      const response = await $fetch<AuthResponse>("/api/auth/oauth", {
        method: "POST",
        body: { provider },
      })

      setSession(response.session)
      workspaceStore.ensureSessionUser(response.session)
      return response.session
    }
    catch (caughtError) {
      error.value = caughtError instanceof Error ? caughtError.message : "Unable to sign in."
      throw caughtError
    }
    finally {
      pending.value = false
    }
  }

  async function signOut() {
    await $fetch("/api/auth/sign-out", { method: "POST" })
    setSession(null)
  }

  async function completeOnboarding(nextSession: SessionUser) {
    pending.value = true

    try {
      const response = await $fetch<AuthResponse>("/api/auth/complete-onboarding", {
        method: "POST",
        body: { session: nextSession },
      })

      setSession(response.session)
      return response.session
    }
    finally {
      pending.value = false
    }
  }

  return {
    currentUser,
    error,
    isAdmin,
    isAuthenticated,
    pending,
    clearError,
    completeOnboarding,
    signIn,
    signInWithProvider,
    signOut,
    signUp,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useAuthStore, import.meta.hot))
