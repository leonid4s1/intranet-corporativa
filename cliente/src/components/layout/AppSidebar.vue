<!-- cliente/src/components/layout/AppSidebar.vue -->
<template>
  <aside
    id="app-sidebar"
    class="app-sidebar"
    :class="{
      'is-collapsed': collapsed,
      'is-mobile': isMobile,
      'is-open': isMobile && isMobileOpen
    }"
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
        <img
          class="brand-lockup"
          :src="brandLockupUrl"
          alt="Odes Construction"
          decoding="async"
          loading="eager"
        />
      </RouterLink>
    </div>

    <!-- Menú: solo renderiza RouterLink si el item está enabled; si no, DIV deshabilitado -->
    <nav class="side-nav">
      <template v-for="item in items" :key="item.to">
        <!-- Activo (clicable) -->
        <RouterLink
          v-if="item.enabled"
          :to="item.to"
          class="side-link"
          :class="{ active: route.path.startsWith(item.to) }"
          :aria-current="route.path.startsWith(item.to) ? 'page' : undefined"
          :title="collapsed ? item.label : ''"
          @click="onNavClick"
        >
          <span class="ico" aria-hidden="true">{{ item.emoji }}</span>
          <span class="lbl" v-if="!collapsed">{{ item.label }}</span>
          <span class="badge" v-if="item.badge && !collapsed">{{ item.badge() }}</span>
        </RouterLink>

        <!-- Deshabilitado (visual y sin interacción) -->
        <div
          v-else
          class="side-link is-disabled"
          :title="item.label"
          aria-disabled="true"
          tabindex="-1"
        >
          <span class="ico" aria-hidden="true">{{ item.emoji }}</span>
          <span class="lbl" v-if="!collapsed">{{ item.label }}</span>
          <span class="badge" v-if="item.badge && !collapsed">{{ item.badge() }}</span>
        </div>
      </template>
    </nav>
  </aside>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, onBeforeMount, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useUiStore } from '@/stores/ui.store';
import { storeToRefs } from 'pinia';

import logoPng from '@/assets/odes-mark.png';                 // ← PNG para el botón
import brandLockup from '@/assets/brand/odes-constrction.png'; // ← Lockup grande del sidebar

const route = useRoute();
const ui = useUiStore();
const { sidebarCollapsed: collapsed } = storeToRefs(ui);

const MOBILE_BP = 900;
const isMobile = ref(false);
const isMobileOpen = computed(() => ui.sidebarMobileOpen);

const logoUrl = computed(() => logoPng);
const brandLockupUrl = computed(() => brandLockup);

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

/**
 * Solo habilitados: /home, /vacaciones, /account/password
 */
const items = computed(() => {
  const enabledSet = new Set([
    '/home',
    '/vacaciones',
    '/account/password',
    '/documentacion',
    '/roles-funciones',
  ])

  const base = [
    { to: '/home',              label: 'Inicio',             emoji: '🏠' },
    { to: '/dashboard',         label: 'Dashboard',          emoji: '📊' },
    { to: '/roles-funciones',   label: 'Roles y Funciones',  emoji: '👥' },
    { to: '/documentacion',     label: 'Documentación',      emoji: '📄' },
    { to: '/formatos',          label: 'Formatos',           emoji: '🗂️' },
    { to: '/vacaciones',        label: 'Vacaciones',         emoji: '📅' },
    { to: '/tareas',            label: 'Tareas',             emoji: '✅', badge: () => '' },
    { to: '/account/password',  label: 'Cambiar contraseña', emoji: '🔒' },
  ];

  return base.map(it => ({ ...it, enabled: enabledSet.has(it.to) }));
});
</script>

<style scoped>
.app-sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  width: var(--sidebar-width, 220px);
  background: var(--brand-ink, #4b5055);
  color: #fff;
  border-right: 1px solid rgba(255, 255, 255, 0.12);
  display: flex;
  flex-direction: column;
  transition: width 0.18s ease, transform 0.18s ease;
  z-index: 1400; /* ↑ sobre topbar/overlay */
}

/* ===== CABECERA ===== */
.side-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.9rem 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}

/* Botón con isotipo */
.brand-btn {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.06);
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06);
  padding: 0;
}
.brand-btn img {
  width: 28px;
  height: 28px;
  display: block;
}
@media (hover:hover) {
  .brand-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    transform: translateY(-1px);
  }
}

/* Marca (lockup) */
.brand {
  display: inline-flex;
  align-items: center;
  padding-left: 2px;
  text-decoration: none;
  color: #fff;
}
.brand-lockup {
  display: block;
  height: 28px;     /* ajusta 24–36px a gusto */
  width: auto;
  object-fit: contain;
  opacity: 0.98;
}

/* Focus accesible */
.brand-btn:focus-visible,
.side-link:focus-visible,
.brand:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.7);
  outline-offset: 2px;
}

/* Colapsado */
.app-sidebar.is-collapsed .brand {
  display: none;
}
.app-sidebar.is-collapsed .side-head {
  justify-content: center;
  padding: 0.7rem 0.5rem;
}

/* ===== MENÚ ===== */
.side-nav {
  padding: 0.6rem;
  display: grid;
  gap: 0.35rem;
}

/* Enlaces del menú */
.side-link {
  display: grid;
  grid-template-columns: 26px 1fr auto;
  align-items: center;
  gap: 0.6rem;
  border-radius: 10px;
  padding: 0.55rem 0.6rem;
  color: rgba(255, 255, 255, 0.92);
  text-decoration: none;
  border: 1px solid transparent;
  transition: background 0.15s ease, color 0.15s ease;
}

/* Hover / focus */
.side-link:hover,
.side-link:focus {
  color: #fff;
  background: rgba(255, 255, 255, 0.10);
}

/* Icono (emoji) */
.ico {
  font-size: 18px;
  line-height: 1;
  text-align: center;
  color: inherit;
}

/* Etiqueta */
.side-link .lbl {
  color: inherit;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Activo: fondo sutil blanco translúcido */
.side-link.active,
.router-link-active.side-link {
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
  border-color: rgba(255, 255, 255, 0.22);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

/* Badges */
.badge {
  background: #e74c3c;
  color: #fff;
  border-radius: 999px;
  font-size: 0.7rem;
  padding: 0.1rem 0.5rem;
  font-weight: 700;
  justify-self: end;
}

/* Colapsado (desktop) */
.app-sidebar.is-collapsed .side-link {
  grid-template-columns: 26px;
  justify-items: center;
}
.app-sidebar.is-collapsed .side-link .lbl,
.app-sidebar.is-collapsed .side-link .badge {
  display: none;
}

/* Drawer móvil */
@media (max-width: 900px) {
  .app-sidebar {
    transform: translateX(-100%);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
  }
  .app-sidebar.is-open {
    transform: translateX(0);
  }
}

/* Reduce motion */
@media (prefers-reduced-motion: reduce) {
  .app-sidebar,
  .side-link {
    transition: none !important;
  }
}

/* ===== Forzar colores del menú ===== */
.app-sidebar :is(.side-link, .side-link .lbl, .side-link .ico){
  color: rgba(255,255,255,.92) !important;
}

.app-sidebar .side-link:hover,
.app-sidebar .side-link:focus{
  color: #fff !important;
  background: rgba(255,255,255,.10) !important;
}

/* Ítem activo SIEMPRE con texto blanco y fondo sutil, no pastilla blanca */
.app-sidebar .side-link.active,
.app-sidebar .router-link-active.side-link{
  background: rgba(255,255,255,.14) !important;
  color: #fff !important;
  border-color: rgba(255,255,255,.22) !important;
}

/* ===== Estado deshabilitado ===== */
.side-link.is-disabled {
  opacity: .45;
  pointer-events: none;   /* sin interacción */
  filter: grayscale(.15);
}
.side-link.is-disabled.active {
  background: transparent !important;
  border-color: transparent !important;
}
</style>
