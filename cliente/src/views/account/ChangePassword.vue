<template>
  <div class="cp-wrap">
    <div class="cp-card">
      <h1 class="cp-title">Cambiar contraseña</h1>

      <form @submit.prevent="onSubmit" novalidate>
        <!-- Actual -->
        <div class="cp-field">
          <label class="cp-label" for="current">Contraseña actual</label>
          <div class="cp-input-wrap">
            <input
              id="current"
              v-model.trim="form.currentPassword"
              :type="showCurrent ? 'text' : 'password'"
              class="cp-input"
              required
              autocomplete="current-password"
              :aria-invalid="!!errors.currentPassword"
            />
            <button
              type="button"
              class="cp-eye"
              :aria-label="showCurrent ? 'Ocultar contraseña' : 'Mostrar contraseña'"
              :title="showCurrent ? 'Ocultar contraseña' : 'Mostrar contraseña'"
              :aria-pressed="showCurrent ? 'true' : 'false'"
              @click="showCurrent = !showCurrent"
            >
              <!-- eye / eye-off -->
              <svg v-if="!showCurrent" xmlns="http://www.w3.org/2000/svg" width="18" height="18"
                   viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18"
                   viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7"/>
                <circle cx="12" cy="12" r="3"/>
                <line x1="4" y1="20" x2="20" y2="4"></line>
              </svg>
            </button>
          </div>
          <p v-if="errors.currentPassword" class="cp-error">{{ errors.currentPassword }}</p>
        </div>

        <!-- Nueva -->
        <div class="cp-field">
          <label class="cp-label" for="new">Nueva contraseña</label>
          <div class="cp-input-wrap">
            <input
              id="new"
              v-model.trim="form.newPassword"
              :type="showNew ? 'text' : 'password'"
              class="cp-input"
              required
              autocomplete="new-password"
              @input="calcStrength"
              :aria-invalid="!!errors.newPassword"
            />
            <button
              type="button"
              class="cp-eye"
              :aria-label="showNew ? 'Ocultar contraseña' : 'Mostrar contraseña'"
              :title="showNew ? 'Ocultar contraseña' : 'Mostrar contraseña'"
              :aria-pressed="showNew ? 'true' : 'false'"
              @click="showNew = !showNew"
            >
              <svg v-if="!showNew" xmlns="http://www.w3.org/2000/svg" width="18" height="18"
                   viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18"
                   viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7"/>
                <circle cx="12" cy="12" r="3"/>
                <line x1="4" y1="20" x2="20" y2="4"></line>
              </svg>
            </button>
          </div>

          <div class="cp-help">
            <span>Seguridad: <strong>{{ strengthLabel }}</strong></span>
          </div>
          <ul class="cp-rules">
            <li :class="{ ok: ruleLen }">Mínimo 8 caracteres</li>
            <li :class="{ ok: ruleUp }">Al menos 1 mayúscula</li>
            <li :class="{ ok: ruleLo }">Al menos 1 minúscula</li>
            <li :class="{ ok: ruleNu }">Al menos 1 número</li>
            <li :class="{ ok: ruleSp }">Al menos 1 carácter especial</li>
          </ul>
          <p v-if="errors.newPassword" class="cp-error">{{ errors.newPassword }}</p>
        </div>

        <!-- Confirmación -->
        <div class="cp-field">
          <label class="cp-label" for="confirm">Confirmar nueva contraseña</label>
          <div class="cp-input-wrap">
            <input
              id="confirm"
              v-model.trim="confirm"
              :type="showConfirm ? 'text' : 'password'"
              class="cp-input"
              required
              autocomplete="new-password"
              :aria-invalid="!!errors.confirm"
            />
            <button
              type="button"
              class="cp-eye"
              :aria-label="showConfirm ? 'Ocultar contraseña' : 'Mostrar contraseña'"
              :title="showConfirm ? 'Ocultar contraseña' : 'Mostrar contraseña'"
              :aria-pressed="showConfirm ? 'true' : 'false'"
              @click="showConfirm = !showConfirm"
            >
              <svg v-if="!showConfirm" xmlns="http://www.w3.org/2000/svg" width="18" height="18"
                   viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18"
                   viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7"/>
                <circle cx="12" cy="12" r="3"/>
                <line x1="4" y1="20" x2="20" y2="4"></line>
              </svg>
            </button>
          </div>
          <p v-if="confirm && confirm !== form.newPassword" class="cp-error">La confirmación no coincide</p>
          <p v-if="errors.confirm" class="cp-error">{{ errors.confirm }}</p>
        </div>

        <div class="cp-actions">
          <button class="cp-btn cp-btn--primary" :disabled="submitting || !canSubmit">
            {{ submitting ? 'Guardando…' : 'Guardar' }}
          </button>
          <RouterLink to="/home" class="cp-btn cp-btn--ghost">Cancelar</RouterLink>
        </div>

        <p v-if="msg" :class="msg.type === 'error' ? 'cp-msg cp-msg--err' : 'cp-msg cp-msg--ok'">
          {{ msg.text }}
        </p>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import AuthService from '@/services/auth.service'

type Msg = { type: 'ok' | 'error'; text: string }

const form = ref({ currentPassword: '', newPassword: '' })
const confirm = ref('')
const submitting = ref(false)
const msg = ref<Msg | null>(null)

const errors = ref<{ currentPassword?: string; newPassword?: string; confirm?: string }>({})

/* 👁️ toggles */
const showCurrent = ref(false)
const showNew = ref(false)
const showConfirm = ref(false)

const canSubmit = computed(() =>
  !!form.value.currentPassword &&
  !!form.value.newPassword &&
  confirm.value === form.value.newPassword &&
  validateLocal(false)
)

/* ========= Reglas y fuerza ========= */
const ruleLen = ref(false)
const ruleUp  = ref(false)
const ruleLo  = ref(false)
const ruleNu  = ref(false)
const ruleSp  = ref(false)
const strengthLabel = ref('Débil')

function calcStrength(): void {
  const v = form.value.newPassword || ''
  ruleLen.value = v.length >= 8
  ruleUp.value  = /[A-Z]/.test(v)
  ruleLo.value  = /[a-z]/.test(v)
  ruleNu.value  = /[0-9]/.test(v)
  ruleSp.value  = /[\W_]/.test(v)

  const score = [ruleLen.value, ruleUp.value, ruleLo.value, ruleNu.value, ruleSp.value].filter(Boolean).length
  strengthLabel.value = ['Débil', 'Básica', 'Media', 'Fuerte', 'Muy fuerte'][Math.max(0, score - 1)]
}

/* ========= Validación local ========= */
function validateLocal(markErrors = true): boolean {
  const e: typeof errors.value = {}
  if (!form.value.currentPassword) e.currentPassword = 'Ingresa tu contraseña actual'
  if (!form.value.newPassword) e.newPassword = 'Ingresa una nueva contraseña'
  else if (!ruleLen.value || !ruleUp.value || !ruleLo.value || !ruleNu.value || !ruleSp.value) {
    e.newPassword = 'Debe cumplir los requisitos indicados'
  }
  if (confirm.value !== form.value.newPassword) e.confirm = 'La confirmación no coincide'
  if (markErrors) errors.value = e
  return Object.keys(e).length === 0
}

/* ========= Util para mensajes de error tipados ========= */
function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  try {
    const maybe = err as { message?: unknown }
    if (maybe && typeof maybe.message === 'string') return maybe.message
  } catch { /* no-op */ }
  return 'Error al actualizar la contraseña'
}

/* ========= Submit ========= */
async function onSubmit(): Promise<void> {
  msg.value = null
  errors.value = {}
  if (!validateLocal(true)) return

  submitting.value = true
  try {
    const resp = await AuthService.changePassword({
      currentPassword: form.value.currentPassword,
      newPassword: form.value.newPassword
    })
    if (!resp.success) {
      msg.value = { type: 'error', text: resp.message || 'No se pudo actualizar la contraseña' }
      return
    }
    msg.value = { type: 'ok', text: 'Contraseña actualizada ✔' }
    form.value = { currentPassword: '', newPassword: '' }
    confirm.value = ''
    calcStrength()
    showCurrent.value = showNew.value = showConfirm.value = false
  } catch (err: unknown) {
    msg.value = { type: 'error', text: getErrorMessage(err) }
  } finally {
    submitting.value = false
  }
}

calcStrength()
</script>

<style scoped>
.cp-wrap{ display:grid; place-items:center; padding: 24px; }
.cp-card{
  width: 100%; max-width: 640px;
  background: #fff; border-radius: 16px;
  box-shadow: 0 10px 30px rgba(0,0,0,.06);
  padding: 20px 22px;
}
.cp-title{ font-size: 1.4rem; font-weight: 700; margin: 4px 0 14px; color:#111827; }

.cp-field{ margin-bottom: 14px; }
.cp-label{ display:block; font-weight: 600; margin-bottom: 6px; color:#374151; }

/* Asegura stacking y color consistente */
.cp-input-wrap { position: relative; isolation: isolate; }
.cp-input{
  width: 100%; border: 1px solid #E5E7EB; border-radius: 10px; padding: .6rem .75rem;
  font-size: .95rem; background: #fff; color:#111827;
  padding-right: 3rem; /* espacio extra para el botón */
  box-sizing: border-box;
}
.cp-input:focus{ outline: none; border-color:#4B5055; box-shadow: 0 0 0 3px rgba(75,80,85,.15); }

/* Oculta el ojo nativo de Edge/IE para no tapar el personalizado */
.cp-input::-ms-reveal,
.cp-input::-ms-clear { display: none; }

/* Botón ojo dentro del input */
.cp-eye{
  position: absolute;
  right: .5rem;
  top: 50%;
  transform: translateY(-50%);
  width: 34px; height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 0;
  background: #fff;
  border: 1px solid #E5E7EB;
  border-radius: 9999px;
  box-shadow: 0 2px 6px rgba(0,0,0,.06);
  color: #4B5563;         /* color base */
  z-index: 2;             /* por encima del input */
  cursor: pointer;
}

.cp-eye:hover{ background:#f9fafb; }
.cp-eye:focus-visible{ outline: 2px solid rgba(75,80,85,.4); outline-offset: 2px; }

/* Fuerza el color del trazo del ícono */
.cp-eye svg{
  width: 18px;
  height: 18px;
  display: block;
  stroke: #4B5563 !important;  /* color siempre visible */
  fill: none;                  /* por si algún reset pone fill */
}

/* (opcional) cambia el color al pasar el mouse */
.cp-eye:hover svg{ stroke: #1f2937 !important; }

.cp-help{ margin-top: 6px; color:#4B5563; font-size:.9rem; }
.cp-rules{ margin: 6px 0 0; padding-left: 18px; font-size: .85rem; color:#6B7280; }
.cp-rules li{ margin: 2px 0; }
.cp-rules li.ok{ color:#065f46; font-weight:600; }

.cp-error{ color:#B91C1C; font-size:.85rem; margin-top:6px; }

.cp-actions{ display:flex; gap:10px; align-items:center; margin-top: 18px; }
.cp-btn{
  border-radius: 10px; padding: .6rem 1rem; border: 1px solid transparent; cursor: pointer;
  font-weight: 600;
}
.cp-btn--primary{ background:#4B5055; color:#fff; }
.cp-btn--primary:disabled{ opacity:.6; cursor: not-allowed; }
.cp-btn--ghost{ background:transparent; color:#111827; border-color:#E5E7EB; text-decoration:none; }

.cp-msg{ margin-top: 14px; font-weight:600; }
.cp-msg--ok{ color:#065f46; }
.cp-msg--err{ color:#B91C1C; }
</style>
