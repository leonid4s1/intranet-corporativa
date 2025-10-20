<!-- cliente/src/layouts/DefaultLayout.vue -->
<script setup lang="ts">
import { onMounted, onBeforeUnmount, watch, ref } from 'vue';
import { storeToRefs } from 'pinia';
import AppSidebar from '@/components/layout/AppSidebar.vue';
import { useUiStore } from '@/stores/ui.store';
import logoPng from '@/assets/odes-mark.png'; // ← LOGO CORPORATIVO

const ui = useUiStore();
const { sidebarCollapsed: collapsed, sidebarMobileOpen } = storeToRefs(ui);

const MOBILE_BP = 900;
const isMobile = ref(false);

function updateIsMobile() {
  isMobile.value = window.matchMedia(`(max-width: ${MOBILE_BP}px)`).matches;
  // si pasamos a desktop, cierra el drawer móvil
  if (!isMobile.value) ui.closeSidebarMobile?.();
}

function onMenuClick() {
  if (isMobile.value) ui.toggleSidebarMobile();
  else ui.toggleSidebar();
}

// Sincroniza la clase global para estilos del drawer
function applyMobileOpenClass(open: boolean) {
  document.documentElement.classList.toggle('is-mobile-open', open);
}

onMounted(() => {
  ui.hydrate?.();
  updateIsMobile();
  applyMobileOpenClass(!!sidebarMobileOpen.value);
  window.addEventListener('resize', updateIsMobile);
});

watch(sidebarMobileOpen, (v) => applyMobileOpenClass(!!v));

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateIsMobile);
  applyMobileOpenClass(false);
});
</script>

<template>
  <div
    class="app-shell"
    :class="{ 'is-mobile-open': sidebarMobileOpen }"
    :style="{ '--sidebar-width': collapsed ? '72px' : '220px' }"
  >
    <!-- Sidebar (colapsable en desktop, drawer en móvil) -->
    <AppSidebar />

    <!-- Topbar móvil -->
    <header class="topbar-mobile" v-if="isMobile">
      <button
        class="menu-btn"
        @click="onMenuClick"
        :aria-label="isMobile ? (sidebarMobileOpen ? 'Cerrar menú' : 'Abrir menú') : (collapsed ? 'Expandir menú' : 'Colapsar menú')"
        :aria-expanded="isMobile ? sidebarMobileOpen : undefined"
        aria-controls="app-sidebar"
      >
        <img class="menu-logo" :src="logoPng" alt="Menú ODES" />
      </button>
      <span class="brand">ODES</span>
    </header>

    <!-- Overlay (solo cuando está abierto y en móvil) -->
    <div
      v-if="isMobile && sidebarMobileOpen"
      class="backdrop"
      @click="ui.closeSidebarMobile()"
      aria-hidden="true"
    />

    <!-- Contenido -->
    <main class="app-main">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.app-shell{
  min-height: 100vh;
  background: var(--bg-light, #f0f0f0);
}

/* El contenido se empuja por sidebar en desktop */
.app-main{
  min-height: 100vh;
  margin-left: var(--sidebar-width);
  transition: margin-left .18s ease;
  padding: 1.5rem;
}

/* Topbar visible solo en móvil */
.topbar-mobile{ display: none; }
.menu-btn{
  width: 38px; height: 38px; border-radius: 10px;
  display: inline-flex; align-items:center; justify-content:center;
  border: 1px solid var(--brand-gray-300, #cdcdcd);
  background: #fff; cursor:pointer;
  padding: 4px;
}
.menu-btn:focus-visible{
  outline: 2px solid var(--brand-ring, rgba(0,0,0,.2));
  outline-offset: 2px;
}
.menu-logo{ width: 22px; height: 22px; object-fit: contain; display: block; }
.topbar-mobile .brand{ margin-left: .75rem; font-weight: 800; letter-spacing: .6px; }

/* ====== Móvil (≤900px) ====== */
@media (max-width: 900px){
  .app-main{ margin-left: 0; padding: 1rem; }

  .topbar-mobile{
    position: sticky; top: 0;
    display: flex; align-items: center; gap: .75rem;
    padding: .6rem .8rem;
    background: #fff;
    border-bottom: 1px solid var(--brand-gray-300, #e5e7eb);
    z-index: 30;
  }

  .backdrop{
    position: fixed; inset: 0;
    background: rgba(0,0,0,.35);
    z-index: 1390; /* debajo del sidebar(1400), sobre el contenido */
  }
}
</style>
