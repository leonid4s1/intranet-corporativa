// cliente/src/stores/ui.store.ts
import { defineStore } from 'pinia'

const LS_KEY = 'ui.sidebarCollapsed'

export const useUiStore = defineStore('ui', {
  state: () => ({
    /** Estado de colapso en desktop (persistente) */
    sidebarCollapsed: false as boolean,
    /** Estado de apertura en móvil (no persistente) */
    sidebarOpenMobile: false as boolean,
  }),
  actions: {
    hydrate() {
      try {
        const raw = localStorage.getItem(LS_KEY)
        if (raw !== null) this.sidebarCollapsed = raw === '1'
      } catch {}
    },
    toggleSidebar() {
      this.sidebarCollapsed = !this.sidebarCollapsed
      try { localStorage.setItem(LS_KEY, this.sidebarCollapsed ? '1' : '0') } catch {}
    },
    setSidebar(v: boolean) {
      this.sidebarCollapsed = v
      try { localStorage.setItem(LS_KEY, v ? '1' : '0') } catch {}
    },

    /* ====== MÓVIL (drawer) ====== */
    openSidebarMobile() { this.sidebarOpenMobile = true },
    closeSidebarMobile() { this.sidebarOpenMobile = false },
    toggleSidebarMobile() { this.sidebarOpenMobile = !this.sidebarOpenMobile },
  }
})
