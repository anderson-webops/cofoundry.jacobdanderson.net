import { acceptHMRUpdate, defineStore } from "pinia"

export interface ToastItem {
  id: string
  title: string
  message: string
  tone: "info" | "success" | "warning" | "danger"
}

export const useToastStore = defineStore("toast", () => {
  const items = ref<ToastItem[]>([])

  function push(toast: Omit<ToastItem, "id">) {
    const id = crypto.randomUUID()
    items.value.unshift({ id, ...toast })

    window.setTimeout(() => {
      dismiss(id)
    }, 4200)
  }

  function dismiss(id: string) {
    items.value = items.value.filter(item => item.id !== id)
  }

  return {
    items,
    push,
    dismiss,
  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(useToastStore, import.meta.hot))
