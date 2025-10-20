<!-- cliente/src/components/layout/AppOverlay.vue -->
<template>
  <div
    v-if="ui.isMobile && ui.sidebarMobileOpen"
    class="app-overlay"
    @click="ui.closeSidebarMobile()"
    aria-hidden="true"
  />
</template>

<script setup lang="ts">
import { useUiStore } from '@/stores/ui.store';
const ui = useUiStore();
</script>

<style scoped>
.app-overlay {
  position: fixed;
  inset: 0;
  background: rgba(17, 24, 39, 0.35); /* gris oscuro translúcido */
  backdrop-filter: blur(1px);
  z-index: 1099; /* justo debajo del sidebar si éste va en 1100+ */
  animation: fadeIn .16s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
</style>
