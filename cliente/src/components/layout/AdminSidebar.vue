<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { adminMenu, type AdminMenuItem, type Role } from './adminMenu';

// 👇 ajusta a tu store real
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
    .map(i => i.children ? { ...i, children: i.children.filter(canSee) } : i)
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
  <aside class="w-64 border-r bg-white">
    <nav class="p-3 space-y-2">
      <template v-for="(item, i) in menu" :key="i">
        <!-- Item simple -->
        <RouterLink
          v-if="!item.children"
          :to="item.to as any"
          class="block px-3 py-2 rounded transition"
          :class="isItemActive(item) ? 'bg-gray-100 text-gray-900 font-medium' : 'hover:bg-gray-50 text-gray-700'"
        >
          {{ item.label }}
        </RouterLink>

        <!-- Grupo -->
        <div v-else>
          <div class="px-3 py-2 text-xs uppercase text-gray-500" :class="isItemActive(item) && 'text-gray-800'">
            {{ item.label }}
          </div>
          <div class="ml-2 space-y-1">
            <RouterLink
              v-for="(child, j) in item.children"
              :key="j"
              :to="child.to as any"
              class="block px-3 py-2 rounded transition"
              :class="isItemActive(child) ? 'bg-gray-100 text-gray-900 font-medium' : 'hover:bg-gray-50 text-gray-700'"
            >
              {{ child.label }}
            </RouterLink>
          </div>
        </div>
      </template>
    </nav>
  </aside>
</template>
