<!-- cliente/src/layouts/DefaultLayout.vue -->
<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { storeToRefs } from 'pinia'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import { useUiStore } from '@/stores/ui.store'

const ui = useUiStore()
const { sidebarCollapsed: collapsed } = storeToRefs(ui)

const MOBILE_BP = 900
const isMobile = ref(false)

function updateIsMobile() {
  isMobile.value = window.matchMedia(`(max-width: ${MOBILE_BP}px)`).matches
  // si pasamos a desktop, cierra el drawer móvil
  if (!isMobile.value) ui.closeSidebarMobile?.()
}

function onMenuClick() {
  if (isMobile.value) ui.toggleSidebarMobile()
  else ui.toggleSidebar()
}

onMounted(() => {
  ui.hydrate?.()
  updateIsMobile()
  window.addEventListener('resize', updateIsMobile)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateIsMobile)
})
</script>

<template>
  <!-- El layout define --sidebar-width y gestiona estado móvil -->
  <div class="app-shell"
       :class="{ 'is-mobile-open': ui.sidebarOpenMobile }"
       :style="{ '--sidebar-width': collapsed ? '72px' : '220px' }">

    <!-- Sidebar (colapsable en desktop, drawer en móvil) -->
    <AppSidebar />

    <!-- Topbar móvil (incluye botón ☰ compartido) -->
    <header class="topbar-mobile">
      <button class="menu-btn"
              @click="onMenuClick"
              :aria-label="isMobile ? 'Abrir/cerrar menú' : (collapsed ? 'Expandir menú' : 'Colapsar menú')">
        ☰
      </button>
      <span class="brand">ODES</span>
    </header>

    <!-- Overlay para cerrar el drawer tocando fuera (solo móvil) -->
    <div class="backdrop" @click="ui.closeSidebarMobile()" />

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

/* El contenido se “empuja” por el sidebar en desktop */
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
}
.topbar-mobile .brand{
  margin-left: .75rem; font-weight: 800; letter-spacing: .6px;
}

/* ====== Reglas móvil (≤900px) ====== */
@media (max-width: 900px){
  .app-main{
    margin-left: 0;    /* el contenido usa 100% del ancho */
    padding: 1rem;
  }

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
    opacity: 0; pointer-events: none;
    transition: opacity .15s ease;
    z-index: 39;
  }
  .is-mobile-open .backdrop{
    opacity: 1; pointer-events: auto;
  }
}
</style>
