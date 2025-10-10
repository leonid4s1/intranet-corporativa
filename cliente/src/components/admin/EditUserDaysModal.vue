<!-- cliente/src/components/admin/EditUserDaysModal.vue -->
<template>
  <div class="modal-overlay" @click.self="$emit('cancel')">
    <div class="modal">
      <div class="modal-header">
        <h3 class="modal-title">Aumentar bono de vacaciones</h3>
        <button class="close-btn" @click="$emit('cancel')" aria-label="Cerrar">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <form @submit.prevent="onSubmit" class="vacation-form">
        <!-- Resumen corto solo lectura -->
        <div class="summary">
          <div><span class="label">Derecho (LFT):</span> <strong>{{ lftRight }}</strong></div>
          <div><span class="label">Bono admin actual:</span> <strong>{{ adminBonus }}</strong></div>
          <div><span class="label">Total efectivo:</span> <strong>{{ effectiveTotal }}</strong></div>
          <div><span class="label">Usados:</span> <strong>{{ used }}</strong></div>
          <div><span class="label">Disponibles:</span> <strong>{{ remaining }}</strong></div>
        </div>

        <!-- ÚNICA ACCIÓN: Aumentar bono -->
        <div class="form-group highlight">
          <label class="form-label" for="bonusToAdd">Bono a agregar</label>
          <input
            id="bonusToAdd"
            type="number"
            step="1"
            min="0"
            inputmode="numeric"
            v-model.number="bonusToAdd"
            class="form-input editable"
            placeholder="0"
            required
          />
          <p class="hint">Sólo enteros ≥ 0. Este valor se <strong>suma</strong> al bono admin actual.</p>
          <p v-if="errorMsg" class="warning-message">
            <i class="fas fa-exclamation-circle"></i> {{ errorMsg }}
          </p>
        </div>

        <div class="modal-actions">
          <button type="button" class="btn cancel-btn" @click="$emit('cancel')">
            Cancelar
          </button>
          <button type="submit" class="btn submit-btn" :disabled="saving">
            {{ saving ? 'Guardando…' : 'Guardar cambios' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { User } from '@/types/user'

const props = defineProps<{ user: User }>()

const emit = defineEmits<{
  /** Emite el incremento a aplicar al bono admin (delta positivo). */
  (e: 'save', payload: { id: string; delta: number }): void
  (e: 'cancel'): void
}>()

const saving = ref(false)
const errorMsg = ref<string>('')

/** Input controlado para el bono a agregar (default 0). */
const bonusToAdd = ref<number>(0)

/* ============================
   Lectura segura de campos
   ============================ */
type UnknownRec = Record<string | number | symbol, unknown>

function pickNumberField(
  src: object | null | undefined,
  candidates: readonly string[],
): number | undefined {
  if (!src || typeof src !== 'object') return undefined
  const r = src as UnknownRec
  for (const k of candidates) {
    if (k in r) {
      const v = Number(r[k])
      if (Number.isFinite(v)) return v
    }
  }
  return undefined
}

/** Alias corto al objeto VacationDays del usuario */
const vd = computed(() => props.user.vacationDays)

/** admin puede venir como adminBonus o adminExtra; si no existe => 0 */
const admin = computed(() => pickNumberField(vd.value ?? null, ['adminBonus', 'adminExtra']) ?? 0)

/** total (efectivo) reportado en el objeto */
const total = computed(() => Number(vd.value?.total ?? 0))

/** lftRight: si no lo envía el backend, lo derivamos = total - admin */
const lftRight = computed(() => {
  const explicit = pickNumberField(vd.value ?? null, ['lftRight'])
  return explicit ?? Math.max(0, total.value - admin.value)
})

/** usados y remaining (con fallback si falta remaining) */
const used = computed(() => Number(vd.value?.used ?? 0))
const remaining = computed(() =>
  vd.value?.remaining != null
    ? Number(vd.value.remaining)
    : Math.max(0, total.value - used.value)
)

/** valores mostrados en el encabezado */
const adminBonus = computed(() => admin.value)
const effectiveTotal = computed(() => total.value)

watch(
  () => props.user,
  () => {
    // limpiar estado al abrir con otro usuario
    errorMsg.value = ''
    bonusToAdd.value = 0
  },
  { immediate: true }
)

function onSubmit() {
  errorMsg.value = ''

  // Validación: entero ≥ 0
  const n = Number(bonusToAdd.value)
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
    errorMsg.value = 'Ingresa un número entero mayor o igual a 0.'
    return
  }

  // Si es 0, no hacemos nada para evitar confusión
  if (n === 0) {
    emit('cancel')
    return
  }

  try {
    saving.value = true
    emit('save', { id: props.user.id, delta: n })
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex; justify-content: center; align-items: center;
  z-index: 1000; backdrop-filter: blur(2px);
}

.modal {
  background: white; border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  width: 100%; max-width: 520px; overflow: hidden;
  animation: modalFadeIn 0.3s ease;
}

@keyframes modalFadeIn {
  from { opacity: 0; transform: translateY(-20px); }
  to { opacity: 1; transform: translateY(0); }
}

.modal-header {
  padding: 1.1rem 1.25rem; background-color: #f8f9fa;
  border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;
}
.modal-title { margin: 0; color: #2c3e50; font-size: 1.15rem; font-weight: 600; }
.close-btn { background: none; border: none; color: #7f8c8d; font-size: 1.2rem; cursor: pointer; transition: color 0.2s; }
.close-btn:hover { color: #e74c3c; }

.vacation-form { padding: 1.1rem 1.25rem 1.25rem; }

.summary {
  display: grid; grid-template-columns: 1fr 1fr; gap: .5rem 1rem;
  background: #fafafa; border: 1px solid #eee; border-radius: 8px;
  padding: .75rem; margin-bottom: 1rem; font-size: .95rem;
}
.summary .label { color: #475569; }

.form-group { margin-bottom: 1.2rem; }
.form-group.highlight {
  background-color: #f5f9ff;
  padding: 1rem;
  border-radius: 8px;
  border-left: 4px solid #3498db;
}

.form-label { display: block; margin-bottom: 0.5rem; color: #34495e; font-weight: 500; }
.form-input {
  width: 100%; padding: 0.75rem; border: 1px solid #ddd;
  border-radius: 6px; font-size: 1rem; transition: border-color 0.2s;
}
.form-input:focus { outline: none; border-color: #3498db; box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2); }
.form-input.editable { border-color: #3498db; background-color: #fff; }
.form-input:invalid { border-color: #e74c3c; }
.form-input:valid { border-color: #2ecc71; }

.hint { margin-top: .35rem; color: #64748b; font-size: .9rem; }

.warning-message {
  margin-top: 0.5rem; color: #e67e22; font-size: 0.9rem;
}

.modal-actions {
  display: flex; justify-content: flex-end; gap: 1rem;
  margin-top: 1.25rem; padding-top: 1rem; border-top: 1px solid #eee;
}
.btn {
  padding: 0.75rem 1.5rem; border-radius: 6px; font-weight: 500;
  cursor: pointer; transition: all 0.2s; border: none; font-size: 0.95rem;
}
.cancel-btn { background-color: #f5f5f5; color: #7f8c8d; }
.cancel-btn:hover { background-color: #e0e0e0; }
.submit-btn { background-color: #3498db; color: white; }
.submit-btn:hover { background-color: #2980b9; }
</style>
