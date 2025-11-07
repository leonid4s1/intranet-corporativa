<!-- cliente/src/components/admin/AnnouncementForm.vue -->
<template>
  <form class="card form" @submit.prevent="submit" novalidate>
    <h2>Publicar comunicado</h2>

    <label>Título
      <input v-model.trim="form.title" required />
    </label>

    <label>Resumen (se ve en el carrusel)
      <input v-model.trim="form.excerpt" maxlength="140" placeholder="Máx. 140 caracteres" />
    </label>

    <label>Contenido (opcional)
      <textarea v-model="form.body" rows="6" />
    </label>

    <div class="row">
      <label>Visible desde
        <input type="datetime-local" v-model="form.visibleFrom" />
      </label>
      <label>Visible hasta
        <input type="datetime-local" v-model="form.visibleUntil" />
      </label>
    </div>

    <div class="row">
      <label>CTA texto
        <input v-model="form.ctaText" placeholder="Ver más" />
      </label>
      <label>CTA enlace
        <input v-model="form.ctaTo" placeholder="https://..." />
      </label>
    </div>

    <label>Imagen (opcional)
      <input type="file" accept="image/*" @change="onFile" />
    </label>

    <button class="btn primary" :disabled="isDisabled">
      {{ loading ? 'Publicando...' : 'Publicar' }}
    </button>
  </form>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { createAnnouncement } from '@/services/news.service'
import type { CreateAnnouncementPayload } from '@/services/news.service'

const form = ref<CreateAnnouncementPayload>({
  title: '',
  excerpt: '',
  body: '',
  ctaText: '',
  ctaTo: '',
  visibleFrom: '',
  visibleUntil: '',
  image: null,
})

const loading = ref<boolean>(false)

function onFile(e: Event): void {
  const input = e.target as HTMLInputElement | null
  const file = input?.files?.[0] ?? null
  form.value.image = file
}

const isDisabled = computed<boolean>(() => {
  if (loading.value) return true
  if (!form.value.title?.trim()) return true
  // Validación simple de URL si hay CTA
  if (form.value.ctaTo && !/^https?:\/\//i.test(form.value.ctaTo)) return true
  return false
})

function resetForm(): void {
  form.value = {
    title: '',
    excerpt: '',
    body: '',
    ctaText: '',
    ctaTo: '',
    visibleFrom: '',
    visibleUntil: '',
    image: null,
  }
}

async function submit(): Promise<void> {
  loading.value = true
  try {
    await createAnnouncement(form.value)
    alert('Comunicado publicado y enviado por correo ✅')
    resetForm()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    console.error('[AnnouncementForm] Error al publicar:', err)
    alert(`Error al publicar: ${msg}`)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.form { display:grid; gap:12px; }
.row { display:grid; gap:12px; grid-template-columns: 1fr 1fr; }
input, textarea { width:100%; padding:10px; border:1px solid #e5e7eb; border-radius:10px; }
.btn.primary { background:#111; color:#fff; padding:10px 16px; border-radius:10px; }
.btn[disabled] { opacity: .6; cursor: not-allowed; }
</style>
