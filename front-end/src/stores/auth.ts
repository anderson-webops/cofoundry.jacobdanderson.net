import type { SessionUser } from "~/shared/types/domain"
import type { SupportedOAuthProvider } from "~/shared/utils/oauth-providers"
import { acceptHMRUpdate, defineStore } from "pinia"
import { useSessionState } from "~/composables/useSessionState"
import { useWorkspaceStore } from "~/stores/workspace"

interface SessionAuthResponse {
  session: SessionUser
}

interface SignUpAuthResponse {
  pendingVerification: boolean
  session: SessionUser | null
}

interface OAuthAuthResponse {
  redirectUrl?: string
  session?: SessionUser
}

export const useAuthStore = defineStore("auth", () => {
  const pending = ref(false)
  const error = ref("")
  const { session, setSession } = useSessionState()
  const workspaceStore = useWorkspaceStore()

  const currentUser = computed(() => session.value)
  const isAuthenticated = computed(() => Boolean(session.value))
  const isAdmin = computed(() => session.value?.role === "admin")

  function clearError() {
    error.value = ""
  }

  async function signIn(payload: { email: string, password: string }) {
    pending.value = true
    clearError()

    try {
      const response = await $fetch<SessionAuthResponse>("/api/auth/sign-in", {
        method: "POST",
        body: payload,
      })

      setSession(response.session)
      await workspaceStore.loadWorkspace(true)
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

  async function signUp(payload: { email: string, inviteToken?: string, name: string, password: string }) {
    pending.value = true
    clearError()

    try {
      const response = await $fetch<SignUpAuthResponse>("/api/auth/sign-up", {
        method: "POST",
        body: payload,
      })

      if (!response.session)
        return response

      setSession(response.session)
      await workspaceStore.loadWorkspace(true)
      workspaceStore.createDraftUserFromSignUp(response.session, payload.name)
      await workspaceStore.persistWorkspace(true)
      return response
    }
    catch (caughtError) {
      error.value = caughtError instanceof Error ? caughtError.message : "Unable to create account."
      throw caughtError
    }
    finally {
      pending.value = false
    }
  }

  async function signInWithProvider(provider: SupportedOAuthProvider) {
    pending.value = true
    clearError()

    try {
      const response = await $fetch<OAuthAuthResponse>("/api/auth/oauth", {
        method: "POST",
        body: { provider },
      })

      if (response.redirectUrl) {
        await navigateTo(response.redirectUrl, { external: true })
        return null
      }

      if (!response.session)
        throw new Error("OAuth sign-in did not return a session.")

      setSession(response.session)
      await workspaceStore.loadWorkspace(true)
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
    workspaceStore.resetSessionState()
  }

  async function completeOnboarding() {
    pending.value = true

    try {
      const response = await $fetch<SessionAuthResponse>("/api/auth/complete-onboarding", {
        method: "POST",
      })

      setSession(response.session)
      await workspaceStore.loadWorkspace(true)
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
