<template>
  <div
    class="app-overlay"
    @click="ui.closeSidebarMobile()"
    aria-hidden="true"
  />
</template>

<script setup lang="ts">
import { useUiStore } from '@/stores/ui.store'
const ui = useUiStore()
</script>

<style scoped>
.app-overlay{
  position: fixed;
  inset: 0;
  background: rgba(17,24,39,.35);
  z-index: 1099; /* justo debajo del sidebar (1100) */
  opacity: 0;
  pointer-events: none;
  transition: opacity .2s ease;
}

/* Se muestra cuando el store pone la clase global en <body> o <html> */
:global(.is-mobile-open) .app-overlay{
  opacity: 1;
  pointer-events: auto;
}
</style>
