<!-- cliente/src/views/admin/UserManagement.vue -->
<template>
  <div class="user-management-container">
    <!-- Toasts -->
    <div class="toast-container" role="status" aria-live="polite">
      <div
        v-for="t in toasts"
        :key="t.id"
        class="toast"
        :class="`toast--${t.type}`"
      >
        <span class="toast-dot" aria-hidden="true"></span>
        <span class="toast-text">{{ t.text }}</span>
      </div>
    </div>

    <div class="header">
      <h2 class="title">Gestión de Usuarios</h2>

      <div class="header-actions">
        <button class="create-btn" @click="openCreateModal">
          <svg class="icon" viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          Crear usuario
        </button>
        <div v-if="loading" class="loading-indicator">Cargando usuarios...</div>
      </div>
    </div>

    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <div class="table-container">
      <table v-if="users.length" class="user-table">
        <thead>
          <tr>
            <th class="name-column">Nombre</th>
            <th class="email-column">Email</th>
            <th class="role-column">Rol</th>
            <th>Puesto</th>
            <th>Ingreso</th>
            <th>Nacimiento</th>
            <th class="vac-col text-right">Usados</th>
            <th class="vac-col text-right">Totales</th>
            <th class="vac-col text-right">Disp.</th>
            <th class="window-column">Ventana</th>
            <th class="actions-column">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in users" :key="u.id" class="user-row">
            <td class="name-cell">
              <div class="user-info">
                <span class="user-name">{{ u.name }}</span>
                <span class="user-status" :class="{ active: u.isActive, inactive: !u.isActive }">
                  {{ u.isActive ? 'Activo' : 'Inactivo' }}
                </span>
                <span v-if="u.email_verified_at" class="verified-badge">Verificado</span>
              </div>
            </td>
            <td class="email-cell">{{ u.email }}</td>
            <td class="role-cell">
              <span class="role-badge" :class="u.role">
                {{ u.role === 'admin' ? 'Administrador' : 'Usuario' }}
              </span>
            </td>

            <td>{{ u.position || '—' }}</td>
            <td>{{ dateOnly(u.hireDate) || '—' }}</td>
            <td>{{ dateOnly(u.birthDate) || '—' }}</td>

            <!-- Vacaciones (totales ya incluyen bono admin) -->
            <td class="p-1 text-right">{{ used(u) }}</td>
            <td class="p-1 text-right font-medium">{{ total(u) }}</td>
            <td class="p-1 text-right">
              <span
                class="px-2 py-1 rounded text-xs"
                :class="remaining(u) > 0 ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-700'"
              >
                {{ remaining(u) }}
              </span>
            </td>

            <!-- Botón que abre el modal "Saldo por ventanas" -->
            <td class="window-cell">
              <button class="win-btn" @click="openWindowsModal(u)">
                Ver saldo
              </button>
            </td>

            <td class="actions-cell">
              <button class="edit-btn" @click="openEditModal(u)" title="Editar">
                <svg class="icon" viewBox="0 0 24 24">
                  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                </svg>
              </button>
              <button class="vac-btn" @click="openVacationModal(u)" title="Derecho LFT + Bono admin">
                <svg class="icon" viewBox="0 0 24 24">
                  <path d="M12 7a5 5 0 00-5 5v5h10v-5a5 5 0 00-5-5zm0-5a3 3 0 013 3h-6a3 3 0 013-3z"/>
                </svg>
              </button>
              <button class="delete-btn" @click="confirmDelete(u.id)" title="Eliminar">
                <svg class="icon" viewBox="0 0 24 24">
                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                </svg>
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-else class="empty-state">No se encontraron usuarios</div>
    </div>

    <!-- Create User Modal -->
    <div v-if="showCreateModal" class="modal-overlay" @click.self="closeCreateModal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Crear nuevo usuario</h3>
          <button class="close-btn" @click="closeCreateModal" title="Cerrar">
            <svg viewBox="0 0 24 24"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </div>

        <form class="modal-body" @submit.prevent="handleCreateUser">
          <div class="form-group">
            <label>Nombre completo</label>
            <input
              type="text"
              v-model.trim="createForm.name"
              :class="{ 'input-error': createErrors.name }"
              placeholder="Ej. Juan Pérez"
              autocomplete="name"
            />
            <small v-if="createErrors.name" class="error-text">{{ createErrors.name }}</small>
          </div>

          <div class="form-group">
            <label>Correo electrónico</label>
            <input
              type="email"
              v-model.trim="createForm.email"
              :class="{ 'input-error': createErrors.email }"
              placeholder="correo@empresa.com"
              autocomplete="email"
            />
            <small v-if="createErrors.email" class="error-text">{{ createErrors.email }}</small>
          </div>

          <!-- Contraseña (con ojito, medidor y reglas) -->
          <div class="form-group">
            <label>Contraseña</label>

            <div class="cp-input-wrap">
              <input
                :type="showPwd ? 'text' : 'password'"
                v-model="createForm.password"
                :class="{ 'input-error': createErrors.password }"
                placeholder="Mínimo 8 caracteres con mayúscula, número y símbolo"
                autocomplete="new-password"
                @input="touchedPwd = true"
                aria-describedby="pwd-help"
              />
              <button
                type="button"
                class="cp-eye"
                :aria-label="showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                @click="showPwd = !showPwd"
              >
                <EyeIcon />
              </button>
            </div>

            <!-- Medidor de fuerza -->
            <PasswordStrengthMeter :password="createForm.password" class="mt-2" />

            <!-- Reglas en vivo -->
            <ul class="pwd-rules" id="pwd-help" aria-live="polite">
              <li :class="{ ok: pwdRules.min }">Mínimo 8 caracteres</li>
              <li :class="{ ok: pwdRules.upper }">Al menos 1 mayúscula (A–Z)</li>
              <li :class="{ ok: pwdRules.lower }">Al menos 1 minúscula (a–z)</li>
              <li :class="{ ok: pwdRules.digit }">Al menos 1 número (0–9)</li>
              <li :class="{ ok: pwdRules.special }">Al menos 1 símbolo (!@#$…)</li>
              <li :class="{ ok: pwdRules.nospace }">Sin espacios</li>
            </ul>

            <small v-if="createErrors.password" class="error-text">{{ createErrors.password }}</small>
          </div>

          <!-- Confirmar contraseña (con ojito) -->
          <div class="form-group">
            <label>Confirmar contraseña</label>

            <div class="cp-input-wrap">
              <input
              :type="showConfirm ? 'text' : 'password'"
              v-model="createForm.password_confirmation"
              :class="{ 'input-error': createErrors.password_confirmation || (touchedConfirm && !passwordsMatch) }"
              placeholder="Repite la contraseña"
              autocomplete="new-password"
              @input="touchedConfirm = true"
            />
              <button
                type="button"
                class="cp-eye"
                :aria-label="showConfirm ? 'Ocultar confirmación' : 'Mostrar confirmación'"
                @click="showConfirm = !showConfirm"
              >
                <EyeIcon />
              </button>
            </div>

            <small v-if="touchedConfirm && !passwordsMatch" class="error-text">Las contraseñas no coinciden</small>
            <small v-else-if="createErrors.password_confirmation" class="error-text">{{ createErrors.password_confirmation }}</small>
          </div>

          <div class="form-group">
            <label>Rol</label>
            <select v-model="createForm.role">
              <option value="user">Usuario</option>
              <option value="admin">Administrador</option>
            </select>
          </div>

          <!-- NUEVOS CAMPOS -->
          <div class="form-group">
            <label>Puesto</label>
            <input
              type="text"
              v-model.trim="createForm.position"
              :class="{ 'input-error': createErrors.position }"
              placeholder="Ej. Auxiliar administrativo"
            />
            <small v-if="createErrors.position" class="error-text">{{ createErrors.position }}</small>
          </div>

          <div class="form-group">
            <label>Fecha de ingreso</label>
            <input
              type="date"
              v-model="createForm.hireDate"
              :class="{ 'input-error': createErrors.hireDate }"
            />
            <small v-if="createErrors.hireDate" class="error-text">{{ createErrors.hireDate }}</small>
          </div>

          <div class="form-group">
            <label>Fecha de nacimiento</label>
            <input
              type="date"
              v-model="createForm.birthDate"
              :class="{ 'input-error': createErrors.birthDate }"
            />
            <small v-if="createErrors.birthDate" class="error-text">{{ createErrors.birthDate }}</small>
          </div>

          <div class="modal-footer">
            <button type="button" class="cancel-btn" @click="closeCreateModal">Cancelar</button>
            <button
              class="save-btn"
              type="submit"
              :disabled="creating || !isCreateValid"
              :aria-disabled="creating || !isCreateValid"
              :title="!isCreateValid ? 'Completa los campos correctamente' : 'Crear usuario'"
            >
              {{ creating ? 'Creando…' : 'Crear usuario' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Edit User Modal -->
    <div v-if="showEditModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Editar Usuario: {{ selectedUser?.name }}</h3>
          <button class="close-btn" @click="closeModal" title="Cerrar">
            <svg viewBox="0 0 24 24"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </div>

        <div class="modal-body">
          <div class="form-group">
            <label>Nombre:</label>
            <input
              type="text"
              :value="selectedUser?.name || ''"
              @input="e => updateSelectedUser('name', (e.target as HTMLInputElement).value)"
            />
          </div>

          <div class="form-group">
            <label>Email:</label>
            <input type="email" :value="selectedUser?.email || ''" disabled />
          </div>

          <div class="form-group">
            <label>Rol:</label>
            <select
              :value="selectedUser?.role"
              @change="e => updateSelectedUser('role', (e.target as HTMLSelectElement).value as Role)"
            >
              <option value="user">Usuario</option>
              <option value="admin">Administrador</option>
            </select>
          </div>

          <div class="form-group">
            <label>Estado:</label>
            <select
              :value="selectedUser?.isActive"
              @change="e => updateSelectedUser('isActive', (e.target as HTMLSelectElement).value === 'true')"
            >
              <option :value="true">Activo</option>
              <option :value="false">Inactivo</option>
            </select>
          </div>

          <!-- META EDITABLE -->
          <div class="form-group">
            <label>Puesto</label>
            <input
              type="text"
              :value="selectedUserMeta.position"
              @input="e => selectedUserMeta.position = (e.target as HTMLInputElement).value"
            />
          </div>

          <div class="form-group">
            <label>Fecha de ingreso</label>
            <input
              type="date"
              :value="selectedUserMeta.hireDate"
              @input="e => selectedUserMeta.hireDate = (e.target as HTMLInputElement).value"
            />
          </div>

          <div class="form-group">
            <label>Fecha de nacimiento</label>
            <input
              type="date"
              :value="selectedUserMeta.birthDate"
              @input="e => selectedUserMeta.birthDate = (e.target as HTMLInputElement).value"
            />
          </div>

          <div class="form-group">
            <label>Nueva Contraseña</label>
            <input v-model="newPassword" type="password" placeholder="Deja en blanco para mantener la actual" />
          </div>

          <div v-if="metaErrorsText" class="modal-error">{{ metaErrorsText }}</div>
        </div>

        <div class="modal-footer">
          <button class="cancel-btn" @click="closeModal">Cancelar</button>
          <button class="save-btn" @click="updateUser">Guardar</button>
        </div>

        <div v-if="modalError" class="modal-error">{{ modalError }}</div>
      </div>
    </div>

    <!-- Modal Vacaciones (LFT + Bono admin) -->
    <div v-if="showVacModal" class="modal-overlay" @click.self="closeVacModal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Vacaciones: {{ vacForm.name }}</h3>
          <button class="close-btn" @click="closeVacModal" title="Cerrar">
            <svg viewBox="0 0 24 24"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </div>

        <div class="modal-body">
          <!-- Resumen LFT -->
          <div class="grid-2">
            <div class="stat">
              <span class="label">Derecho (LFT)</span>
              <span class="value">{{ vacForm.lftTotal }}</span>
            </div>
            <div class="stat">
              <span class="label">Bono admin</span>
              <span class="value">{{ vacForm.bonus }}</span>
            </div>

            <div class="stat">
              <span class="label">Total efectivo</span>
              <span class="value">{{ vacForm.effectiveTotal }}</span>
            </div>
            <div class="stat">
              <span class="label">Usados</span>
              <span class="value">{{ vacForm.used }}</span>
            </div>

            <div class="stat full">
              <span class="label">Disponibles</span>
              <span class="value">{{ Math.max(0, vacForm.effectiveTotal - vacForm.used) }}</span>
            </div>
          </div>

          <!-- Ventana LFT -->
          <div class="modal-info" v-if="vacForm.windowStart && vacForm.windowEnd">
            Ventana LFT vigente:
            <strong>{{ vacForm.windowStart }}</strong> → <strong>{{ vacForm.windowEnd }}</strong>
          </div>

          <!-- ÚNICA ACCIÓN: Aumentar bono admin -->
          <div class="form-group">
            <label>Bono a agregar</label>
            <div class="bonus-row">
              <input
                type="number"
                class="bonus-input"
                v-model.number="bonusToAdd"
                step="1"
                min="0"
                placeholder="0"
                @keyup.enter.stop.prevent="saveBonusIncrease"
              />
              <small class="text-warn" style="margin-left:.25rem;">
                Este valor se <strong>suma</strong> al bono admin actual.
              </small>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="cancel-btn" @click="closeVacModal">Cerrar</button>
          <button
            class="save-btn"
            :disabled="savingVac || !isValidBonusToAdd"
            @click.stop.prevent="saveBonusIncrease"
            title="Aumentar bono admin"
          >
            {{ savingVac ? 'Guardando…' : 'Guardar' }}
          </button>
        </div>

        <div v-if="vacError" class="modal-error">{{ vacError }}</div>
      </div>
    </div>

    <!-- Modal: Saldo por ventanas -->
    <div v-if="showWindowsModal" class="modal-overlay" @click.self="closeWindowsModal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Saldo por ventanas</h3>
          <button class="close-btn" @click="closeWindowsModal" title="Cerrar">
            <svg viewBox="0 0 24 24"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </div>

        <div class="modal-body">
          <div style="margin-bottom:.5rem;">
            <strong>Usuario:</strong>
            {{ winModal.userName }}
            <span v-if="winModal.userEmail"> — {{ winModal.userEmail }}</span>
          </div>

          <div v-if="winModal.loading" class="muted">Cargando ventanas…</div>
          <div v-else-if="winModal.error" class="modal-error">{{ winModal.error }}</div>

          <template v-else-if="winModal.summary">
            <div class="table-container" style="box-shadow:none;">
              <table class="user-table">
                <thead>
                  <tr>
                    <th>Ventana</th>
                    <th>Rango</th>
                    <th>Expira</th>
                    <th class="text-right">Días</th>
                    <th class="text-right">Usados</th>
                    <th class="text-right">Restantes</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="w in winModal.summary.windows" :key="w.label + '-' + w.year">
                    <td>
                      <span class="badge" :class="w.label === 'current' ? 'badge-gold' : 'badge-blue'">
                        {{ w.label === 'current' ? 'Año en curso' : 'Siguiente año' }}
                      </span>
                      <div class="subtle">Año: {{ w.year }}</div>
                    </td>
                    <td>{{ formatISO(w.start) }} — {{ formatISO(w.end) }}</td>
                    <td>{{ formatISO(w.expiresAt) }}</td>
                    <td class="text-right">{{ w.days }}</td>
                    <td class="text-right">{{ w.used }}</td>
                    <td class="text-right"><strong>{{ remainingOf(w) }}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="modal-info" style="display:flex;align-items:center;justify-content:space-between;">
              <div>Bono admin: <strong>{{ winModal.summary.bonusAdmin }}</strong></div>
              <div class="pill total-pill">Disponible total: {{ winModal.summary.available }}</div>
            </div>

            <small class="text-warn" style="display:block;margin-top:.5rem;">
              * Los días no gozados de la primera ventana expiran a los 18 meses (se eliminan de disponibles).
            </small>
          </template>
        </div>

        <div class="modal-footer">
          <button class="cancel-btn" @click="closeWindowsModal">Cerrar</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import dayjs from 'dayjs'
import api from '@/services/api'
import userService from '@/services/user.service'
import vacationService, { type WindowsSummary, type VacationWindow, VacationService as VacSvcNS } from '@/services/vacation.service'
import type { User as BaseUser, Role, VacationDays } from '@/services/user.service'
import PasswordStrengthMeter from '@/components/auth/PasswordStrengthMeter.vue'
import EyeIcon from '@/components/icons/EyeIcon.vue'

/** Usuario con meta extendida para esta vista */
type AdminUser = BaseUser & {
  position?: string
  hireDate?: string | null
  birthDate?: string | null
  // campos enriquecidos para la tabla
  total?: number
  available?: number
  used?: number
}
type RowUser = AdminUser & { total?: number; used?: number; available?: number }

/** Payloads locales */
type UpdateMetaPayload = {
  position?: string
  hireDate?: string
  birthDate?: string
}

/** Tipos derivados de los servicios para evitar casts inseguros */
type CreateUserParam = Parameters<typeof userService.createUserAsAdmin>[0]
type CreateUserReturn = Awaited<ReturnType<typeof userService.createUserAsAdmin>>
type UpdateMetaParam = Parameters<typeof userService.updateUserMeta>[1]

type VacationDaysExtended = VacationDays & {
  adminExtra?: number
  adminBonus?: number
  bonusAdmin?: number
}

/** Estado del formulario de vacaciones (modal) */
type VacFormState = {
  id: string
  name: string
  email: string
  used: number
  currentTotal: number
  lftTotal: number
  windowStart: string
  windowEnd: string
  bonus: number
  effectiveTotal: number
}

/* ===== Estado ===== */
const users = ref<RowUser[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

/* ===== Utils ===== */
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const strongPassRe = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/
const isoDayRe = /^\d{4}-\d{2}-\d{2}$/

const showPwd = ref(false)
const showConfirm = ref(false)
const touchedPwd = ref(false)
const touchedConfirm = ref(false)

const pwdRules = computed(() => {
  const p = createForm.value.password ?? ''
  return {
    min: p.length >= 8,
    upper: /[A-Z]/.test(p),
    lower: /[a-z]/.test(p),
    digit: /\d/.test(p),
    special: /[^A-Za-z0-9\s]/.test(p),
    nospace: !/\s/.test(p),
  }
})
const rulesPassed = computed(() => Object.values(pwdRules.value).filter(Boolean).length)
const rulesAllOk = computed(() => rulesPassed.value === 6)
const passwordsMatch = computed(() => createForm.value.password === createForm.value.password_confirmation)

function dateOnly(v?: string | null): string | null {
  if (!v) return null
  if (isoDayRe.test(v)) return v
  return v.length >= 10 ? v.slice(0, 10) : v
}
function isFuture(d: string) {
  if (!isoDayRe.test(d)) return false
  const t = new Date().setUTCHours(0,0,0,0)
  return new Date(d).setUTCHours(0,0,0,0) > t
}
function yearsBetween(a: string, b: string) {
  const A = new Date(a).getTime()
  const B = new Date(b).getTime()
  return (B - A) / (365.25*24*60*60*1000)
}
function formatISO(iso: string | Date | undefined): string {
  if (!iso) return ''
  const s = typeof iso === 'string' ? iso : iso.toString()
  return dayjs(s).format('DD/MM/YYYY')
}

/* ===== Toasts ===== */
type ToastType = 'success' | 'error' | 'info' | 'warn'
interface Toast { id: number; type: ToastType; text: string }
const toasts = ref<Toast[]>([])
let toastSeed = 0
function pushToast(text: string, type: ToastType = 'info', timeout = 3500) {
  const id = ++toastSeed
  toasts.value.push({ id, type, text })
  window.setTimeout(() => {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }, timeout)
}

/* ===== Crear usuario ===== */
const showCreateModal = ref(false)
const creating = ref(false)

const createForm = ref({
  name: '',
  email: '',
  password: '',
  password_confirmation: '',
  role: 'user' as Role,
  position: '',
  hireDate: '',     // YYYY-MM-DD
  birthDate: ''     // YYYY-MM-DD
})
const createErrors = ref<Record<string, string>>({
  name: '',
  email: '',
  password: '',
  password_confirmation: '',
  position: '',
  hireDate: '',
  birthDate: ''
})

const isCreateValid = computed(() => {
  const f = createForm.value
  const nameOk = f.name.trim().length >= 3
  const emailOk = emailRe.test(f.email.trim())
  const passOk = rulesAllOk.value
  const confirmOk = passwordsMatch.value

  // Fechas opcionales (tu misma lógica)
  let datesOk = true
  if (f.hireDate && (!isoDayRe.test(f.hireDate) || isFuture(f.hireDate))) datesOk = false
  if (f.birthDate && (!isoDayRe.test(f.birthDate) || isFuture(f.birthDate))) datesOk = false
  if (datesOk && f.hireDate && f.birthDate) {
    if (yearsBetween(f.birthDate, f.hireDate) < 14) datesOk = false
  }
  return nameOk && emailOk && passOk && confirmOk && datesOk
})

function resetCreateForm() {
  createForm.value = {
    name: '', email: '', password: '', password_confirmation: '',
    role: 'user', position: '', hireDate: '', birthDate: ''
  }
  createErrors.value = { name:'', email:'', password:'', password_confirmation:'', position:'', hireDate:'', birthDate:'' }
}

function validateCreate(): boolean {
  const f = createForm.value
  const e = createErrors.value
  e.name = !f.name.trim() ? 'El nombre es requerido' : f.name.trim().length < 3 ? 'Mínimo 3 caracteres' : ''
  e.email = !f.email.trim() ? 'El email es requerido' : !emailRe.test(f.email.trim()) ? 'Email inválido' : ''
  e.password = !f.password ? 'La contraseña es requerida'
              : !strongPassRe.test(f.password) ? 'Debe incluir mayúscula, número y símbolo (min. 8)' : ''
  e.password_confirmation = !f.password_confirmation ? 'Confirma la contraseña'
                          : f.password_confirmation !== f.password ? 'Las contraseñas no coinciden' : ''

  e.position = '' // opcional

  e.hireDate = ''
  if (f.hireDate) {
    if (!isoDayRe.test(f.hireDate)) e.hireDate = 'Formato inválido (YYYY-MM-DD)'
    else if (isFuture(f.hireDate)) e.hireDate = 'No puede ser futura'
  }

  e.birthDate = ''
  if (f.birthDate) {
    if (!isoDayRe.test(f.birthDate)) e.birthDate = 'Formato inválido (YYYY-MM-DD)'
    else if (isFuture(f.birthDate)) e.birthDate = 'No puede ser futura'
  }

  if (!e.hireDate && !e.birthDate && f.hireDate && f.birthDate) {
    if (yearsBetween(f.birthDate, f.hireDate) < 14) {
      e.hireDate = 'Ingreso inconsistente (≥ 14 años desde nacimiento)'
    }
  }
  return !Object.values(e).some(Boolean)
}

/* --- helper para detectar timeouts de Axios --- */
function looksLikeTimeout(err: unknown) {
  const e = err as { code?: string; message?: string }
  return e?.code === 'ECONNABORTED' || /timeout/i.test(e?.message || '')
}

async function handleCreateUser() {
  if (creating.value) return
  if (!validateCreate()) {
    pushToast('Revisa los campos del formulario', 'warn')
    return
  }

  creating.value = true
  try {
    const payload: CreateUserParam = {
      name: createForm.value.name.trim(),
      email: createForm.value.email.trim().toLowerCase(),
      password: createForm.value.password,
      password_confirmation: createForm.value.password_confirmation,
      role: createForm.value.role,
      ...(createForm.value.position.trim() && { position: createForm.value.position.trim() }),
      ...(createForm.value.hireDate && { hireDate: createForm.value.hireDate }),
      ...(createForm.value.birthDate && { birthDate: createForm.value.birthDate }),
    }

    const { user, requiresEmailVerification }: CreateUserReturn =
      await userService.createUserAsAdmin(payload)

    await fetchUsers()
    pushToast(
      requiresEmailVerification
        ? `Usuario creado: ${user.name}. Se envió correo de verificación a ${user.email}.`
        : `Usuario creado: ${user.name}.`,
      'success'
    )
    closeCreateModal()
  } catch (err: unknown) {
    if (looksLikeTimeout(err)) {
      await fetchUsers()
      closeCreateModal()
      pushToast('Usuario creado, pero el servidor tardó más de lo esperado. Refrescamos la lista.', 'info')
      console.warn('[createUser][timeout] Refrescado de lista tras timeout', err)
      return
    }
    const msg = err instanceof Error ? err.message : 'No se pudo crear el usuario'
    pushToast(msg, 'error')
    console.error('[createUser] ERROR', err)
  } finally {
    creating.value = false
  }
}

function openCreateModal() {
  resetCreateForm()
  showCreateModal.value = true
}
function closeCreateModal() {
  showCreateModal.value = false
}

/* ===== Editar usuario existente ===== */
const showEditModal = ref(false)
const selectedUser = ref<AdminUser | null>(null)
const newPassword = ref('')
const modalError = ref<string | null>(null)

/** Estado local para meta */
const selectedUserMeta = ref<{ position: string; hireDate: string; birthDate: string }>({
  position: '',
  hireDate: '',
  birthDate: ''
})
const metaErrorsText = ref('')

/* Vacaciones */
const showVacModal = ref(false)
const savingVac = ref(false)
const vacError = ref<string | null>(null)
const vacForm = ref<VacFormState>({
  id: '',
  name: '',
  email: '',
  used: 0,
  currentTotal: 0,
  lftTotal: 0,
  windowStart: '',
  windowEnd: '',
  bonus: 0,
  effectiveTotal: 0
})

/* NUEVO: input único para aumentar bono */
const bonusToAdd = ref<number>(0)
const isValidBonusToAdd = computed(() => Number.isInteger(bonusToAdd.value) && bonusToAdd.value > 0)

onMounted(async () => {
  await fetchUsers()
})

/** Ventana con expiración opcional y helper para normalizar fecha */
type WindowLike = VacationWindow & {
  expiresAt?: string | Date | null
}
function toISODateString(d?: string | Date | null): string {
  if (!d) return ''
  return typeof d === 'string' ? d.slice(0, 10) : dayjs(d).format('YYYY-MM-DD')
}

/** helper simple (sin plugin isBetween) */
function isActiveWindow(w: WindowLike, today = dayjs().startOf('day')) {
  const s = dayjs(toISODateString(w.start))
  const exp = dayjs(toISODateString(w.expiresAt ?? w.end))
  if (!s.isValid() || !exp.isValid()) return false
  return !today.isBefore(s, 'day') && !today.isAfter(exp, 'day') // s <= today <= exp
}

async function fetchUsers() {
  loading.value = true
  error.value = null
  try {
    const base = await userService.getAllUsers() as AdminUser[]
    const today = dayjs().startOf('day')

    const rows = await Promise.all(
      base.map(async (u) => {
        try {
          const sum = await vacationService.getWindowsSummaryFixed(
            u.id,
            dateOnly(u.hireDate) || undefined
          )

          const windows = Array.isArray(sum?.windows) ? sum.windows : []

          // ¿Hay al menos una ventana activa hoy?
          const activeWins = windows.filter(w => isActiveWindow(w as WindowLike, today))
          if (activeWins.length === 0) {
            // antes del primer aniversario (o fuera de toda ventana activa)
            return { ...u, total: 0, used: 0, available: 0 } as RowUser
          }

          // Bono con fallback a adminExtra del listado base
          const bonus =
            Number.isFinite(Number(sum?.bonusAdmin))
              ? Number(sum!.bonusAdmin)
              : Number((u.vacationDays as VacationDaysExtended | undefined)?.adminExtra ?? 0)

          // Totales = días de TODAS las ventanas activas + bono
          const totalActivas = activeWins.reduce((acc, w) => acc + (Number(w?.days) || 0), 0)
          const total = totalActivas + bonus

          // Usados = de la ventana vigente (label 'current')
          const currentWin = windows.find(w => w.label === 'current')
          const usedCurrent = Number(currentWin?.used ?? 0)

          // Disponibles = summary.available (ya suma activas + bono), o respaldo calculado
          const available =
            Number(sum?.available) ||
            (activeWins.reduce((acc, w) => {
              const d = Number(w?.days) || 0
              const u2 = Number(w?.used) || 0
              return acc + Math.max(0, d - u2)
            }, 0) + bonus)

          return { ...u, total, used: usedCurrent, available } as RowUser
        } catch {
          // Fallback: deja lo que venga del backend
          return u as RowUser
        }
      })
    )

    users.value = rows
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Error desconocido al cargar usuarios'
    console.error('Error fetching users:', err)
  } finally {
    loading.value = false
  }
}

// helper
const isFiniteNumber = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v)

/**
 * TOTALES (tabla) = días de la **ventana vigente** únicamente.
 */
function total(u: RowUser): number {
  if (isFiniteNumber(u.total)) return u.total
  if (isFiniteNumber(u.vacationDays?.total)) return u.vacationDays!.total
  return 0
}

/**
 * USADOS (tabla) = usados de la **ventana vigente**.
 */
function used(u: RowUser): number {
  if (isFiniteNumber(u.used)) return u.used
  if (isFiniteNumber(u.vacationDays?.used)) return u.vacationDays!.used
  return 0
}

/**
 * DISPONIBLES (tabla) = restantes de la **ventana vigente**.
 */
function remaining(u: RowUser): number {
  if (isFiniteNumber(u.available)) return u.available
  if (isFiniteNumber(u.vacationDays?.remaining)) return u.vacationDays!.remaining
  return Math.max(0, total(u) - used(u))
}

/* ====== LFT summary (admin) ====== */
async function loadLFTSummary(userId: string) {
  const { data } = await api.get(`/users/${encodeURIComponent(userId)}/vacation/summary`)

  type ApiSummaryLFT = {
    vacation?: {
      right?: number
      used?: number
      remaining?: number
      window?: { start?: string | Date; end?: string | Date }
    }
  }

  type Envelope = ApiSummaryLFT | { data?: ApiSummaryLFT }
  const env = data as Envelope
  const payload: ApiSummaryLFT =
    ('data' in env && env.data) ? env.data! : (env as ApiSummaryLFT)

  const vac = payload.vacation ?? {}
  const win = vac.window ?? {}

  return {
    lftTotal: Number(vac.right ?? 0) || 0,
    lftUsed: Number(vac.used ?? 0) || 0,
    lftRemaining: Number(vac.remaining ?? 0) || 0,
    windowStart: win?.start ? String(win.start).slice(0,10) : '',
    windowEnd: win?.end ? String(win.end).slice(0,10) : ''
  }
}

/* ========= Helpers para bono/tabla ========= */
function computeRowFromSummary(sum: WindowsSummary, bonus: number) {
  const today = dayjs().startOf('day')
  const windows = Array.isArray(sum?.windows) ? sum.windows : []
  const activeWins = windows.filter((w) => {
    const s = dayjs(toISODateString(w.start))
    const exp = dayjs(toISODateString(w.expiresAt ?? w.end))
    if (!s.isValid() || !exp.isValid()) return false
    return !today.isBefore(s, 'day') && !today.isAfter(exp, 'day')
  })
  const totalActivas = activeWins.reduce((acc, w) => acc + (Number(w?.days) || 0), 0)
  const currentWin = windows.find(w => w.label === 'current')
  const usedCurrent = Number(currentWin?.used ?? 0)
  const available = activeWins.reduce((acc, w) => {
    const d = Number(w?.days) || 0
    const u = Number(w?.used) || 0
    return acc + Math.max(0, d - u)
  }, 0) + Math.max(0, Math.floor(bonus))

  return {
    total: totalActivas + Math.max(0, Math.floor(bonus)),
    used: usedCurrent,
    available
  }
}

function applyRowTotals(userId: string, totals: { total: number; used: number; available: number }) {
  const idx = users.value.findIndex(u => u.id === userId)
  if (idx === -1) return
  users.value[idx] = {
    ...users.value[idx],
    total: totals.total,
    used: totals.used,
    available: totals.available,
  }
}

/* ======= Editar/ajustar vacaciones ======= */

function openEditModal(u: AdminUser) {
  selectedUser.value = { ...u }
  newPassword.value = ''
  modalError.value = null

  selectedUserMeta.value = {
    position: u.position || '',
    hireDate: dateOnly(u.hireDate) || '',
    birthDate: dateOnly(u.birthDate) || ''
  }
  metaErrorsText.value = ''

  showEditModal.value = true
}

function closeModal() {
  showEditModal.value = false
  selectedUser.value = null
  newPassword.value = ''
  modalError.value = null
  metaErrorsText.value = ''
}

/** valida meta */
function validateMeta(): boolean {
  const { hireDate, birthDate } = selectedUserMeta.value
  let msg = ''
  if (hireDate) {
    if (!isoDayRe.test(hireDate)) msg = 'Fecha de ingreso inválida (YYYY-MM-DD)'
    else if (isFuture(hireDate)) msg = 'La fecha de ingreso no puede ser futura'
  }
  if (!msg && birthDate) {
    if (!isoDayRe.test(birthDate)) msg = 'Fecha de nacimiento inválida (YYYY-MM-DD)'
    else if (isFuture(birthDate)) msg = 'No puede ser futura'
  }
  if (!msg && hireDate && birthDate && yearsBetween(birthDate, hireDate) < 14) {
    msg = 'Ingreso inconsistente con el nacimiento (≥ 14 años)'
  }
  metaErrorsText.value = msg
  return !msg
}

async function updateUser() {
  if (!selectedUser.value) return
  modalError.value = null

  try {
    const current = users.value.find(x => x.id === selectedUser.value?.id)
    if (!current) throw new Error('Usuario no encontrado en la lista actual')

    // Nombre
    if (selectedUser.value.name.trim() && selectedUser.value.name !== current.name) {
      await userService.updateUserName(selectedUser.value.id, { name: selectedUser.value.name })
    }

    // Estado
    if (selectedUser.value.isActive !== current.isActive) {
      await userService.toggleUserLock(selectedUser.value.id)
    }

    // Contraseña
    if (newPassword.value.trim().length > 0) {
      await userService.updateUserPassword(selectedUser.value.id, { newPassword: newPassword.value })
    }

    // Meta (puesto/fechas)
    if (!validateMeta()) {
      return
    }
    const metaPayload: UpdateMetaPayload = {}
    if (selectedUserMeta.value.position !== (current.position || '')) {
      metaPayload.position = selectedUserMeta.value.position
    }
    if (selectedUserMeta.value.hireDate !== dateOnly(current.hireDate) ) {
      metaPayload.hireDate = selectedUserMeta.value.hireDate
    }
    if (selectedUserMeta.value.birthDate !== dateOnly(current.birthDate)) {
      metaPayload.birthDate = selectedUserMeta.value.birthDate
    }
    if (Object.keys(metaPayload).length > 0) {
      await userService.updateUserMeta(
        selectedUser.value.id,
        metaPayload as UpdateMetaParam
      )
    }

    await fetchUsers()
    closeModal()
    pushToast('Usuario actualizado', 'success')
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'No se pudo actualizar el usuario'
    modalError.value = msg
    pushToast(msg, 'error')
    console.error('Error updating user:', err)
  }
}

async function confirmDelete(userId: string) {
  const ok = window.confirm('¿Seguro que quieres eliminar este usuario?')
  if (!ok) return
  try {
    await userService.deleteUser(userId)
    users.value = users.value.filter(u => u.id !== userId)
    pushToast('Usuario eliminado', 'success')
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'No se pudo eliminar el usuario'
    error.value = msg
    pushToast(msg, 'error')
    console.error('Error deleting user:', err)
  }
}

function updateSelectedUser<K extends keyof AdminUser>(key: K, value: AdminUser[K]) {
  if (selectedUser.value) {
    selectedUser.value[key] = value
  }
}

// Vacaciones (abrir modal con LFT)
async function openVacationModal(u: AdminUser) {
  vacError.value = null
  showVacModal.value = true

  // Asegura el ID de inmediato
  vacForm.value.id = (u.id || '').trim()
  bonusToAdd.value = 0

  const curTotal = total(u)
  const curUsed = used(u)

  try {
    const s = await loadLFTSummary(u.id)

    // Pide el summary de ventanas para leer el bono real
    const sum = await vacationService.getWindowsSummaryFixed(
      u.id,
      dateOnly(u.hireDate) || undefined
    )
    const bonus =
      Number.isFinite(Number(sum?.bonusAdmin))
        ? Number(sum!.bonusAdmin)
        : 0

    vacForm.value = {
      id: (u.id || '').trim(),
      name: u.name,
      email: u.email,
      used: curUsed,
      currentTotal: curTotal,
      lftTotal: s.lftTotal,
      windowStart: s.windowStart,
      windowEnd: s.windowEnd,
      bonus,
      effectiveTotal: Math.max(curTotal, Math.max(curUsed, s.lftTotal)),
    }
  } catch (e: unknown) {
    console.error('[vacationModal] error loading LFT summary', e)
    vacForm.value = {
      id: (u.id || '').trim(),
      name: u.name,
      email: u.email,
      used: curUsed,
      currentTotal: curTotal,
      lftTotal: 0,
      windowStart: '',
      windowEnd: '',
      bonus: 0,
      effectiveTotal: curTotal
    }
    pushToast('No se pudo cargar el resumen LFT. Aún puedes agregar bono.', 'warn')
  }
}

function closeVacModal() {
  showVacModal.value = false
  vacError.value = null
  bonusToAdd.value = 0
}

/** ÚNICA ACCIÓN: guardar aumento de bono */
async function saveBonusIncrease() {
  const userId = (vacForm.value.id || selectedUser.value?.id || '').trim()
  if (!userId) {
    vacError.value = 'No hay usuario activo en el modal'
    pushToast('No hay usuario activo en el modal', 'error')
    return
  }
  const delta = Math.floor(Number(bonusToAdd.value ?? 0))
  if (!Number.isInteger(delta) || delta <= 0) {
    vacError.value = 'Ingresa un entero mayor a 0.'
    pushToast('Ingresa un entero mayor a 0.', 'warn')
    return
  }

  try {
    savingVac.value = true
    // 1) Aumentar bono en backend
    await VacSvcNS.adjustAdminBonus(userId, delta)

    // 2) Refrescar summary y recalcular fila
    const sum = await vacationService.getWindowsSummaryFixed(userId)
    const newBonus = Number.isFinite(Number(sum?.bonusAdmin)) ? Number(sum!.bonusAdmin) : vacForm.value.bonus
    const totals = computeRowFromSummary(sum, newBonus)
    applyRowTotals(userId, totals)

    // 3) Actualizar “Ver saldo” si está abierto
    if (showWindowsModal.value) {
      winModal.value.summary = sum
    }

    // 4) Sincronizar el modal actual
    vacForm.value.bonus = newBonus
    vacForm.value.currentTotal = totals.total
    vacForm.value.effectiveTotal = Math.max(totals.total, Math.max(vacForm.value.used, vacForm.value.lftTotal))
    bonusToAdd.value = 0

    pushToast('Bono aumentado correctamente', 'success')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'No se pudo aumentar el bono'
    vacError.value = msg
    pushToast(msg, 'error')
    console.error('[saveBonusIncrease] ERROR', e)
  } finally {
    savingVac.value = false
  }
}

/* ========= Modal "Saldo por ventanas" ========= */
const showWindowsModal = ref(false)
const winModal = ref<{
  userName: string
  userEmail: string
  loading: boolean
  error: string | null
  summary: WindowsSummary | null
}>({
  userName: '',
  userEmail: '',
  loading: false,
  error: null,
  summary: null
})

function remainingOf(w: VacationWindow): number {
  return Math.max((w?.days ?? 0) - (w?.used ?? 0), 0)
}

async function openWindowsModal(u: AdminUser) {
  showWindowsModal.value = true
  winModal.value.userName = u.name
  winModal.value.userEmail = u.email
  winModal.value.loading = true
  winModal.value.error = null
  winModal.value.summary = null

  try {
    const sum = await vacationService.getWindowsSummaryFixed(u.id, dateOnly(u.hireDate) || undefined)
    winModal.value.summary = sum
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'No se pudo cargar el saldo por ventanas'
    winModal.value.error = msg
    pushToast(msg, 'error')
  } finally {
    winModal.value.loading = false
  }
}

function closeWindowsModal() {
  showWindowsModal.value = false
  winModal.value.loading = false
  winModal.value.summary = null
  winModal.value.error = null
}
</script>

<style scoped>
.user-management-container { padding: 2rem; max-width: 1200px; margin: 0 auto; }

/* Toasts */
.toast-container {
  position: fixed;
  top: 1rem;
  right: 1rem;
  display: grid;
  gap: .5rem;
  z-index: 1100;
}
.toast {
  display: flex;
  align-items: center;
  gap: .5rem;
  padding: .625rem .875rem;
  border-radius: .5rem;
  box-shadow: 0 6px 18px rgba(0,0,0,.08);
  font-size: .95rem;
  line-height: 1.2;
  background: #f7fafc;
  color: #2d3748;
  border: 1px solid #e2e8f0;
}
.toast-dot { width: .5rem; height: .5rem; border-radius: 9999px; display: inline-block; }
.toast--success { background: #f0fff4; color: #22543d; border-color: #c6f6d5; }
.toast--error   { background: #fff5f5; color: #742a2a; border-color: #fed7d7; }
.toast--info    { background: #ebf8ff; color: #2a4365; border-color: #bee3f8; }
.toast--warn    { background: #fffaf0; color: #744210; border-color: #feebc8; }

.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
.header-actions { display: flex; align-items: center; gap: .75rem; }
.title { font-size: 1.5rem; font-weight: 600; color: #1a202c; }
.loading-indicator { color: #4a5568; font-size: 0.875rem; }
.error-message { padding: 1rem; background-color: #fff5f5; color: #e53e3e; border-radius: 0.375rem; margin-bottom: 1.5rem; }

.create-btn { display: inline-flex; align-items: center; gap: .5rem; padding: .5rem .75rem; border-radius: .375rem; background: #48bb78; color: #fff; font-weight: 600; }
.create-btn:hover { background: #38a169; }
.create-btn .icon { width: 1.1rem; height: 1.1rem; fill: currentColor; }

.table-container {
  background-color: white;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  overflow-x: auto;
  overflow-y: hidden;
}

.user-table { width: 100%; border-collapse: collapse; }
.user-table th { padding: 1rem; text-align: left; background-color: #f7fafc; color: #4a5568; font-weight: 600; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.05em; }
.user-table td { padding: 1rem; border-top: 1px solid #edf2f7; }
.user-row:hover { background-color: #f8fafc; }

.name-column { width: 20%; }
.email-column { width: 22%; }
.role-column { width: 10%; }
.vac-col { width: 6%; }
.actions-column { width: 20%; }
.text-right { text-align: right; }

.user-info { display: flex; flex-direction: column; gap: 0.25rem; }
.user-name { font-weight: 500; color: #1a202c; }
.user-status { font-size: 0.75rem; padding: 0.125rem 0.5rem; border-radius: 9999px; display: inline-block; width: fit-content; }
.user-status.active { background-color: #f0fff4; color: #38a169; }
.user-status.inactive { background-color: #fff5f5; color: #e53e3e; }
.verified-badge { font-size: 0.75rem; color: #4299e1; background-color: #ebf8ff; padding: 0.125rem 0.5rem; border-radius: 9999px; display: inline-block; width: fit-content; }

.role-badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.875rem; font-weight: 500; }
.role-badge.admin { background-color: #ebf4ff; color: #667eea; }
.role-badge.user  { background-color: #f0fff4; color: #48bb78; }

.actions-cell { display: flex; gap: 0.5rem; }
.edit-btn, .delete-btn, .vac-btn { padding: 0.5rem; border-radius: 0.375rem; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
.edit-btn { color: #4299e1; background-color: #ebf8ff; } .edit-btn:hover { background-color: #bee3f8; }
.vac-btn { color: #2b6cb0; background-color: #ebf8ff; } .vac-btn:hover { background-color: #bee3f8; }
.delete-btn { color: #f56565; background-color: #fff5f5; } .delete-btn:hover { background-color: #fed7d7; }
.icon { width: 1.25rem; height: 1.25rem; fill: currentColor; }
.empty-state { padding: 2rem; text-align: center; color: #718096; }

/* estilos del resto de modales y tablas idénticos a los tuyos */
.modal-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0,0,0,.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  overflow: auto;
  padding: 1rem;
}
.modal-content {
  background-color: white;
  border-radius: 0.5rem;
  width: 100%;
  max-width: 620px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.1);
  max-height: 92vh;
  display: flex;
  flex-direction: column;
}
.modal-header {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #edf2f7;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}
.modal-header h3 { font-size: 1.1rem; font-weight: 600; color: #1a202c; }
.close-btn { color: #a0aec0; background: none; border: none; cursor: pointer; padding: 0.25rem; }
.close-btn:hover { color: #718096; }

.modal-body { padding: 1.5rem; overflow: auto; }
.form-group { margin-bottom: 1rem; }
.form-group label { display: block; margin-bottom: 0.5rem; font-size: 0.875rem; font-weight: 500; color: #4a5568; }
.form-group input, .form-group select {
  width: 100%;
  padding: 0.625rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  transition: border-color 0.2s;
}
.form-group input:focus, .form-group select:focus { outline: none; border-color: #4299e1; box-shadow: 0 0 0 3px rgba(66,153,225,0.2); }
.input-error { border-color: #e53e3e !important; }
.error-text { color: #e53e3e; font-size: 0.85rem; }

.modal-footer {
  padding: 1.25rem 1.5rem;
  border-top: 1px solid #edf2f7;
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  position: sticky;
  bottom: 0;
  background: #fff;
  flex-shrink: 0;
}
.cancel-btn, .save-btn { padding: 0.625rem 1.25rem; border-radius: 0.375rem; font-weight: 500; transition: all 0.2s; }
.cancel-btn { background-color: #edf2f7; color: #4a5568; } .cancel-btn:hover { background-color: #e2e8f0; }
.save-btn { background-color: #4299e1; color: white; } .save-btn:hover { background-color: #3182ce; }
.save-btn[disabled], .save-btn:disabled { background-color: #a0aec0; cursor: not-allowed; }

.modal-error { margin: .75rem 1.5rem 1.25rem; padding: 0.75rem; background-color: #fff5f5; color: #e53e3e; border-radius: 0.375rem; font-size: 0.875rem; }
.modal-info { margin: .5rem 0 1rem; padding: 0.75rem; background-color: #f0fff4; color: #2f855a; border-radius: 0.375rem; font-size: 0.875rem; }

.grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: .75rem; margin-bottom: .75rem; }
.stat { background: #f7fafc; border: 1px solid #edf2f7; padding: .5rem .75rem; border-radius: .375rem; }
.stat.full { grid-column: 1 / -1; }
.stat .label { font-size: .75rem; color: #4a5568; }
.stat .value { font-weight: 600; color: #1a202c; }
.text-warn { color: #c05621; }

/* Única acción de bono */
.bonus-row { display: flex; gap: .5rem; align-items: center; flex-wrap: wrap; }
.bonus-input { max-width: 120px; }

.window-column { width: 18%; }
.window-cell { white-space: nowrap; }
.win-btn {
  padding: .375rem .75rem;
  border-radius: .375rem;
  background: #edf2f7;
  color: #2d3748;
  font-weight: 600;
}
.win-btn:hover { background: #e2e8f0; }

/* Chips y pill del modal de ventanas */
.badge {
  display:inline-block;
  padding:.2rem .55rem;
  border-radius:9999px;
  font-size:.775rem;
  font-weight:600;
}
.badge-gold { background:#fffaf0; color:#b7791f; border:1px solid #fbd38d; }
.badge-blue { background:#ebf8ff; color:#2b6cb0; border:1px solid #bee3f8; }
.subtle { font-size:.8rem; color:#718096; }

.pill.total-pill {
  background:#edf2f7;
  border:1px solid #cbd5e0;
  border-radius:9999px;
  padding:.35rem .7rem;
  font-weight:700;
  color:#2d3748;
}

/* Ojitos dentro del input */
.cp-input-wrap { position: relative; }
.cp-eye{
  position: absolute;
  right: .5rem;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: 0;
  padding: 0;
  cursor: pointer;
  display: grid;
  place-items: center;
}
.cp-eye svg { width: 20px; height: 20px; opacity: .85; }
.cp-eye:hover svg { opacity: 1; }

/* Reglas de contraseña en vivo */
.pwd-rules{
  list-style: none;
  padding-left: 0;
  margin: 8px 0 0;
  font-size: .85rem;
  color: #6b7280;
}
.pwd-rules li{
  display: flex;
  align-items: center;
  gap: .4rem;
  margin: 2px 0;
}
.pwd-rules li::before{ content: "●"; font-size: .6rem; }
.pwd-rules li.ok{ color:#065f46; }
.pwd-rules li.ok::before{ content:"✔"; font-size:.8rem; }

</style>
