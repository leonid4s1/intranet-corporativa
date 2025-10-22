<template>
  <div
    class="news-carousel"
    role="region"
    aria-label="Noticias y comunicados"
    @mouseenter="stopAuto"
    @mouseleave="startAuto"
  >
    <div class="carousel-viewport" v-if="hasItems">
      <div class="track" :style="{ transform: `translateX(-${currentIndex * 100}%)` }">
        <article
          v-for="(n,i) in props.items"
          :key="i"
          class="card"
          :class="`card--${n.type}`"
          tabindex="0"
        >
          <header class="card__head">
            <h3 class="card__title">{{ n.title }}</h3>
            <span v-if="badge(n.type)" class="badge">{{ badge(n.type) }}</span>
          </header>
          <p class="card__body" v-if="n.body">{{ n.body }}</p>
        </article>
      </div>
    </div>

    <!-- Fallback cuando no hay items -->
    <div class="carousel-viewport" v-else>
      <div class="track">
        <article class="card">
          <header class="card__head">
            <h3 class="card__title">No hay comunicados por ahora</h3>
          </header>
          <p class="card__body">Vuelve más tarde para ver novedades.</p>
        </article>
      </div>
    </div>

    <div class="controls" v-if="props.items?.length > 1">
      <button class="ctrl" @click="prev" aria-label="Anterior">‹</button>
      <span class="dots" aria-hidden="true">
        <button
          v-for="(_,i) in props.items"
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
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import type { HomeItem } from '@/services/news.service';

const props = defineProps<{ items: HomeItem[] }>();

const currentIndex = ref(0);
let timer: number | undefined;

const hasItems = computed(() => (props.items?.length ?? 0) > 0);

function startAuto() {
  stopAuto();
  // sólo auto‐avanza si hay 2 o más
  if (props.items?.length && props.items.length > 1) {
    timer = window.setInterval(() => {
      next();
    }, 6500);
  }
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
  currentIndex.value =
    (currentIndex.value - 1 + props.items.length) % props.items.length;
}
function go(i: number) {
  if (!props.items?.length) return;
  currentIndex.value = i;
  startAuto();
}
function badge(t: HomeItem['type']) {
  if (t === 'holiday_notice') return 'Aviso';
  if (t === 'birthday_self') return '¡Feliz cumpleaños!';
  if (t === 'birthday_digest_info') return 'Cumpleaños hoy';
  return '';
}

onMounted(startAuto);
onUnmounted(stopAuto);
watch(
  () => props.items?.length,
  () => {
    currentIndex.value = 0;
    startAuto();
  }
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
.card { padding: 18px 22px; min-height: 120px; display:flex; flex-direction:column; gap:8px; outline: none; }
.card__head { display:flex; align-items:center; gap:8px; }
.card__title { margin:0; font-size: 18px; line-height: 1.3; }
.card__body { margin:0; color:#333; }
.badge {
  font-size: 12px; padding:2px 8px; border-radius: 999px;
  background: #eef2ff; color:#3730a3; margin-left:auto;
}
.card--holiday_notice .badge { background:#fff7ed; color:#9a3412; }
.card--birthday_self .badge { background:#ecfeff; color:#155e75; }
.card--birthday_digest_info .badge { background:#ecfeff; color:#0e7490; }

.controls { display:flex; align-items:center; justify-content:center; gap:8px; padding:8px; }
.ctrl {
  background:#f3f4f6; border:0; padding:6px 10px; border-radius:10px; cursor:pointer;
}
.dots { display:flex; gap:6px; }
.dot { width:8px; height:8px; border-radius:999px; border:0; background:#d1d5db; cursor:pointer; }
.dot.active { background:#6b7280; width:18px; border-radius:6px; }
</style>
