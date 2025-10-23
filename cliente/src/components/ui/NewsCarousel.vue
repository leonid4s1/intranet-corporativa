<!-- cliente/src/components/ui/NewsCarousel.vue -->
<template>
  <div class="news-carousel" role="region" aria-label="Noticias y comunicados">
    <div class="carousel-viewport">
      <div class="track" :style="{ transform: `translateX(-${currentIndex * 100}%)` }">
        <article
          v-for="(n,i) in items"
          :key="i"
          class="card"
          :class="`card--${n.type}`"
        >
          <header class="card__head">
            <h3 class="card__title">{{ n.title }}</h3>
            <span v-if="badge(n.type)" class="badge">{{ badge(n.type) }}</span>
          </header>
          <p class="card__body" v-if="bodyOf(n)">{{ bodyOf(n) }}</p>
        </article>
      </div>
    </div>

    <div class="controls">
      <button class="ctrl" @click="prev" aria-label="Anterior">‹</button>
      <span class="dots" aria-hidden="true">
        <button
          v-for="(n,i) in items"
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
import { ref, onMounted, onUnmounted, watch } from 'vue';
import type { NewsItem } from '@/services/news.service';

const props = defineProps<{ items: NewsItem[] }>();

const currentIndex = ref(0);
let timer: number | undefined;

// Usa body si existe; en su defecto, excerpt; si no, vacío
function bodyOf(n: NewsItem): string {
  const anyN = n as Record<string, unknown>;
  const body = typeof anyN['body'] === 'string' ? (anyN['body'] as string) : undefined;
  const excerpt = typeof anyN['excerpt'] === 'string' ? (anyN['excerpt'] as string) : undefined;
  return body ?? excerpt ?? '';
}

function startAuto() {
  stopAuto();
  timer = window.setInterval(() => { next(); }, 6500);
}
function stopAuto() {
  if (timer) window.clearInterval(timer);
  timer = undefined;
}
function next() {
  if (!props.items?.length) return;
  currentIndex.value = (currentIndex.value + 1) % props.items.length;
}
function prev() {
  if (!props.items?.length) return;
  currentIndex.value = (currentIndex.value - 1 + props.items.length) % props.items.length;
}
function go(i: number) {
  currentIndex.value = i;
  startAuto();
}
function badge(t: NewsItem['type']) {
  if (t === 'holiday_notice') return 'Aviso';
  if (t === 'birthday_self') return '¡Feliz cumpleaños!';
  if (t === 'birthday_digest_info') return 'Cumpleaños hoy';
  return '';
}

onMounted(startAuto);
onUnmounted(stopAuto);
watch(
  () => props.items?.length,
  () => { currentIndex.value = 0; startAuto(); }
);
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
.card { padding: 18px 22px; min-height: 120px; display:flex; flex-direction:column; gap:8px; }
.card__head { display:flex; align-items:center; gap:8px; }
.card__title { margin:0; font-size: 18px; line-height: 1.3; }
.card__body { margin:0; color:#333; }
.badge {
  font-size: 12px; padding:2px 8px; border-radius: 999px;
  background: #eef2ff; color:#3730a3; margin-left:auto;
}
.card--holiday_notice .badge { background:#fff7ed; color:#9a3412; }
.card--birthday_self .badge { background:#ecfeff; color:#155e75; }
.controls { display:flex; align-items:center; justify-content:center; gap:8px; padding:8px; }
.ctrl { background:#f3f4f6; border:0; padding:6px 10px; border-radius:10px; cursor:pointer; }
.dots { display:flex; gap:6px; }
.dot { width:8px; height:8px; border-radius:999px; border:0; background:#d1d5db; cursor:pointer; }
.dot.active { background:#6b7280; width:18px; border-radius:6px; }
</style>
