<!-- cliente/src/layouts/DefaultLayout.vue -->
<template>
  <div class="layout">
    <!-- Topbar (solo móvil) -->
    <header class="topbar" v-if="ui.isMobile">
      <button
        class="topbar-burger"
        @click="ui.toggleSidebarMobile()"
        :aria-label="ui.sidebarMobileOpen ? 'Cerrar menú' : 'Abrir menú'"
        :aria-expanded="ui.sidebarMobileOpen"
        aria-controls="app-sidebar"
      >
        ☰
      </button>

      <RouterLink to="/home" class="topbar-brand" title="Ir a inicio">
        <img :src="logoUrl" alt="Logo Odes" class="topbar-logo" />
        <span class="topbar-text">ODES</span>
      </RouterLink>

      <slot name="top-actions"></slot>
    </header>

    <!-- Overlay y Sidebar -->
    <AppOverlay />
    <AppSidebar />

    <!-- Contenido -->
    <main class="page">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { watch, onMounted, onBeforeUnmount } from 'vue';
import { useUiStore } from '@/stores/ui.store';
import AppOverlay from '@/components/layout/AppOverlay.vue';
import AppSidebar from '@/components/layout/AppSidebar.vue';

// Logo: usa el que tengas en /public
const logoUrl = '/odes-mark.png';

const ui = useUiStore();

// Detección de breakpoint y persistencia desktop
const BP = 1024;
function applyBreakpoint() {
  const isMob = window.matchMedia(`(max-width: ${BP}px)`).matches;
  ui.setIsMobile(isMob);
  if (!isMob) {
    ui.hydrate();           // restaura colapso de desktop
  }
}

// Bloquea el scroll del body cuando el drawer móvil está abierto
const stopWatch = watch(
  () => ui.sidebarMobileOpen,
  (open) => {
    document.body.style.overflow = open ? 'hidden' : '';
  },
  { immediate: true }
);

onMounted(() => {
  // Restaurar preferencia de colapso (desktop) y aplicar breakpoint inicial
  ui.hydrate();
  applyBreakpoint();
  window.addEventListener('resize', applyBreakpoint);
});

onBeforeUnmount(() => {
  stopWatch();
  window.removeEventListener('resize', applyBreakpoint);
  document.body.style.overflow = '';
});
</script>

<style scoped>
.layout {
  display: grid;
  grid-template-columns: auto 1fr;
}

/* Topbar móvil */
.topbar {
  position: sticky;
  top: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: #ffffffee;
  backdrop-filter: blur(6px);
  border-bottom: 1px solid #e5e7eb;
}
.topbar-burger {
  border: 0;
  background: #fff;
  border-radius: 10px;
  padding: 6px 10px;
  box-shadow: 0 1px 2px rgba(0,0,0,.06);
  cursor: pointer;
}
.topbar-brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: #111827;
}
.topbar-logo { width: 28px; height: 28px; border-radius: 8px; }
.topbar-text { font-weight: 800; letter-spacing: .02em; color: #4B5055; }

.page {
  min-height: 100dvh;
  padding: 16px;
  background: #fbfbfc;
}

/* En desktop, deja espacio a la sidebar (el ancho real lo define la sidebar) */
@media (min-width: 1025px) {
  .layout {
    grid-template-columns: var(--sidebar-width, 220px) 1fr;
  }
}
</style>
