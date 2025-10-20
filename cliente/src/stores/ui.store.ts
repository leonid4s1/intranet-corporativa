// cliente/src/stores/ui.store.ts
import { defineStore } from 'pinia';

const LS_KEY = 'ui.sidebarCollapsed';

type UiState = {
  /** ¿Estamos en breakpoint móvil? Lo establece el layout. */
  isMobile: boolean;
  /** Estado de colapso en desktop (persistente) */
  sidebarCollapsed: boolean;
  /** Estado de apertura del drawer en móvil (no persistente) */
  sidebarMobileOpen: boolean;
};

export const useUiStore = defineStore('ui', {
  state: (): UiState => ({
    isMobile: false,
    sidebarCollapsed: false,
    sidebarMobileOpen: false,
  }),

  getters: {
    // Compatibilidad con código antiguo (elimínalo cuando ya no se use)
    sidebarOpenMobile(state): boolean {
      return state.sidebarMobileOpen;
    },
  },

  actions: {
    /** Cargar preferencia de colapso desde localStorage */
    hydrate() {
      try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw !== null) this.sidebarCollapsed = raw === '1';
      } catch {
        /* no-op */
      }
    },

    /** Alternar colapso en desktop (y persistirlo) */
    toggleSidebar() {
      if (this.isMobile) return; // en móvil no aplica colapsar
      this.sidebarCollapsed = !this.sidebarCollapsed;
      try {
        localStorage.setItem(LS_KEY, this.sidebarCollapsed ? '1' : '0');
      } catch {
        /* no-op */
      }
    },

    /** Fijar colapso en desktop (y persistirlo) */
    setSidebar(v: boolean) {
      if (this.isMobile) return;
      this.sidebarCollapsed = v;
      try {
        localStorage.setItem(LS_KEY, v ? '1' : '0');
      } catch {
        /* no-op */
      }
    },

    /** Establece el modo móvil según el breakpoint */
    setIsMobile(v: boolean) {
      this.isMobile = v;
      // Al entrar en móvil, el estado de colapso de desktop deja de tener efecto
      if (v) this.sidebarCollapsed = false;
      // Al salir de móvil, cierra el drawer si estuviera abierto
      if (!v) this.sidebarMobileOpen = false;
    },

    /* ====== MÓVIL (drawer) ====== */
    openSidebarMobile() {
      if (!this.isMobile) return;
      this.sidebarMobileOpen = true;
    },
    closeSidebarMobile() {
      if (!this.isMobile) return;
      this.sidebarMobileOpen = false;
    },
    toggleSidebarMobile() {
      if (!this.isMobile) return;
      this.sidebarMobileOpen = !this.sidebarMobileOpen;
    },
  },
});
