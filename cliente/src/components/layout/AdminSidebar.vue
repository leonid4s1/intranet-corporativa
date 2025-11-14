<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { adminMenu, type AdminMenuItem, type Role } from './adminMenu';

// Store de autenticación
import { useAuthStore } from '@/stores/auth.store';
const auth = useAuthStore();
const role = computed<Role | undefined>(() => auth.user?.role as Role | undefined);

function canSee(item: AdminMenuItem): boolean {
  if (!role.value) return false;
  return !item.roles || item.roles.includes(role.value);
}

function filterByRole(items: AdminMenuItem[]): AdminMenuItem[] {
  return items
    .filter(canSee)
    .map(i => (i.children ? { ...i, children: i.children.filter(canSee) } : i))
    .filter(i => !i.children || i.children.length > 0);
}

const route = useRoute();
function isItemActive(item: AdminMenuItem): boolean {
  const name = typeof item.to === 'object' ? item.to?.name : undefined;
  if (name && route.name === name) return true;
  if (item.children) return item.children.some(isItemActive);
  return false;
}

const menu = computed(() => filterByRole(adminMenu));
</script>

<template>
  <aside
    class="admin-sidebar"
    role="navigation"
    aria-label="Menú de administración"
  >
    <!-- Cabecera / marca -->
    <div class="side-head">
      <div class="brand-admin">
        <img
          src="@/assets/brand/odes-lockup.png"
          alt="Odes Construction"
          width="32"
          height="32"
        />
        <div class="brand-admin__text">
          <span class="brand-admin__title">Administración</span>
          <span class="brand-admin__subtitle">Panel interno</span>
        </div>
      </div>
    </div>

    <!-- Menú -->
    <nav class="side-nav">
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

          <!-- Grupo con hijos (ej. Vacaciones) -->
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
.admin-sidebar {
  width: 260px;
  min-height: 100vh;
  padding: 24px 18px;
  background: #0f172a;
  color: #e5e7eb;
  border-radius: 0 24px 24px 0;
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.6);
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
}

.side-head {
  margin-bottom: 24px;
}

.brand-admin {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand-admin__text {
  display: flex;
  flex-direction: column;
}

.brand-admin__title {
  font-size: 0.95rem;
  font-weight: 600;
}

.brand-admin__subtitle {
  font-size: 0.8rem;
  color: #9ca3af;
}

.side-menu {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 6px;
}

/* Links base */
.side-link {
  display: block;
  padding: 9px 11px;
  border-radius: 12px;
  text-decoration: none;
  color: inherit;
  font-size: 0.9rem;
  transition:
    background 0.15s ease-out,
    color 0.15s ease-out,
    transform 0.12s ease-out;
}

.side-link:hover {
  background: rgba(148, 163, 184, 0.16);
  transform: translateX(2px);
}

/* Activo */
.side-link.is-active {
  background: #f97316;
  color: #111827;
}

/* Texto dentro del link */
.side-link__label {
  font-weight: 500;
}

/* Grupos (ej. Vacaciones) */
.side-group {
  margin-top: 4px;
}

.side-group__label {
  padding: 4px 6px;
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
  padding-left: 6px;
  margin: 4px 0 0;
  display: grid;
  gap: 4px;
}

.side-link--child {
  font-size: 0.85rem;
  border-radius: 10px;
}

/* Responsive: si el ancho es chico, lo hacemos más compacto */
@media (max-width: 960px) {
  .admin-sidebar {
    position: static;
    width: 100%;
    border-radius: 16px;
    min-height: auto;
    margin-bottom: 16px;
  }
}
</style>
