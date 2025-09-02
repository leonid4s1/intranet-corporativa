<template>
  <!-- Cierra con ESC y clic en el fondo -->
  <div
    class="dlg-backdrop"
    @keydown.esc.prevent.stop="emitCancel"
    @click.self="emitCancel"
    tabindex="0"
  >
    <div class="dlg" role="dialog" aria-modal="true" aria-labelledby="vac-dialog-title">
      <!-- Header -->
      <header class="dlg-header">
        <div class="dlg-header__icon" aria-hidden="true">
          <!-- Calendario (SVG simple) -->
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a2 2 0 0 1 2 2v3H2V6a2 2 0 0 1 2-2h1V3a1 1 0 1 1 2 0v1zm15 7v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9h20zM6 13h4v4H6v-4zm6 0h4v4h-4v-4z"/>
          </svg>
        </div>
        <div class="dlg-header__text">
          <h3 id="vac-dialog-title">Confirmar solicitud de vacaciones</h3>
          <p class="dlg-subtitle">
            {{ formatDate(startDate) }} &mdash; {{ formatDate(endDate) }}
          </p>
        </div>
        <button class="icon-btn" @click="emitCancel" aria-label="Cerrar">✕</button>
      </header>

      <!-- Cuerpo -->
      <section class="dlg-body">
        <!-- Resumen -->
        <div class="summary">
          <div class="summary-item">
            <span class="summary-label">Días hábiles</span>
            <span class="summary-value">{{ businessDays }}</span>
          </div>
          <div
            class="summary-item"
            :class="{ warn: remainingDays < 0 }"
            :title="remainingDays < 0 ? 'Excedes tu balance disponible' : ''"
          >
            <span class="summary-label">Días restantes</span>
            <span class="summary-value">
              {{ remainingDays >= 0 ? remainingDays : 0 }}
            </span>
          </div>
        </div>

        <!-- Avisos / Reglas -->
        <div v-if="remainingDays < 0" class="alert alert--error">
          <strong>Atención:</strong> el rango selecciona más días de los que te quedan.
          Puedes continuar y el sistema lo rechazará, o ajusta tu selección.
        </div>

        <!-- Motivo -->
        <label class="field">
          <span class="field-label">Motivo (opcional)</span>
          <textarea
            v-model="reason"
            rows="4"
            maxlength="200"
            placeholder="Ej. Viaje familiar"
            @keydown.stop
          />
          <div class="field-help">
            <span>Sugerencia: brinda contexto breve.</span>
            <span class="counter">{{ reason.length }}/200</span>
          </div>
        </label>

        <!-- Checklist/Notas -->
        <ul class="notes">
          <li>Revisa que tus fechas no incluyan fines de semana o festivos si no deseas contar esos días.</li>
          <li>Podrás cancelar hasta <strong>un día antes</strong> del inicio.</li>
        </ul>
      </section>

      <!-- Footer -->
      <footer class="dlg-footer">
        <button class="btn btn-ghost" @click="emitCancel">Cancelar</button>
        <button
          class="btn btn-primary"
          :disabled="businessDays <= 0"
          @click="onConfirm"
        >
          Confirmar solicitud
        </button>
      </footer>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import dayjs from 'dayjs'

const props = defineProps<{
  startDate: string
  endDate: string
  businessDays: number
  remainingDays: number
}>()

const emit = defineEmits<{
  (e: 'confirm', reason: string): void
  (e: 'cancel'): void
}>()

const reason = ref<string>('')

function formatDate(iso: string) {
  return dayjs(iso).format('DD/MM/YYYY')
}

function onConfirm() {
  emit('confirm', reason.value.trim())
}

function emitCancel() {
  emit('cancel')
}
</script>

<style scoped>
/* --- Backdrop --- */
.dlg-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, .45);
  backdrop-filter: blur(2px);
  display: grid;
  place-items: center;
  z-index: 1000;
  animation: fadeIn .12s ease-out;
}
@keyframes fadeIn {
  from { opacity: 0 } to { opacity: 1 }
}

/* --- Dialog --- */
.dlg {
  width: 640px;
  max-width: calc(100vw - 28px);
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 18px 50px rgba(2, 6, 23, .18);
  overflow: hidden;
  transform: translateY(4px);
  animation: slideUp .16s ease-out;
}
@keyframes slideUp {
  from { transform: translateY(10px) }
  to   { transform: translateY(0) }
}

/* --- Header --- */
.dlg-header {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid #eef1f5;
  background:
    linear-gradient(180deg, rgba(99,102,241,.08), transparent 60%) #fff;
}
.dlg-header__icon {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  color: #4f46e5;
  background: #eef2ff;
  border: 1px solid #e7e9ff;
}
.dlg-header__text h3 {
  margin: 0 0 2px;
  font-size: 18px;
  font-weight: 800;
  color: #1f2937;
}
.dlg-subtitle {
  margin: 0;
  color: #6b7280;
  font-size: 13px;
}
.icon-btn {
  background: transparent;
  border: none;
  border-radius: 8px;
  width: 32px; height: 32px;
  cursor: pointer;
  color: #6b7280;
}
.icon-btn:hover { background: #f3f4f6; color: #111827; }

/* --- Body --- */
.dlg-body {
  padding: 16px;
  display: grid;
  gap: 14px;
}

/* Resumen */
.summary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.summary-item {
  border: 1px solid #eef1f5;
  background: #fcfcfd;
  border-radius: 12px;
  padding: 12px;
}
.summary-item.warn {
  background: #fff7f7;
  border-color: #ffe2e2;
}
.summary-label {
  display: block;
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 6px;
}
.summary-value {
  font-size: 22px;
  font-weight: 800;
  color: #111827;
}

/* Alertas */
.alert {
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 14px;
}
.alert--error {
  background: #fff1f2;
  color: #991b1b;
  border: 1px solid #fecdd3;
}

/* Campo motivo */
.field {
  display: grid;
  gap: 8px;
}
.field-label {
  font-weight: 600;
  color: #374151;
}
textarea {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 10px 12px;
  resize: vertical;
  min-height: 92px;
  font-family: inherit;
}
textarea:focus {
  outline: none;
  border-color: #c7d2fe;
  box-shadow: 0 0 0 3px rgba(99,102,241,.15);
}
.field-help {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #6b7280;
  font-size: 12px;
}
.counter { color: #4b5563; }

/* Notas */
.notes {
  margin: 2px 0 0 18px;
  color: #6b7280;
  font-size: 13px;
}
.notes li { margin-bottom: 6px; }

/* --- Footer --- */
.dlg-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 16px 16px;
  border-top: 1px solid #eef1f5;
}
.btn {
  border-radius: 10px;
  padding: 8px 14px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid #e5e7eb;
  background: #fff;
}
.btn:hover { background: #f6f8fb; }
.btn:disabled { opacity: .6; cursor: not-allowed; }
.btn-ghost {
  background: #fff;
}
.btn-primary {
  color: #fff;
  border-color: #6366f1;
  background: linear-gradient(180deg, #6366f1, #4f46e5);
  box-shadow: 0 6px 18px rgba(79,70,229,.25);
}
.btn-primary:hover {
  filter: brightness(1.03);
}
@media (max-width: 520px) {
  .summary { grid-template-columns: 1fr; }
}
</style>
