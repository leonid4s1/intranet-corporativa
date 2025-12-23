<template>
  <section class="docs">
    <header class="docs__head">
      <h1 class="docs__title">Documentación Odes</h1>
      <p class="docs__sub">Accede a manuales, reglamentos y políticas corporativas</p>
    </header>

    <div class="tabs">
      <button
        v-for="t in tabs"
        :key="t.key"
        class="tab"
        :class="{ active: activeTab === t.key }"
        type="button"
        @click="activeTab = t.key"
      >
        {{ t.label }}
      </button>
    </div>

    <div class="list" v-if="loading">
      <div class="skeleton" v-for="n in 3" :key="n"></div>
    </div>

    <div class="list" v-else>
      <article v-for="d in items" :key="d.id" class="card">
        <div class="card__left">
          <div class="icon">📄</div>
          <div class="meta">
            <div class="row">
              <h3 class="name">{{ d.title }}</h3>
              <span v-if="d.status" class="pill">{{ d.status }}</span>
            </div>
            <p class="small">
              <span v-if="d.version">Versión: {{ d.version }}</span>
              <span v-if="d.updatedAt" class="sep">•</span>
              <span v-if="d.updatedAt">Actualizado: {{ formatDate(d.updatedAt) }}</span>
              <span v-if="d.sizeMB" class="sep">•</span>
              <span v-if="d.sizeMB">{{ d.sizeMB.toFixed(1) }} MB</span>
            </p>
          </div>
        </div>

        <div class="card__actions">
          <button class="btn" type="button" :disabled="!d.viewUrl" @click="openUrl(d.viewUrl)">
            👁️ Ver
          </button>
          <button class="btn" type="button" :disabled="!d.downloadUrl" @click="openUrl(d.downloadUrl)">
            ⬇️ Descargar
          </button>
        </div>
      </article>

      <p v-if="!items.length" class="empty">No hay documentos en esta categoría.</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { fetchDocs, type DocCategory, type DocItem } from '@/services/docs.service'

const tabs = [
  { key: 'manuales', label: 'Manuales' },
  { key: 'reglamentos', label: 'Reglamentos' },
  { key: 'politicas', label: 'Políticas' },
] as const

const activeTab = ref<DocCategory>('manuales')
const loading = ref(false)
const data = ref<Record<DocCategory, DocItem[]>>({
  manuales: [],
  reglamentos: [],
  politicas: [],
})

const items = computed(() => data.value[activeTab.value] || [])

function formatDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function openUrl(url?: string | null) {
  if (!url) return
  window.open(url, '_blank', 'noopener,noreferrer')
}

async function load(cat: DocCategory) {
  loading.value = true
  try {
    data.value[cat] = await fetchDocs(cat)
  } finally {
    loading.value = false
  }
}

onMounted(() => load(activeTab.value))
watch(activeTab, (v) => load(v))
</script>

<style scoped>
.docs { padding: 18px 18px 40px; }
.docs__head { margin-bottom: 12px; }
.docs__title { font-size: 28px; font-weight: 800; margin: 0; color: #2b2f33; }
.docs__sub { margin: 4px 0 0; color: #6b7280; }

.tabs { display: inline-flex; gap: 10px; margin: 14px 0 18px; background: #f3f4f6; padding: 6px; border-radius: 12px; }
.tab { border: 0; background: transparent; padding: 10px 14px; border-radius: 10px; cursor: pointer; color: #374151; font-weight: 600; }
.tab.active { background: #fff; box-shadow: 0 1px 6px rgba(0,0,0,.06); }

.list { display: flex; flex-direction: column; gap: 14px; max-width: 980px; }
.card { display: flex; align-items: center; justify-content: space-between; gap: 16px; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px 14px; box-shadow: 0 1px 10px rgba(0,0,0,.04); }
.card__left { display: flex; align-items: center; gap: 12px; min-width: 0; }
.icon { width: 42px; height: 42px; border-radius: 10px; background: #f3f4f6; display: grid; place-items: center; }
.meta { min-width: 0; }
.row { display: flex; align-items: center; gap: 10px; }
.name { margin: 0; font-size: 16px; font-weight: 800; color: #2b2f33; }
.pill { font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 999px; background: #e7f7ed; color: #1f7a3a; }
.small { margin: 4px 0 0; color: #6b7280; font-size: 13px; }
.sep { margin: 0 8px; }

.card__actions { display: flex; gap: 10px; }
.btn { border: 1px solid #e5e7eb; background: #fff; padding: 10px 12px; border-radius: 10px; cursor: pointer; font-weight: 700; color: #374151; }
.btn:disabled { opacity: .5; cursor: not-allowed; }

.skeleton { height: 74px; border-radius: 12px; background: #f3f4f6; border: 1px solid #eee; }

.empty { color: #6b7280; margin: 6px 0 0; }
</style>
