<!-- cliente/src/components/ui/NewsCarousel.vue -->
<template>
  <div class="news-carousel" role="region" aria-label="Noticias y comunicados">
    <div class="carousel-viewport">
      <div class="track" :style="{ transform: `translateX(-${currentIndex * 100}%)` }">
        <article
          v-for="n in displayItems"
          :key="n.id"
          class="card"
          :class="[`card--${n.type}`, { 'card--empty': n.id === 'no-news' }]"
        >
          <!-- === Estado vacío === -->
          <template v-if="n.id === 'no-news'">
            <div class="empty-state">
              <div class="empty-icon">📰</div>
              <div class="empty-text">
                <h3>Sin noticias o comunicados</h3>
                <p>No hay Noticias o Comunicados por ahora. ¡Vuelve pronto!</p>
              </div>
            </div>
          </template>

          <!-- === Tarjetas reales === -->
          <template v-else>
            <header class="card__head">
              <h3 class="card__title">{{ n.title }}</h3>
              <span v-if="badge(n.type)" class="badge">{{ badge(n.type) }}</span>
            </header>

            <!-- Imagen destacada -->
            <img
              v-if="n.imageUrl"
              :src="n.imageUrl"
              alt=""
              class="card__image"
              loading="lazy"
            />

            <p v-if="bodyOf(n)" class="card__body">{{ bodyOf(n) }}</p>

            <!-- CTA -->
            <footer v-if="n.ctaText && n.ctaTo" class="card__footer">
              <a
                class="btn cta"
                :href="n.ctaTo"
                target="_blank"
                rel="noopener noreferrer"
              >{{ n.ctaText }}</a>
            </footer>
          </template>
        </article>
      </div>
    </div>

    <!-- === Controles === -->
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

/* ======== Props ======== */
const props = defineProps<{ items?: NewsItem[] }>()

/* ======== Estado ======== */
const currentIndex = ref(0)
let timer: number | undefined

/* ======== Computed ======== */
const displayItems = computed<NewsItem[]>(() =>
  props.items && props.items.length > 0 ? props.items : [makeNoNewsItem()]
)

/* ======== Métodos ======== */
function bodyOf(n: NewsItem): string {
  return n.excerpt?.trim() ?? ''
}

function startAuto(): void {
  stopAuto()
  if (displayItems.value.length > 1)
    timer = window.setInterval(() => next(), 6500)
}
function stopAuto(): void {
  if (timer) window.clearInterval(timer)
  timer = undefined
}
function next(): void {
  currentIndex.value = (currentIndex.value + 1) % displayItems.value.length
}
function prev(): void {
  currentIndex.value =
    (currentIndex.value - 1 + displayItems.value.length) %
    displayItems.value.length
}
function go(i: number): void {
  currentIndex.value = i
  startAuto()
}

/** Etiquetas según tipo */
function badge(t: NewsItem['type']): string {
  switch (t) {
    case 'holiday_notice':
      return 'Aviso'
    case 'birthday_self':
      return '¡Feliz cumpleaños!'
    case 'birthday_digest_info':
    case 'birthday_digest':
      return 'Cumpleaños hoy'
    case 'announcement':
      return 'Comunicado'
    default:
      return ''
  }
}

/* ======== Ciclo ======== */
onMounted(startAuto)
onUnmounted(stopAuto)
watch(
  () => props.items?.length,
  () => {
    currentIndex.value = 0
    startAuto()
  }
)
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
  min-height: 140px;
  display:flex;
  flex-direction:column;
  justify-content: space-between;
  gap:10px;
  position: relative;
  border-radius: 16px;
  border: 1px solid var(--border, #e5e7eb);
  background: #fff;
}

/* Imagen */
.card__image {
  width: 100%;
  max-height: 220px;
  object-fit: cover;
  border-radius: 10px;
}

/* Cuerpo y cabecera */
.card__head { display:flex; align-items:center; gap:8px; }
.card__title { margin:0; font-size: 18px; line-height: 1.3; font-weight:700; color:#1e293b; }
.card__body { margin:0; color:#334155; line-height:1.5; font-size: 0.95rem; }

/* CTA */
.card__footer {
  margin-top: auto;
}
.btn.cta {
  background:#111;
  color:#fff;
  padding:8px 14px;
  border-radius:10px;
  text-decoration:none;
  font-size:0.9rem;
  transition: background .2s ease;
}
.btn.cta:hover { background:#222; }

/* Badge */
.badge {
  font-size: 12px; padding:2px 8px; border-radius: 999px;
  background: #eef2ff; color:#3730a3; margin-left:auto;
}

/* Tipos */
.card--holiday_notice .badge { background:#fff7ed; color:#9a3412; }
.card--birthday_self .badge { background:#ecfeff; color:#155e75; }
.card--announcement .badge { background:#e0f2fe; color:#0369a1; }

/* === Estado vacío === */
.card--empty {
  display:flex;
  align-items:center;
  justify-content:center;
  background: #f9fafb;
}
.empty-state { text-align:center; color:#374151; }
.empty-icon { font-size: 2rem; margin-bottom: .5rem; opacity: 0.6; }
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

/* Controles */
.controls { display:flex; align-items:center; justify-content:center; gap:8px; padding:8px; }
.ctrl { background:#f3f4f6; border:0; padding:6px 10px; border-radius:10px; cursor:pointer; }
.dots { display:flex; gap:6px; }
.dot { width:8px; height:8px; border-radius:999px; border:0; background:#d1d5db; cursor:pointer; transition: all .2s ease; }
.dot.active { background:#6b7280; width:18px; border-radius:6px; }

/* Cumpleaños */
.card--birthday_self{
  background: linear-gradient(180deg, rgba(99,102,241,.08), transparent 60%) #fff;
  border-color: rgba(99,102,241,.28);
}
.card--birthday_digest_info{
  background: linear-gradient(180deg, rgba(16,185,129,.10), transparent 60%) #fff;
  border-color: rgba(16,185,129,.28);
}
.card--holiday_notice{
  background: linear-gradient(180deg, rgba(251,146,60,.10), transparent 60%) #fff;
  border-color: rgba(251,146,60,.30);
}

/* Responsive */
@media (max-width: 640px){
  .card{ min-height: 130px; }
  .card__title{ font-size: 17px; }
  .card__body{ font-size: .95rem; }
}
</style>
