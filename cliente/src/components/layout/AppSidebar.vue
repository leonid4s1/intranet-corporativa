<!-- cliente/src/components/layout/AppSidebar.vue -->
<template>
  <aside
    id="app-sidebar"
    class="app-sidebar"
    :class="{ 'is-collapsed': collapsed }"
    :style="{ '--sidebar-width': collapsed ? '72px' : '220px' }"
    role="navigation"
    aria-label="Menú principal"
  >
    <div class="side-head">
      <!-- Botón con isotipo (abre/colapsa) -->
      <button
        class="brand-btn"
        @click="onBurgerClick"
        :aria-label="isMobile ? (isMobileOpen ? 'Cerrar menú' : 'Abrir menú') : (collapsed ? 'Expandir menú' : 'Colapsar menú')"
        aria-controls="app-sidebar"
        :aria-expanded="isMobile ? isMobileOpen : undefined"
      >
        <img :src="logoUrl" alt="Logo Odes" width="28" height="28" />
      </button>

      <!-- Marca (solo visible sin colapsar) -->
      <RouterLink
        to="/home"
        class="brand"
        :title="brandTitle"
        :aria-hidden="collapsed ? 'true' : 'false'"
      >
        <img class="brand-logo" :src="logoUrl" alt="" aria-hidden="true" />
        <span class="brand-text">ODES</span>
      </RouterLink>
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
        :aria-current="route.path === item.to ? 'page' : undefined"
      >
        <span class="ico" aria-hidden="true">{{ item.emoji }}</span>
        <span class="lbl" v-if="!collapsed">{{ item.label }}</span>
        <span class="badge" v-if="item.badge && !collapsed">{{ item.badge() }}</span>
      </RouterLink>
    </nav>
  </aside>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, onBeforeMount, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useUiStore } from '@/stores/ui.store';
import { storeToRefs } from 'pinia';
import logoPng from '@/assets/odes-mark.png'; // ← usa el PNG corporativo

const route = useRoute();
const ui = useUiStore();
const { sidebarCollapsed: collapsed } = storeToRefs(ui);

const MOBILE_BP = 900;
const isMobile = ref(false);
const isMobileOpen = computed(() => ui.sidebarMobileOpen);

const logoUrl = computed(() => logoPng);

function updateIsMobile() {
  isMobile.value = window.matchMedia(`(max-width: ${MOBILE_BP}px)`).matches;
  if (!isMobile.value) ui.closeSidebarMobile?.();
}
function onBurgerClick() {
  if (isMobile.value) ui.toggleSidebarMobile();
  else ui.toggleSidebar();
}
function onNavClick() {
  if (isMobile.value) ui.closeSidebarMobile();
}

// Cerrar con ESC cuando el drawer móvil esté abierto
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isMobile.value && ui.sidebarMobileOpen) {
    ui.closeSidebarMobile();
  }
}

onBeforeMount(() => { updateIsMobile(); });
onMounted(() => {
  window.addEventListener('resize', updateIsMobile);
  window.addEventListener('keydown', onKeydown);
});
onBeforeUnmount(() => {
  window.removeEventListener('resize', updateIsMobile);
  window.removeEventListener('keydown', onKeydown);
});

const brandTitle = 'Ir a inicio';

const items = computed(() => [
  { to: '/home',          label: 'Inicio',             emoji: '🏠' },
  { to: '/dashboard',     label: 'Dashboard',          emoji: '📊' },
  { to: '/roles',         label: 'Roles y Funciones',  emoji: '👥' },
  { to: '/documentacion', label: 'Documentación',      emoji: '📄' },
  { to: '/formatos',      label: 'Formatos',           emoji: '🗂️' },
  { to: '/vacaciones',    label: 'Vacaciones',         emoji: '📅' },
  { to: '/tareas',        label: 'Tareas',             emoji: '✅', badge: () => '' },
]);
</script>

<style scoped>
.app-sidebar{
  position: fixed; inset: 0 auto 0 0;
  width: var(--sidebar-width, 220px);
  background: var(--brand-ink, #4b5055);
  color: #fff;
  border-right: 1px solid rgba(255,255,255,.12);
  display: flex; flex-direction: column;
  transition: width .18s ease, transform .18s ease;
  z-index: 1100;
}

/* header */
.side-head{
  display: flex; align-items: center; gap: .5rem;
  padding: .9rem .75rem;
  border-bottom: 1px solid rgba(255,255,255,.12);
}

/* Botón con isotipo */
.brand-btn{
  width: 40px; height: 40px; border-radius: 10px;
  display: inline-flex; align-items:center; justify-content:center;
  border: 1px solid rgba(255,255,255,.2);
  background: rgba(255,255,255,.06);
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(0,0,0,.06);
  padding: 0;
}
.brand-btn img{ width: 28px; height: 28px; display:block; }
@media (hover:hover){ .brand-btn:hover{ background: rgba(255,255,255,.12); transform: translateY(-1px); } }

/* Marca (logo + texto) */
.brand{
  display:inline-flex; align-items:center; gap:.5rem;
  text-decoration: none; color:#fff;
}
.brand-logo{
  width: 20px; height: 20px; opacity:.95; border-radius: 4px;
}
.brand-text{
  font-family: var(--font-brand);
  font-weight: 800; letter-spacing: .2px;
}

/* Focus accesible */
.brand-btn:focus-visible,
.side-link:focus-visible,
.brand:focus-visible{
  outline: 2px solid rgba(255,255,255,.7);
  outline-offset: 2px;
}

/* Colapsado */
.app-sidebar.is-collapsed .brand{ display: none; }
.app-sidebar.is-collapsed .side-head{
  justify-content: center;
  padding: .7rem .5rem;
}

/* nav */
.side-nav{ padding: .6rem; display: grid; gap: .35rem; }
.side-link{
  display: grid; grid-template-columns: 26px 1fr auto; align-items: center;
  gap: .6rem; border-radius: 10px;
  padding: .55rem .6rem; color: rgba(255,255,255,.92); text-decoration: none;
  border: 1px solid transparent; transition: background .15s ease, color .15s ease;
}
.side-link:hover{ background: rgba(255,255,255,.10); color: #fff; }

/* Emoji */
.ico{ font-size: 18px; line-height: 1; text-align: center; }

/* Activo */
.side-link.active{
  background: #ffffff;
  color: #1f2937;
  box-shadow: 0 2px 8px rgba(0,0,0,.06);
}

.side-link .lbl{ white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.badge{
  background:#e74c3c; color:#fff; border-radius:999px; font-size:.7rem;
  padding:.1rem .5rem; font-weight:700; justify-self: end;
}

/* Colapsado (desktop) */
.app-sidebar.is-collapsed .side-link{
  grid-template-columns: 26px; justify-items: center;
}
.app-sidebar.is-collapsed .side-link .lbl,
.app-sidebar.is-collapsed .side-link .badge { display: none; }

/* Drawer móvil */
@media (max-width: 900px){
  .app-sidebar{
    transform: translateX(-100%);
    box-shadow: 0 10px 30px rgba(0,0,0,.25);
  }
  :global(.is-mobile-open) .app-sidebar{
    transform: translateX(0);
  }
}

/* Reduce motion */
@media (prefers-reduced-motion: reduce){
  .app-sidebar, .side-link{ transition: none !important; }
}
</style>
