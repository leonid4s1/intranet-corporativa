<script setup lang="ts">
import { onMounted, ref, watch, computed } from 'vue';
import {
  getMyEntitlement,
  getUserEntitlementAdmin,
  type EntitlementResponse,
} from '@/services/vacation.service';

type State = 'idle' | 'loading' | 'ready' | 'error';

const props = defineProps<{
  /** Si se pasa, usa endpoint admin; si no, usa /my/entitlement */
  userId?: string;
  /** Modo compacto para encajar en barras sobre el calendario */
  compact?: boolean;
}>();

const state = ref<State>('idle');
const data = ref<EntitlementResponse | null>(null);
const errorMsg = ref<string>('');

/** Acceso directo a ciclo */
const entitlement = computed(() => data.value?.cycle);
const policy = computed(() => data.value?.cycle.policy ?? 'LFT MX 2023');

function n(v?: number) {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}
function fmtDate(s?: string) {
  return s ?? '';
}

async function load() {
  try {
    state.value = 'loading';
    data.value = props.userId
      ? await getUserEntitlementAdmin(props.userId)
      : await getMyEntitlement();
    state.value = 'ready';
    errorMsg.value = '';
  } catch (err: unknown) {
    state.value = 'error';
    if (err instanceof Error) {
      errorMsg.value = err.message;
    } else {
      errorMsg.value = 'No se pudo obtener el derecho vigente';
    }
  }
}

onMounted(load);
watch(() => props.userId, () => load());
</script>

<template>
  <!-- Card contenedor (híbrido: utilidades + tokens) -->
  <div
    class="rounded-2xl border border-brand bg-white"
    :class="compact ? 'py-3 px-4' : 'p-5 shadow-sm'"
  >
    <div class="flex items-center justify-between mb-2">
      <h3 class="text-brand-ink font-brand text-sm sm:text-base font-semibold">
        Vacaciones — Derecho vigente ({{ policy }})
      </h3>
      <button
        class="text-xs underline text-brand-ink/80 hover:text-brand-ink hover:outline hover:outline-2 hover:outline-brand/25 rounded px-1 py-0.5 disabled:opacity-50"
        @click="load"
        :disabled="state==='loading'"
      >
        Recargar
      </button>
    </div>

    <!-- Loading -->
    <div v-if="state==='loading'" class="text-xs text-gray-500">Cargando…</div>

    <!-- Error -->
    <div v-else-if="state==='error'" class="text-xs text-red-600">
      {{ errorMsg }}
    </div>

    <!-- Content -->
    <div v-else-if="state==='ready' && entitlement" class="space-y-3">
      <!-- KPIs (Derecho / Usados / Disponibles) -->
      <div
        class="grid"
        :class="compact ? 'grid-cols-3 gap-2' : 'grid-cols-3 gap-3'"
      >
        <div class="rounded-xl border border-brand bg-white p-3">
          <div class="text-[10px] uppercase tracking-wide text-gray-500">Derecho</div>
          <div :class="compact ? 'text-lg font-bold text-brand-ink' : 'text-2xl font-bold text-brand-ink'">
            {{ n(entitlement.entitlementDays) }}
          </div>
        </div>
        <div class="rounded-xl border border-brand bg-white p-3">
          <div class="text-[10px] uppercase tracking-wide text-gray-500">Usados</div>
          <div :class="compact ? 'text-lg font-bold text-brand-ink' : 'text-2xl font-bold text-brand-ink'">
            {{ n(entitlement.usedDays) }}
          </div>
        </div>
        <div class="rounded-xl border border-brand bg-white p-3">
          <div class="text-[10px] uppercase tracking-wide text-gray-500">Disponibles</div>
          <div :class="compact ? 'text-lg font-bold text-brand-ink' : 'text-2xl font-bold text-brand-ink'">
            {{ n(entitlement.remainingDays) }}
          </div>
        </div>
      </div>

      <!-- Ventana y próximos hitos -->
      <div
        class="rounded-xl border border-brand bg-brand-100 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
      >
        <div class="text-xs sm:text-sm text-brand-ink">
          Ventana: <b>{{ fmtDate(entitlement.window.start) }}</b>
          &nbsp;→&nbsp;
          <b>{{ fmtDate(entitlement.window.end) }}</b>
        </div>
        <div class="text-xs sm:text-sm inline-flex items-center gap-2">
          <span class="px-2 py-1 rounded-full border border-brand bg-white text-brand-ink">
            {{ n(entitlement.daysUntilWindowEnds) }} días restantes
          </span>
          <span class="text-brand-ink/80">
            Próximo aniversario: <b class="text-brand-ink">{{ entitlement.nextAnniversary }}</b>
          </span>
        </div>
      </div>
    </div>

    <!-- Empty -->
    <div v-else class="text-xs text-gray-500">Sin información disponible.</div>
  </div>
</template>
