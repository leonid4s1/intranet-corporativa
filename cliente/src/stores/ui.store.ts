// cliente/src/stores/ui.store.ts
import { defineStore } from 'pinia'

const LS_KEY = 'ui.sidebarCollapsed'

export const useUiStore = defineStore('ui', {
  state: () => ({
    /** Estado de colapso en desktop (persistente) */
    sidebarCollapsed: false as boolean,
    /** Estado de apertura en móvil (no persistente) */
    sidebarMobileOpen: false as boolean,
  }),

  getters: {
    // (Opcional) compatibilidad por si algo viejo aún lee sidebarOpenMobile
    // Elimínalo cuando ya no lo uses en ningún componente.
    sidebarOpenMobile(state): boolean {
      return state.sidebarMobileOpen
    },
  },

  actions: {
    /** Cargar preferencia de colapso desde localStorage */
    hydrate() {
      try {
        const raw = localStorage.getItem(LS_KEY)
        if (raw !== null) this.sidebarCollapsed = raw === '1'
      } catch {}
    },

    /** Alternar colapso en desktop (y persistirlo) */
    toggleSidebar() {
      this.sidebarCollapsed = !this.sidebarCollapsed
      try { localStorage.setItem(LS_KEY, this.sidebarCollapsed ? '1' : '0') } catch {}
    },

    /** Fijar colapso en desktop (y persistirlo) */
    setSidebar(v: boolean) {
      this.sidebarCollapsed = v
      try { localStorage.setItem(LS_KEY, v ? '1' : '0') } catch {}
    },

    /* ====== MÓVIL (drawer) ====== */
    openSidebarMobile() { this.sidebarMobileOpen = true },
    closeSidebarMobile() { this.sidebarMobileOpen = false },
    toggleSidebarMobile() { this.sidebarMobileOpen = !this.sidebarMobileOpen },
  }
})
