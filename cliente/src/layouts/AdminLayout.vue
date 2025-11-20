<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import AdminSidebar from '@/components/layout/AdminSidebar.vue';
import { useUiStore } from '@/stores/ui.store';

const ui = useUiStore();

/* Detectar móvil por ancho de ventana (mismo breakpoint que el sidebar) */
const isMobile = ref(false);

const handleResize = () => {
  if (typeof window === 'undefined') return;
  isMobile.value = window.innerWidth < 992;
};

onMounted(() => {
  handleResize();
  window.addEventListener('resize', handleResize);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
});

/* En desktop usamos el colapsado del store, en móvil no se “colapsa” */
const collapsed = computed(() => !isMobile.value && ui.sidebarCollapsed);

/**
 * Offset del contenido principal:
 * - Desktop: 240px cuando el menú está abierto
 * - Desktop colapsado: 72px
 * - Móvil: 0 (el sidebar se monta encima)
 */
const contentOffset = computed(() => {
  if (isMobile.value) return '0px';
  return collapsed.value ? '72px' : '240px';
});
</script>

<template>
  <div class="admin-layout">
    <AdminSidebar />

    <main class="admin-layout__main" :style="{ marginLeft: contentOffset }">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.admin-layout {
  min-height: 100vh;
}

/* Zona principal del panel admin */
.admin-layout__main {
  min-height: 100vh;
  /* El fondo y el padding ya los manejan tus clases .page / .page-head,
     así que aquí solo gestionamos el desplazamiento horizontal */
  transition: margin-left 0.18s ease-out;
}

/* En móvil el contenido siempre ocupa todo el ancho */
@media (max-width: 991px) {
  .admin-layout__main {
    margin-left: 0 !important;
  }
}
</style>
