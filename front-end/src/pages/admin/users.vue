<script setup lang="ts">
definePageMeta({
  layout: "admin",
  middleware: ["admin"],
})

usePageSeo("Admin users")

const toastStore = useToastStore()
const authStore = useAuthStore()
const workspaceStore = useWorkspaceStore()

function toggleSuspension(userId: string, suspended: boolean) {
  if (!authStore.currentUser)
    return

  if (suspended)
    workspaceStore.reinstateUser(userId, authStore.currentUser.id, "Reinstated from admin users page.")
  else
    workspaceStore.suspendUser(userId, authStore.currentUser.id, "Suspended from admin users page.")

  toastStore.push({
    title: suspended ? "User reinstated" : "User suspended",
    message: "Admin action recorded in the moderation log.",
    tone: "success",
  })
}
</script>

<template>
  <div class="gap-6 grid">
    <PageIntro
      eyebrow="Admin"
      title="Users"
      description="Review user state, role, onboarding completion, and moderation status."
    />

    <div class="panel overflow-hidden">
      <table class="text-sm text-left w-full">
        <thead class="bg-[var(--panel-inset)]">
          <tr>
            <th class="font-semibold px-4 py-3">
              User
            </th>
            <th class="font-semibold px-4 py-3">
              Role
            </th>
            <th class="font-semibold px-4 py-3">
              Onboarding
            </th>
            <th class="font-semibold px-4 py-3">
              Status
            </th>
            <th class="font-semibold px-4 py-3">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in workspaceStore.data.users" :key="user.id" class="border-t border-[var(--line)]">
            <td class="px-4 py-4">
              <div class="font-semibold">
                {{ workspaceStore.data.profiles.find(profile => profile.userId === user.id)?.displayName || user.email }}
              </div>
              <div class="muted text-xs">
                {{ user.email }}
              </div>
            </td>
            <td class="px-4 py-4">
              {{ user.role }}
            </td>
            <td class="px-4 py-4">
              {{ user.onboardingCompleted ? "Complete" : "Incomplete" }}
            </td>
            <td class="px-4 py-4">
              <BaseBadge :tone="user.suspendedAt ? 'danger' : 'success'">
                {{ user.suspendedAt ? "Suspended" : "Active" }}
              </BaseBadge>
            </td>
            <td class="px-4 py-4">
              <BaseButton variant="secondary" @click="toggleSuspension(user.id, Boolean(user.suspendedAt))">
                {{ user.suspendedAt ? "Reinstate" : "Suspend" }}
              </BaseButton>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
