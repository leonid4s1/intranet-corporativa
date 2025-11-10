<template>
  <div class="admin-announcements page">
    <header class="page-head">
      <div>
        <h1>Comunicados</h1>
        <p class="sub">Publica un comunicado con imagen, fechas y llamada a la acción.</p>
      </div>
      <router-link class="btn" :to="{ name: 'admin-home' }">← Volver al panel</router-link>
    </header>

    <section class="card">
      <h2 class="section-title">Publicar comunicado</h2>
      <AnnouncementForm />
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, defineOptions } from 'vue'
import AnnouncementForm from '@/components/admin/AnnouncementForm.vue'

defineOptions({ name: 'AdminAnnouncements' })

onMounted(() => {
  if (typeof document !== 'undefined') {
    document.title = 'Comunicados | Intranet'
  }
})
</script>

<style scoped>
.page { padding: 2rem; max-width: 1100px; margin: 0 auto; }
.page-head {
  display:flex; align-items:center; justify-content:space-between; gap: 1rem;
  margin-bottom: 1.25rem;
}
.page-head h1 { margin: 0; }
.sub { margin: .25rem 0 0; color:#6b7280; }
.card { padding: 1.25rem; border:1px solid #e5e7eb; border-radius:12px; background:#fff;
        box-shadow: 0 2px 12px rgba(0,0,0,.06); }
.section-title { margin:0 0 .75rem; }
.btn { background:#111; color:#fff; padding:8px 14px; border-radius:10px; text-decoration:none; }
</style>
