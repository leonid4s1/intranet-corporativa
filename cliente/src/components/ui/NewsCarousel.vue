<!-- cliente/src/components/ui/NewsCarousel.vue -->
<template>
  <div class="news-carousel" role="region" aria-label="Noticias y comunicados">
    <div class="carousel-viewport">
      <div class="track" :style="{ transform: `translateX(-${currentIndex * 100}%)` }">
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
            <header class="card__head">
              <h3 class="card__title">{{ n.title }}</h3>
              <span v-if="badge(n.type)" class="badge">{{ badge(n.type) }}</span>
            </header>

            <!-- Imagen destacada -->
            <img
              v-if="n.imageUrl && isHero(n)"
              :key="n.imageUrl"
              :src="absUrl(n.imageUrl)"
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

/* ======== UI helpers ======== */
function hasImage(n: NewsItem): boolean {
  return Boolean(n.imageUrl)
}

/** Solo anuncios con imagen se ven grandes */
function isHero(n: NewsItem): boolean {
  return n.type === 'announcement' && hasImage(n)
}

/** Muestra excerpt y, si no hay, usa body (sin usar any). */
function bodyOf(n: NewsItem): string {
  const rawBody = (n as unknown as Record<string, unknown>)['body']
  const body = typeof rawBody === 'string' ? rawBody.trim() : ''
  const excerpt = (n.excerpt || '').trim()

  // 👇 En cumpleaños (y similares) "excerpt" se usa como marker técnico
  if (
    n.type === 'birthday_digest_info' ||
    n.type === 'birthday_self' ||
    n.type === 'birthday_digest'
  ) {
    return body
  }

  // Para comunicados normales, sí preferimos excerpt si existe
  if (excerpt) return excerpt
  return body
}

/* ======== Métodos ======== */
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
  box-shadow: 0 1px 2px rgba(0,0,0,.05), 0 10px 26px rgba(0,0,0,.06);
}
.track {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 100%;
  transition: transform .45s ease;
}

.card {
  padding: 18px 20px;
  min-height: 150px;
  display:flex;
  flex-direction:column;
  gap:10px;
  position: relative;
  border-radius: 16px;
  border: 1px solid var(--border, #e5e7eb);
  background: #fff;
  transition: box-shadow .15s ease, transform .15s ease;
}
.card:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 24px rgba(0,0,0,.08);
}

/* ✅ Compacto: evita mega espacios */
.card--compact {
  min-height: 160px;
  justify-content: flex-start;
}

/* ✅ Hero: más aire cuando hay imagen */
.card--hero {
  min-height: 340px;
  justify-content: flex-start;
}

/* Imagen: modo "poster" (no recorta) */
.card__image {
  display: block;
  width: min(520px, 100%);
  max-height: 320px;
  margin: 8px auto 0;

  object-fit: contain;
  border-radius: 12px;
  background: #f9fafb;
  outline: 1px solid rgba(0,0,0,.05);
}

/* Cabecera y cuerpo */
.card__head { display:flex; align-items:center; gap:8px; padding-left: 30px; }
.card__title { margin:0; font-size: 19px; line-height: 1.3; font-weight:800; color:#0f172a; letter-spacing:.1px; }

/* ===== Callout global para el cuerpo ===== */
.card{
  --callout-bg: #F5F7FA;
  --callout-text: #334155;
  --callout-border: #E5E7EB;
  --callout-accent: #CBD5E1;
  --callout-emoji: "📰";
}

/* ✅ clamp del cuerpo para que NO crezca infinito */
.card .card__body{
  margin-top: 6px;
  padding: 12px 14px;
  display: flex;
  align-items: center;
  gap: 10px;

  background: var(--callout-bg);
  color: var(--callout-text);
  border: 1px solid var(--callout-border);
  border-left: 5px solid var(--callout-accent);
  border-radius: 12px;

  font-weight: 600;
  letter-spacing: .1px;
  line-height: 1.55;

  /* clamp base */
  display: -webkit-box;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Compacto: 2 líneas */
.card--compact .card__body{
  -webkit-line-clamp: 2;
}

/* Hero: 4 líneas */
.card--hero .card__body{
  -webkit-line-clamp: 4;
}

.card .card__body::before{
  content: var(--callout-emoji);
  font-size: 20px;
  line-height: 1;
  filter: drop-shadow(0 1px 3px rgba(0,0,0,.05));
}

/* CTA */
.card__footer { margin-top: auto; }
.btn.cta {
  background:#111; color:#fff; padding:8px 14px; border-radius:10px;
  text-decoration:none; font-size:0.9rem; transition: background .2s ease;
}
.btn.cta:hover { background:#222; }

/* Badge */
.badge {
  font-size: 12px; padding:3px 10px; border-radius: 999px; margin-left:auto;
  background: #eef2ff; color:#3730a3; font-weight:700;
}

/* ===== Colores por tipo ===== */

/* Cumpleaños */
.card--birthday_self,
.card--birthday_digest_info {
  background: linear-gradient(180deg, rgba(99,102,241,.10), transparent 60%) #fff;
  border-color: rgba(99,102,241,.30);
  --callout-bg:#F5F3FF; --callout-text:#4C1D95; --callout-border:#DDD6FE; --callout-accent:#8B5CF6; --callout-emoji:"🎂";
}
.card--birthday_self .badge,
.card--birthday_digest_info .badge {
  background: rgba(99,102,241,.18);
  color: #4f46e5;
}

/* Festivos */
.card--holiday_notice{
  background: linear-gradient(180deg, rgba(251,146,60,.10), transparent 60%) #fff;
  border-color: rgba(251,146,60,.30);
  --callout-bg:#FFF3E8; --callout-text:#9A3412; --callout-border:#FDBA74; --callout-accent:#F97316; --callout-emoji:"🗓️";
}
.card--holiday_notice .badge { background:#fff7ed; color:#9a3412; }

/* Comunicados */
.card--announcement{
  background: linear-gradient(180deg, rgba(34,197,94,.10), transparent 60%) #fff;
  border-color: rgba(34,197,94,.30);
  --callout-bg:#ECFDF5; --callout-text:#065F46; --callout-border:#A7F3D0; --callout-accent:#10B981; --callout-emoji:"📢";
}
.card--announcement .badge{
  background: rgba(34,197,94,.18);
  color: #047857;
}

/* === Estado vacío === */
.card--empty { display:flex; align-items:center; justify-content:center; background: #f9fafb; }
.empty-state { text-align:center; color:#374151; }
.empty-icon { font-size: 2rem; margin-bottom: .5rem; opacity: 0.6; }
.empty-text h3 { font-weight: 700; font-size: 1.1rem; color:#111827; margin-bottom: .25rem; }
.empty-text p { font-size: .92rem; color:#6b7280; margin:0; }

/* Controles */
.controls { display:flex; align-items:center; justify-content:center; gap:10px; padding:10px 8px; }
.ctrl { background:#eef2f7; border:0; padding:6px 11px; border-radius:12px; cursor:pointer; box-shadow: 0 2px 6px rgba(0,0,0,.06); }
.dots { display:flex; gap:6px; }
.dot { width:8px; height:8px; border-radius:999px; border:0; background:#d1d5db; cursor:pointer; transition: all .2s ease; }
.dot.active { background:#6b7280; width:18px; border-radius:6px; }

/* Responsive */
@media (max-width: 640px){
  .card{ min-height: 150px; }
  .card--hero{ min-height: 300px; }
  .card__title{ font-size: 18px; }
  .card .card__body{ font-size: .95rem; }
  .card__image{ max-height: 240px; }
}

@media (min-width: 1024px){
  .card__image{ max-height: 380px; }
}
</style>
