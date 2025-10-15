<!-- cliente/src/components/layout/AppSidebar.vue -->
<template>
  <aside
    class="app-sidebar"
    :class="{ 'is-collapsed': collapsed }"
    :style="{ '--sidebar-width': collapsed ? '72px' : '220px' }"
  >
    <div class="side-head">
      <button
        class="burger"
        @click="onBurgerClick"
        :aria-label="isMobile ? 'Abrir/cerrar menú' : (collapsed ? 'Expandir menú' : 'Colapsar menú')"
      >
        ☰
      </button>

      <!-- La marca también abre Home -->
      <RouterLink to="/home" class="brand" :title="brandTitle">ODES</RouterLink>
    </div>

    <nav class="side-nav">
      <RouterLink
        v-for="item in items"
        :key="item.to"
        :to="item.to"
        class="side-link"
        :class="{ active: route.path === item.to }"
        :title="collapsed ? item.label : ''"
        @click="onNavClick"
      >
        <span class="ico" aria-hidden="true">{{ item.emoji }}</span>
        <span class="lbl" v-if="!collapsed">{{ item.label }}</span>
        <span class="badge" v-if="item.badge && !collapsed">{{ item.badge() }}</span>
      </RouterLink>
    </nav>
  </aside>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useUiStore } from '@/stores/ui.store'
import { storeToRefs } from 'pinia'

const route = useRoute()
const ui = useUiStore()
const { sidebarCollapsed: collapsed } = storeToRefs(ui)

const MOBILE_BP = 900
const isMobile = ref(false)
function updateIsMobile() {
  isMobile.value = window.matchMedia(`(max-width: ${MOBILE_BP}px)`).matches
  if (!isMobile.value) ui.closeSidebarMobile?.()
}
function onBurgerClick() {
  if (isMobile.value) ui.toggleSidebarMobile()
  else ui.toggleSidebar()
}
function onNavClick() {
  if (isMobile.value) ui.closeSidebarMobile()
}

const brandTitle = 'ODES'

/** Menú con emojis */
const items = computed(() => [
  { to: '/home',          label: 'Inicio',             emoji: '🏠' },
  { to: '/dashboard',     label: 'Dashboard',          emoji: '📊' },
  { to: '/roles',         label: 'Roles y Funciones',  emoji: '👥' },
  { to: '/documentacion', label: 'Documentación',      emoji: '📄' },
  { to: '/formatos',      label: 'Formatos',           emoji: '🗂️' },
  { to: '/vacaciones',    label: 'Vacaciones',         emoji: '📅' },
  { to: '/tareas',        label: 'Tareas',             emoji: '✅', badge: () => '' },
])

onMounted(() => {
  updateIsMobile()
  window.addEventListener('resize', updateIsMobile)
})
onBeforeUnmount(() => window.removeEventListener('resize', updateIsMobile))
</script>

<style scoped>
.app-sidebar{
  position: fixed; inset: 0 auto 0 0;
  width: var(--sidebar-width, 220px);
  background: var(--primary-color, #4b5055);
  color: #fff;
  border-right: 1px solid rgba(255,255,255,.12);
  display: flex; flex-direction: column;
  transition: width .18s ease;
  z-index: 40;
}

/* header */
.side-head{
  display: flex; align-items: center; gap: .5rem;
  padding: .9rem .75rem;
  border-bottom: 1px solid rgba(255,255,255,.12);
}
.burger{
  width: 34px; height: 34px; border-radius: 8px;
  display: inline-flex; align-items:center; justify-content:center;
  border: 1px solid rgba(255,255,255,.2);
  background: rgba(255,255,255,.06);
  color: #fff; cursor: pointer;
}
.burger:hover{ background: rgba(255,255,255,.12); }

.brand{
  font-weight: 800; letter-spacing: .8px;
  color: #fff; text-decoration: none;
}
.brand:hover{ text-decoration: underline; }

/* nav */
.side-nav{ padding: .6rem; display: grid; gap: .35rem; }
.side-link{
  display: grid; grid-template-columns: 26px 1fr auto; align-items: center;
  gap: .6rem; border-radius: 10px;
  padding: .55rem .6rem; color: rgba(255,255,255,.92); text-decoration: none;
  border: 1px solid transparent; transition: background .15s ease, color .15s ease;
}
.side-link:hover{ background: rgba(255,255,255,.10); color: #fff; }

/* Emoji icono */
.ico{
  font-size: 18px; line-height: 1; text-align: center;
  filter: saturate(.95) opacity(.95);
}

/* Estado activo tipo “pill” claro (como la referencia) */
.side-link.active{
  background: #ffffff;
  color: #1f2937;                /* gris-800 para texto */
  box-shadow: 0 2px 8px rgba(0,0,0,.06);
}
.side-link.active .ico{ filter: none; }

.side-link .lbl{ white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.badge{
  background:#e74c3c; color:#fff; border-radius:999px; font-size:.7rem;
  padding:.1rem .5rem; font-weight:700; justify-self: end;
}

/* colapsado (desktop) */
.app-sidebar.is-collapsed .side-link{
  grid-template-columns: 26px; justify-items: center;
}
.app-sidebar.is-collapsed .side-link .lbl,
.app-sidebar.is-collapsed .side-link .badge { display: none; }

/* ===== Drawer móvil ===== */
@media (max-width: 900px){
  .app-sidebar{
    transform: translateX(-100%);
    transition: transform .18s ease;
    box-shadow: 0 10px 30px rgba(0,0,0,.25);
  }
  :global(.is-mobile-open) .app-sidebar{
    transform: translateX(0);
  }
}
</style>
