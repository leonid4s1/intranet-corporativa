<!-- cliente/src/components/ui/NewsCarousel.vue -->
<template>
  <div
    class="news-carousel"
    role="region"
    aria-label="Noticias y comunicados"
    tabindex="0"
    @mouseenter="stopAuto"
    @mouseleave="startAuto"
    @focusin="stopAuto"
    @focusout="startAuto"
    @keydown.left.prevent="prev"
    @keydown.right.prevent="next"
  >
    <div class="carousel-viewport">
      <div
        class="track"
        :style="{ transform: `translateX(-${currentIndex * 100}%)` }"
      >
        <article
          v-for="n in displayItems"
          :key="(n as any)._id || n.id"
          class="card"
          :data-type="n.type"
          :class="[
            `card--${n.type}`,
            { 'card--empty': n.id === 'no-news' },
            isHero(n) ? 'card--hero' : 'card--compact',
          ]"
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
            <!-- HERO (announcement + imagen) -->
            <div v-if="isHero(n)" class="hero">
              <header class="card__head">
                <h3 class="card__title">{{ n.title }}</h3>
                <span v-if="badge(n.type)" class="badge">{{ badge(n.type) }}</span>
              </header>

              <div class="hero__grid">
                <div class="hero__media">
                  <img
                    :src="absUrl(n.imageUrl)"
                    alt=""
                    class="hero__img"
                    loading="lazy"
                  />
                </div>

                <div class="hero__content">
                  <p v-if="bodyOf(n)" class="card__body card__body--hero">
                    {{ bodyOf(n) }}
                  </p>

                  <footer v-if="n.ctaText && n.ctaTo" class="card__footer">
                    <a
                      class="btn cta"
                      :href="n.ctaTo"
                      target="_blank"
                      rel="noopener noreferrer"
                    >{{ n.ctaText }}</a>
                  </footer>
                </div>
              </div>
            </div>

            <!-- COMPACTO -->
            <div v-else class="compact">
              <header class="card__head">
                <h3 class="card__title">{{ n.title }}</h3>
                <span v-if="badge(n.type)" class="badge">{{ badge(n.type) }}</span>
              </header>

              <p v-if="bodyOf(n)" class="card__body card__body--compact">
                {{ bodyOf(n) }}
              </p>

              <footer v-if="n.ctaText && n.ctaTo" class="card__footer">
                <a
                  class="btn cta"
                  :href="n.ctaTo"
                  target="_blank"
                  rel="noopener noreferrer"
                >{{ n.ctaText }}</a>
              </footer>
            </div>
          </template>
        </article>
      </div>
    </div>

    <!-- === Controles === -->
    <div class="controls" v-if="displayItems.length > 1">
      <button class="ctrl" @click="prev" aria-label="Anterior">‹</button>
      <span class="dots" aria-hidden="true">
        <button
          v-for="(_, i) in displayItems"
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

const displayItems = computed<NewsItem[]>(() =>
  props.items && props.items.length > 0 ? props.items : [makeNoNewsItem()]
)

function hasImage(n: NewsItem): boolean {
  return Boolean(n.imageUrl)
}
function isHero(n: NewsItem): boolean {
  return n.type === 'announcement' && hasImage(n)
}

function bodyOf(n: NewsItem): string {
  const rawBody = (n as unknown as Record<string, unknown>)['body']
  const body = typeof rawBody === 'string' ? rawBody.trim() : ''
  const excerpt = (n.excerpt || '').trim()

  if (n.type === 'birthday_digest_info' || n.type === 'birthday_self' || n.type === 'birthday_digest') {
    return body
  }
  if (excerpt) return excerpt
  return body
}

function startAuto(): void {
  stopAuto()
  if (displayItems.value.length > 1) timer = window.setInterval(() => next(), 6500)
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
    (currentIndex.value - 1 + displayItems.value.length) % displayItems.value.length
}
function go(i: number): void {
  currentIndex.value = i
  startAuto()
}

function badge(t: NewsItem['type']): string {
  switch (t) {
    case 'holiday_notice':       return 'Aviso'
    case 'birthday_self':        return '¡Feliz cumpleaños!'
    case 'birthday_digest_info':
    case 'birthday_digest':      return 'Cumpleaños hoy'
    case 'announcement':         return 'Comunicado'
    default:                     return ''
  }
}

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')

function absUrl(url?: string | null) {
  if (!url) return ''
  if (url.startsWith('http')) return url
  if (!API_BASE) return url
  return `${API_BASE}${url}`
}

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
.news-carousel { width: 100%; outline: none; }
.carousel-viewport {
  overflow: hidden;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0,0,0,.05), 0 14px 34px rgba(0,0,0,.08);
}
.track {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 100%;
  transition: transform .45s ease;
}
@media (prefers-reduced-motion: reduce) {
  .track { transition: none; }
}

.card {
  padding: 18px 20px;
  border-radius: 16px;
  border: 1px solid var(--border, #e5e7eb);
  background: #fff;
  transition: box-shadow .15s ease, transform .15s ease;
}
.card:hover { transform: translateY(-1px); box-shadow: 0 10px 26px rgba(0,0,0,.10); }

.card--compact { min-height: 170px; }
.card--hero    { min-height: 320px; }

.card__head { display:flex; align-items:center; gap:10px; padding-left: 30px; }
.card__title { margin:0; font-size: 19px; line-height: 1.25; font-weight: 850; color:#0f172a; letter-spacing: .1px; }

.badge {
  margin-left:auto;
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(99,102,241,.14);
  color:#3730a3;
  font-weight: 800;
}

/* HERO layout */
.hero__grid{
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 16px;
  margin-top: 10px;
  align-items: start;
}
.hero__media{
  border-radius: 14px;
  background: rgba(0,0,0,.03);
  outline: 1px solid rgba(0,0,0,.06);
  padding: 14px;
  display:flex;
  justify-content:center;
  align-items:center;
  min-height: 220px;
}
.hero__img{
  width: 100%;
  height: auto;
  max-height: 360px;
  object-fit: contain;
  border-radius: 12px;
}
.hero__content{ display:flex; flex-direction:column; gap: 12px; }

/* Callout */
.card{
  --callout-bg: #F5F7FA;
  --callout-text: #334155;
  --callout-border: #E5E7EB;
  --callout-accent: #CBD5E1;
  --callout-emoji: "📰";
}
.card__body{
  margin: 8px 0 0;
  padding: 12px 14px;
  display: flex;
  align-items: flex-start;
  gap: 10px;

  background: var(--callout-bg);
  color: var(--callout-text);
  border: 1px solid var(--callout-border);
  border-left: 5px solid var(--callout-accent);
  border-radius: 12px;

  font-weight: 650;
  letter-spacing: .1px;
  line-height: 1.55;

  display: -webkit-box;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.card__body::before{
  content: var(--callout-emoji);
  font-size: 20px;
  line-height: 1;
  margin-top: 1px;
  filter: drop-shadow(0 1px 3px rgba(0,0,0,.05));
}
.card__body--compact{ -webkit-line-clamp: 2; }
.card__body--hero{ -webkit-line-clamp: 6; }

.card__footer { margin-top: auto; }
.btn.cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background:#0f172a;
  color:#fff;
  padding:10px 14px;
  border-radius: 12px;
  text-decoration:none;
  font-size: .92rem;
  font-weight: 800;
  transition: transform .12s ease, box-shadow .12s ease;
  box-shadow: 0 6px 16px rgba(15,23,42,.18);
}
.btn.cta:hover { transform: translateY(-1px); box-shadow: 0 10px 22px rgba(15,23,42,.22); }

/* Colores por tipo */
.card--birthday_self,
.card--birthday_digest_info {
  background: linear-gradient(180deg, rgba(99,102,241,.11), transparent 62%) #fff;
  border-color: rgba(99,102,241,.30);
  --callout-bg:#F5F3FF; --callout-text:#4C1D95; --callout-border:#DDD6FE; --callout-accent:#8B5CF6; --callout-emoji:"🎂";
}
.card--birthday_self .badge,
.card--birthday_digest_info .badge {
  background: rgba(99,102,241,.18);
  color: #4f46e5;
}

.card--holiday_notice{
  background: linear-gradient(180deg, rgba(251,146,60,.11), transparent 62%) #fff;
  border-color: rgba(251,146,60,.30);
  --callout-bg:#FFF3E8; --callout-text:#9A3412; --callout-border:#FDBA74; --callout-accent:#F97316; --callout-emoji:"🗓️";
}
.card--holiday_notice .badge { background:#fff7ed; color:#9a3412; }

.card--announcement{
  background: linear-gradient(180deg, rgba(34,197,94,.11), transparent 62%) #fff;
  border-color: rgba(34,197,94,.30);
  --callout-bg:#ECFDF5; --callout-text:#065F46; --callout-border:#A7F3D0; --callout-accent:#10B981; --callout-emoji:"📢";
}
.card--announcement .badge{
  background: rgba(34,197,94,.18);
  color: #047857;
}

/* Empty */
.card--empty { display:flex; align-items:center; justify-content:center; background:#f9fafb; }
.empty-state { text-align:center; color:#374151; padding: 24px; }
.empty-icon { font-size: 2rem; margin-bottom: .5rem; opacity: .6; }
.empty-text h3 { font-weight: 800; font-size: 1.1rem; color:#111827; margin-bottom: .25rem; }
.empty-text p { font-size: .92rem; color:#6b7280; margin:0; }

/* Controles */
.controls { display:flex; align-items:center; justify-content:center; gap:10px; padding:12px 8px; }
.ctrl {
  background:#eef2f7;
  border:0;
  padding:8px 12px;
  border-radius: 12px;
  cursor:pointer;
  box-shadow: 0 2px 8px rgba(0,0,0,.08);
  font-weight: 900;
}
.dots { display:flex; gap:6px; }
.dot { width:8px; height:8px; border-radius:999px; border:0; background:#d1d5db; cursor:pointer; transition: all .2s ease; }
.dot.active { background:#6b7280; width:18px; border-radius:6px; }

/* Responsive */
@media (max-width: 860px){
  .hero__grid{ grid-template-columns: 1fr; }
  .card--hero{ min-height: 340px; }
}
@media (max-width: 640px){
  .card__title{ font-size: 18px; }
  .card--compact{ min-height: 160px; }
}
</style>
