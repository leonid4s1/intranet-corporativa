<template>
  <div
    class="admin-shell"
    :style="{
      gridTemplateColumns: isMobile ? '1fr' : `${sidebarWidth} minmax(0, 1fr)`
    }"
  >
    <AdminSidebar />

    <main class="admin-main">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import AdminSidebar from '@/components/layout/AdminSidebar.vue';
import { useUiStore } from '@/stores/ui.store';

const ui = useUiStore();

/* Detectar móvil (mismo breakpoint que usas en el sidebar) */
const isMobile = ref(false);

const handleResize = () => {
  if (typeof window === 'undefined') return;
  isMobile.value = window.innerWidth < 960;
};

onMounted(() => {
  handleResize();
  window.addEventListener('resize', handleResize);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
});

/* Ancho de la columna del sidebar en desktop:
   - 240px abierto
   - 72px colapsado  (ui.sidebarCollapsed lo maneja el sidebar) */
const sidebarWidth = computed(() => (ui.sidebarCollapsed ? '72px' : '240px'));
</script>

<style scoped>
.admin-shell {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr); /* valor por defecto */
  min-height: 100vh;
}

/* En móvil el layout es una sola columna; el sidebar se monta encima */
@media (max-width: 960px) {
  .admin-shell {
    grid-template-columns: 1fr;
  }
}

.admin-main {
  padding: 24px 24px 32px;
}
</style>
