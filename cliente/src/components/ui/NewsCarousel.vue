<!-- cliente/src/components/ui/NewsCarousel.vue -->
<template>
  <div class="news-carousel" role="region" aria-label="Noticias y comunicados">
    <div class="carousel-viewport">
      <div class="track" :style="{ transform: `translateX(-${currentIndex * 100}%)` }">
        <article
          v-for="(n,i) in displayItems"
          :key="i"
          class="card"
          :class="[`card--${n.type}`, { 'card--empty': n.id === 'no-news' }]"
        >
          <template v-if="n.id === 'no-news'">
            <div class="empty-state">
              <div class="empty-icon">📰</div>
              <div class="empty-text">
                <h3>Sin noticias o comunicados</h3>
                <p>No hay Noticias o Comunicados por ahora. ¡Vuelve pronto!</p>
              </div>
            </div>
          </template>

          <template v-else>
            <header class="card__head">
              <h3 class="card__title">{{ n.title }}</h3>
              <span v-if="badge(n.type)" class="badge">{{ badge(n.type) }}</span>
            </header>
            <p class="card__body" v-if="bodyOf(n)">{{ bodyOf(n) }}</p>
          </template>
        </article>
      </div>
    </div>

    <div class="controls" v-if="displayItems.length > 1">
      <button class="ctrl" @click="prev" aria-label="Anterior">‹</button>
      <span class="dots" aria-hidden="true">
        <button
          v-for="(_,i) in displayItems"
          :key="i"
          class="dot"
          :class="{ active: i === currentIndex }"
          @click="go(i)"
        />
      </span>
      <button class="ctrl" @click="next" aria-label="Siguiente">›</button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import type { NewsItem } from '@/services/news.service'
import { makeNoNewsItem } from '@/services/news.service'

const props = defineProps<{ items?: NewsItem[] }>()

const currentIndex = ref(0)
let timer: number | undefined

const displayItems = computed<NewsItem[]>(() => {
  return props.items && props.items.length > 0 ? props.items : [makeNoNewsItem()]
})

function bodyOf(n: NewsItem): string {
  const anyN = n as Record<string, unknown>
  const body = typeof anyN['body'] === 'string' ? (anyN['body'] as string) : undefined
  const excerpt = typeof anyN['excerpt'] === 'string' ? (anyN['excerpt'] as string) : undefined
  return body ?? excerpt ?? ''
}

function startAuto() {
  stopAuto()
  if (displayItems.value.length > 1) timer = window.setInterval(() => { next() }, 6500)
}
function stopAuto() { if (timer) window.clearInterval(timer); timer = undefined }
function next() { currentIndex.value = (currentIndex.value + 1) % displayItems.value.length }
function prev() { currentIndex.value = (currentIndex.value - 1 + displayItems.value.length) % displayItems.value.length }
function go(i: number) { currentIndex.value = i; startAuto() }

function badge(t: NewsItem['type']) {
  if (t === 'holiday_notice') return 'Aviso'
  if (t === 'birthday_self') return '¡Feliz cumpleaños!'
  if (t === 'birthday_digest_info') return 'Cumpleaños hoy'
  return ''
}

onMounted(startAuto)
onUnmounted(stopAuto)
watch(() => props.items?.length, () => { currentIndex.value = 0; startAuto() })
</script>

<style scoped>
.news-carousel { width: 100%; }
.carousel-viewport {
  overflow: hidden;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0,0,0,.05), 0 6px 24px rgba(0,0,0,.06);
}
.track {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 100%;
  transition: transform .45s ease;
}
.card {
  padding: 18px 22px;
  min-height: 120px;
  display:flex;
  flex-direction:column;
  gap:8px;
}
.card__head { display:flex; align-items:center; gap:8px; }
.card__title { margin:0; font-size: 18px; line-height: 1.3; font-weight:700; color:#1e293b; }
.card__body { margin:0; color:#334155; line-height:1.5; }
.badge {
  font-size: 12px; padding:2px 8px; border-radius: 999px;
  background: #eef2ff; color:#3730a3; margin-left:auto;
}
.card--holiday_notice .badge { background:#fff7ed; color:#9a3412; }
.card--birthday_self .badge { background:#ecfeff; color:#155e75; }

/* === Estado vacío (sin noticias) === */
.card--empty {
  display:flex;
  align-items:center;
  justify-content:center;
  background: #f9fafb;
}
.empty-state {
  text-align:center;
  color:#374151;
}
.empty-icon {
  font-size: 2rem;
  margin-bottom: .5rem;
  opacity: 0.6;
}
.empty-text h3 {
  font-weight: 700;
  font-size: 1.1rem;
  color:#111827;
  margin-bottom: .25rem;
}
.empty-text p {
  font-size: .92rem;
  color:#6b7280;
  margin:0;
}

.controls { display:flex; align-items:center; justify-content:center; gap:8px; padding:8px; }
.ctrl { background:#f3f4f6; border:0; padding:6px 10px; border-radius:10px; cursor:pointer; }
.dots { display:flex; gap:6px; }
.dot { width:8px; height:8px; border-radius:999px; border:0; background:#d1d5db; cursor:pointer; transition: all .2s ease; }
.dot.active { background:#6b7280; width:18px; border-radius:6px; }
</style>
