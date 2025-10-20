<!-- cliente/src/components/layout/AppSidebar.vue -->
<template>
  <aside
    id="app-sidebar"
    class="app-sidebar"
    :class="{
      'is-collapsed': !ui.isMobile && ui.sidebarCollapsed,
      'is-mobile': ui.isMobile,
      'is-open': ui.isMobile && ui.sidebarMobileOpen
    }"
    :style="{ '--sidebar-width': ui.isMobile ? '280px' : (ui.sidebarCollapsed ? '72px' : '220px') }"
    role="navigation"
    aria-label="Menú principal"
  >
    <div class="side-head">
      <!-- Botón con isotipo (abre/colapsa) -->
      <button
        class="brand-btn"
        @click="onBurgerClick"
        :aria-label="ui.isMobile ? (ui.sidebarMobileOpen ? 'Cerrar menú' : 'Abrir menú') : (ui.sidebarCollapsed ? 'Expandir menú' : 'Colapsar menú')"
        aria-controls="app-sidebar"
        :aria-expanded="ui.isMobile ? (ui.sidebarMobileOpen ? 'true' : 'false') : undefined"
      >
        <img :src="logoUrl" alt="Logo Odes" width="28" height="28" />
      </button>

      <!-- Marca (solo visible sin colapsar en desktop) -->
      <RouterLink
        to="/home"
        class="brand"
        title="Ir a inicio"
        :aria-hidden="(!ui.isMobile && ui.sidebarCollapsed) ? 'true' : 'false'"
      >
        <img class="brand-logo" :src="logoUrl" alt="" aria-hidden="true" />
        <span class="brand-text" v-if="!ui.isMobile && !ui.sidebarCollapsed">ODES</span>
      </RouterLink>
    </div>

    <nav class="side-nav">
      <RouterLink
        v-for="item in items"
        :key="item.to"
        :to="item.to"
        class="side-link"
        :class="{ active: route.path === item.to }"
        :title="(!ui.isMobile && ui.sidebarCollapsed) ? item.label : ''"
        @click="onNavClick"
        :aria-current="route.path === item.to ? 'page' : undefined"
      >
        <span class="ico" aria-hidden="true">{{ item.icon }}</span>
        <span class="lbl" v-if="ui.isMobile ? true : !ui.sidebarCollapsed">{{ item.label }}</span>
        <span class="badge" v-if="item.badge && (ui.isMobile || !ui.sidebarCollapsed)">{{ item.badge() }}</span>
      </RouterLink>
    </nav>
  </aside>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import { useUiStore } from '@/stores/ui.store';

const route = useRoute();
const ui = useUiStore();

/** Usa tu archivo real. Si tu logo está en /src/assets, puedes importarlo;
 * si ya lo tienes en /public, esta ruta es suficiente: */
const logoUrl = '/odes-mark.png';

function onBurgerClick() {
  if (ui.isMobile) ui.toggleSidebarMobile();
  else ui.toggleSidebar();
}
function onNavClick() {
  if (ui.isMobile) ui.closeSidebarMobile();
}

/** Mientras no montemos el DefaultLayout, aquí determinamos el breakpoint */
const BP = 1024;
function applyBreakpoint() {
  const isMob = window.matchMedia(`(max-width: ${BP}px)`).matches;
  ui.setIsMobile(isMob);
  if (!isMob) ui.closeSidebarMobile();
}

onMounted(() => {
  applyBreakpoint();
  window.addEventListener('resize', applyBreakpoint);
  window.addEventListener('keydown', onEscClose);
});
onBeforeUnmount(() => {
  window.removeEventListener('resize', applyBreakpoint);
  window.removeEventListener('keydown', onEscClose);
});

function onEscClose(e: KeyboardEvent) {
  if (e.key === 'Escape' && ui.isMobile && ui.sidebarMobileOpen) {
    ui.closeSidebarMobile();
  }
}

/** Menú (puedes ajustar rutas/labels) */
type Item = { to: string; label: string; icon: string; badge?: () => string };
const items = computed<Item[]>(() => [
  { to: '/home',          label: 'Inicio',            icon: '🏠' },
  { to: '/docs',          label: 'Documentación',     icon: '📄' },
  { to: '/formats',       label: 'Formatos',          icon: '🧾' },
  { to: '/vacations',     label: 'Vacaciones',        icon: '🏝️' },
  { to: '/tasks',         label: 'Tareas',            icon: '✅', badge: () => '' },
]);
</script>

<style scoped>
.app-sidebar{
  position: sticky; top: 0; left: 0;
  height: 100dvh;
  width: var(--sidebar-width, 220px);
  background: #f7f7f8; /* fondo claro */
  color: #111827;
  border-right: 1px solid #e5e7eb;
  display: flex; flex-direction: column;
  transition: width .18s ease, transform .18s ease;
  z-index: 1100;
}

/* Móvil como drawer */
.app-sidebar.is-mobile{
  position: fixed; inset: 0 auto 0 0;
  transform: translateX(-100%);
  box-shadow: 0 10px 30px rgba(0,0,0,.25);
  background: #ffffff;
}
.app-sidebar.is-mobile.is-open{
  transform: translateX(0);
}

/* Cabecera */
.side-head{
  display: flex; align-items: center; gap: .5rem;
  padding: .9rem .75rem;
  border-bottom: 1px solid #e5e7eb;
}
.brand-btn{
  width: 40px; height: 40px; border-radius: 10px;
  display: inline-flex; align-items:center; justify-content:center;
  border: 1px solid #e5e7eb; background: #fff; cursor: pointer;
  box-shadow: 0 1px 2px rgba(0,0,0,.06); padding: 0;
}
.brand-btn img{ width: 28px; height: 28px; display:block; }
@media (hover:hover){ .brand-btn:hover{ background: #f3f4f6; } }

.brand{
  display:inline-flex; align-items:center; gap:.5rem;
  text-decoration: none; color:#111827;
}
.brand-logo{ width: 20px; height: 20px; border-radius: 4px; }
.brand-text{ font-weight: 800; letter-spacing: .2px; }

/* Colapsado (solo desktop) */
.app-sidebar.is-collapsed .brand{ display: none; }
.app-sidebar.is-collapsed .side-head{ justify-content: center; padding: .7rem .5rem; }

/* Navegación */
.side-nav{ padding: .6rem; display: grid; gap: .35rem; }
.side-link{
  display: grid; grid-template-columns: 26px 1fr auto; align-items: center;
  gap: .6rem; border-radius: 10px;
  padding: .55rem .6rem; color: #4B5055; text-decoration: none;
  border: 1px solid transparent; transition: background .15s ease, color .15s ease;
}
.side-link:hover{ background: #eef0f3; color: #2b2f33; }
.ico{ font-size: 18px; line-height: 1; text-align: center; }
.side-link.active{
  background: #ffffff; color: #1f2937;
  box-shadow: 0 2px 8px rgba(0,0,0,.06);
}
.side-link .lbl{ white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.badge{
  background:#e74c3c; color:#fff; border-radius:999px; font-size:.7rem;
  padding:.1rem .5rem; font-weight:700; justify-self: end;
}

/* Colapsado en desktop: solo iconos */
.app-sidebar.is-collapsed:not(.is-mobile) .side-link{
  grid-template-columns: 26px; justify-items: center;
}
.app-sidebar.is-collapsed:not(.is-mobile) .side-link .lbl,
.app-sidebar.is-collapsed:not(.is-mobile) .side-link .badge { display: none; }

/* Reduce motion */
@media (prefers-reduced-motion: reduce){
  .app-sidebar, .side-link{ transition: none !important; }
}
</style>
