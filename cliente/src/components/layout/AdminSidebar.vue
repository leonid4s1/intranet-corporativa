<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { adminMenu, type AdminMenuItem, type Role } from './adminMenu';

import { useAuthStore } from '@/stores/auth.store';
import { useUiStore } from '@/stores/ui.store';

// isotipo cuadrado (mismo pack que usas en la app)
import logoMark from '@/assets/odes-mark.png';

const auth = useAuthStore();
const ui = useUiStore();
const route = useRoute();

/* ========= Roles / menú ========= */
const role = computed<Role | undefined>(
  () => auth.user?.role as Role | undefined
);

function canSee(item: AdminMenuItem): boolean {
  if (!role.value) return false;
  return !item.roles || item.roles.includes(role.value);
}

function filterByRole(items: AdminMenuItem[]): AdminMenuItem[] {
  return items
    .filter(canSee)
    .map((i) => (i.children ? { ...i, children: i.children.filter(canSee) } : i))
    .filter((i) => !i.children || i.children.length > 0);
}

function isItemActive(item: AdminMenuItem): boolean {
  const name = typeof item.to === 'object' ? item.to?.name : undefined;
  if (name && route.name === name) return true;
  if (item.children) return item.children.some(isItemActive);
  return false;
}

const menu = computed(() => filterByRole(adminMenu));

/* ========= Estado visual sidebar ========= */

// detectamos móvil por ancho de ventana
const isMobile = ref(false);

const handleResize = () => {
  if (typeof window === 'undefined') return;
  isMobile.value = window.innerWidth < 992; // breakpoint aproximado
};

onMounted(() => {
  handleResize();
  window.addEventListener('resize', handleResize);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
});

// del store PERO ajustado para que en móvil no se "colapse"
const collapsed = computed(() => !isMobile.value && ui.sidebarCollapsed);
const isMobileOpen = computed(() => isMobile.value && ui.sidebarMobileOpen);

const onBurgerClick = () => {
  if (isMobile.value) {
    ui.sidebarMobileOpen = !ui.sidebarMobileOpen;
  } else {
    ui.toggleSidebar();
  }
};
</script>

<template>
  <aside
    id="admin-sidebar"
    class="app-sidebar admin-sidebar"
    :class="{
      'is-collapsed': collapsed,
      'is-mobile': isMobile,
      'is-open': isMobile && isMobileOpen
    }"
    :style="{ '--sidebar-width': collapsed ? '72px' : '240px' }"
    role="navigation"
    aria-label="Menú de administración"
  >
    <!-- Cabecera / marca -->
    <div class="side-head admin-side-head">
      <button
        class="brand-btn admin-brand-btn"
        type="button"
        @click="onBurgerClick"
        :aria-label="
          isMobile
            ? isMobileOpen
              ? 'Cerrar menú'
              : 'Abrir menú'
            : collapsed
              ? 'Expandir menú'
              : 'Colapsar menú'
        "
        aria-controls="admin-sidebar"
        :aria-expanded="isMobile ? isMobileOpen : undefined"
      >
        <div class="brand-mark-wrap">
          <img :src="logoMark" alt="Logo Odes" class="brand-mark-img" />
        </div>
      </button>

      <!-- Texto solo cuando NO está colapsado (o en móvil) -->
      <div v-if="!collapsed || isMobile" class="brand-admin">
        <span class="brand-admin__title">Administración</span>
        <span class="brand-admin__subtitle">Panel interno</span>
      </div>
    </div>

    <!-- Menú -->
    <nav class="side-nav admin-side-nav">
      <ul class="side-menu">
        <li v-for="(item, i) in menu" :key="i">
          <!-- Item simple -->
          <RouterLink
            v-if="!item.children"
            :to="item.to as any"
            class="side-link"
            :class="{ 'is-active': isItemActive(item) }"
          >
            <span class="side-link__label">{{ item.label }}</span>
          </RouterLink>

          <!-- Grupo (Vacaciones) -->
          <div v-else class="side-group">
            <div
              class="side-group__label"
              :class="{ 'is-active': isItemActive(item) }"
            >
              {{ item.label }}
            </div>
            <ul class="side-group__list">
              <li v-for="(child, j) in item.children" :key="j">
                <RouterLink
                  :to="child.to as any"
                  class="side-link side-link--child"
                  :class="{ 'is-active': isItemActive(child) }"
                >
                  <span class="side-link__label">{{ child.label }}</span>
                </RouterLink>
              </li>
            </ul>
          </div>
        </li>
      </ul>
    </nav>
  </aside>
</template>

<style scoped>
/* Fondo y texto: oscuro como el sidebar del usuario */
.admin-sidebar {
  background: #020617;
  color: #e5e7eb;
  padding-top: 20px;
  padding-bottom: 20px;
  border-right: 1px solid rgba(15, 23, 42, 0.7);
}

/* Aseguramos cabecera consistente */
.admin-side-head {
  padding-inline: 12px;
}

/* Botón de marca: buen contraste con el fondo */
.admin-brand-btn {
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
}

.brand-mark-wrap {
  width: 40px;
  height: 40px;
  border-radius: 999px;
  background: #f97316; /* naranja corporativo */
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 10px 20px rgba(249, 115, 22, 0.35);
}

.brand-mark-img {
  width: 26px;
  height: 26px;
  object-fit: contain;
}

/* Marca / texto */
.brand-admin {
  display: flex;
  flex-direction: column;
  margin-left: 10px;
}

.brand-admin__title {
  font-size: 0.9rem;
  font-weight: 600;
  color: #f9fafb; /* blanco para contraste máximo */
}

.brand-admin__subtitle {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #9ca3af;
}

/* Menú */
.side-menu {
  list-style: none;
  padding: 0;
  margin: 16px 0 0;
  display: grid;
  gap: 4px;
}

/* Link base */
.side-link {
  display: block;
  padding: 9px 14px;
  border-radius: 999px;
  text-decoration: none;
  font-size: 0.9rem;
  color: #e5e7eb;
  transition:
    background 0.15s ease-out,
    color 0.15s ease-out,
    transform 0.12s ease-out;
}

.side-link:hover {
  background: rgba(148, 163, 184, 0.25);
  transform: translateX(2px);
}

/* Activo: pastilla naranja como en el usuario */
.side-link.is-active {
  background: #f97316;
  color: #111827;
}

.side-link__label {
  font-weight: 500;
}

/* Grupos (VACACIONES) */
.side-group {
  margin-top: 4px;
}

.side-group__label {
  padding: 6px 14px 2px;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #9ca3af;
}

.side-group__label.is-active {
  color: #e5e7eb;
}

.side-group__list {
  list-style: none;
  padding-left: 8px;
  margin: 4px 0 0;
  display: grid;
  gap: 2px;
}

.side-link--child {
  font-size: 0.85rem;
  padding-inline: 18px;
}

/* ===================== */
/*   ESTADO COLAPSADO    */
/* ===================== */

/* Ocultamos textos para que no se corten al hacer el sidebar estrecho */
.app-sidebar.is-collapsed .brand-admin {
  display: none;
}

.app-sidebar.is-collapsed .side-group__label {
  display: none;
}

.app-sidebar.is-collapsed .side-link__label {
  display: none;
}

/* Compactamos los enlaces para que queden como “píldoras” centradas */
.app-sidebar.is-collapsed .side-link {
  text-align: center;
  padding-inline: 10px;
  justify-content: center;
}

/* Móvil: que se vea como panel completo, sin colapsar */
.app-sidebar.is-mobile {
  border-radius: 0;
}

@media (max-width: 960px) {
  .admin-sidebar {
    min-height: auto;
  }
}
</style>
