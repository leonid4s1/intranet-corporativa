<template>
  <div class="admin-shell">
    <AdminSidebar />

    <main class="admin-main">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import AdminSidebar from '@/components/layout/AdminSidebar.vue';
</script>

<style scoped>
.admin-shell {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  min-height: 100vh;
}

/* En móvil ponemos el menú arriba */
@media (max-width: 960px) {
  .admin-shell {
    grid-template-columns: 1fr;
  }
}

.admin-main {
  padding: 24px 24px 32px;
}
</style>
