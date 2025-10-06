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

            <td class="window-cell">
              <template v-if="win(u)">
                <div class="win-range">
                  {{ win(u)!.start }} → {{ win(u)!.end }}
                </div>
                <div
                  class="win-left"
                  :class="{ 'text-warn': (win(u)!.daysLeft ?? 0) <= 15 }"
                >
                  {{ win(u)!.daysLeft }} días restantes
                </div>
              </template>
              <span v-else>—</span>
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

        <!-- Form soporta Enter -->
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

          <div class="form-group">
            <label>Contraseña</label>
            <input
              type="password"
              v-model="createForm.password"
              :class="{ 'input-error': createErrors.password }"
              placeholder="Mínimo 8 caracteres con mayúscula, número y símbolo"
              autocomplete="new-password"
            />
            <small v-if="createErrors.password" class="error-text">{{ createErrors.password }}</small>
          </div>

          <div class="form-group">
            <label>Confirmar contraseña</label>
            <input
              type="password"
              v-model="createForm.password_confirmation"
              :class="{ 'input-error': createErrors.password_confirmation }"
              placeholder="Repite la contraseña"
              autocomplete="new-password"
            />
            <small v-if="createErrors.password_confirmation" class="error-text">{{ createErrors.password_confirmation }}</small>
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

          <!-- Controles de Bono -->
          <div class="form-group">
            <label>Ajustar bono admin (no puede bajar del Derecho LFT):</label>
            <div class="bonus-row">
              <button class="pill-btn" @click="applyBonusDelta(-1)" :disabled="bonusWouldGoUnderLaw(-1)">-1</button>
              <button class="pill-btn" @click="applyBonusDelta(+1)">+1</button>

              <input
                type="number"
                class="bonus-input"
                v-model.number="vacForm.bonusEdit"
                step="1"
                :min="minBonusAllowed"
                @keyup.enter.stop.prevent="applyBonusValue()"
              />
              <button class="apply-btn" @click="applyBonusValue">Aplicar</button>
            </div>
            <small class="text-warn" v-if="vacForm.bonusEdit < minBonusAllowed">
              El total efectivo no puede ser menor que el Derecho ({{ vacForm.lftTotal }}) ni menor que los usados ({{ vacForm.used }}).
            </small>
          </div>

          <!-- (Opcional) Mantenimiento legacy de total absoluto -->
          <div class="form-group">
            <label>Fijar total manual (legacy)</label>
            <input
              type="number"
              min="0"
              step="1"
              v-model.number="vacForm.newTotal"
              @keyup.enter.stop.prevent="saveVacationTotal()"
            />
            <small v-if="vacForm.newTotal < vacForm.used" class="text-warn">
              El total no puede ser menor que los días usados ({{ vacForm.used }}).
            </small>
            <small v-else-if="vacForm.newTotal < vacForm.lftTotal" class="text-warn">
              El total no puede ser menor que el Derecho LFT ({{ vacForm.lftTotal }}).
            </small>
            <small v-else-if="isSameTotal" class="text-warn">
              El nuevo total es igual al actual.
            </small>
          </div>
        </div>

        <div class="modal-footer">
          <button class="cancel-btn" @click="closeVacModal">Cerrar</button>
          <button
            class="save-btn"
            :disabled="savingVac || vacForm.newTotal < vacForm.used || vacForm.newTotal < vacForm.lftTotal || isSameTotal"
            @click.stop.prevent="saveVacationTotal()"
            title="Fijar total manual respetando LFT y usados"
          >
            {{ savingVac ? 'Guardando…' : 'Guardar total' }}
          </button>
        </div>

        <div v-if="vacError" class="modal-error">{{ vacError }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import api from '@/services/api'
import userService from '@/services/user.service'
import type { User as BaseUser, Role, VacationDays } from '@/services/user.service'

/** Usuario con meta extendida para esta vista */
type AdminUser = BaseUser & {
  position?: string
  hireDate?: string | null
  birthDate?: string | null
}

/** Payload local para creación */
type CreatePayload = {
  name: string
  email: string
  password: string
  password_confirmation: string
  role: Role
  position?: string
  hireDate?: string
  birthDate?: string
}

/** Payload local para actualizar meta */
type UpdateMetaPayload = {
  position?: string
  hireDate?: string
  birthDate?: string
}

const users = ref<AdminUser[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

/* ===== Utils ===== */
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const strongPassRe = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/
const isoDayRe = /^\d{4}-\d{2}-\d{2}$/
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

/* ===== Helpers LFT para mostrar ventana en la tabla ===== */

/** Años de servicio completos al `onDate` */
function yearsOfServiceLocal(hireDate: string | null | undefined, onDate = new Date()): number {
  if (!hireDate) return 0
  const hd = new Date(hireDate)
  if (Number.isNaN(hd.getTime())) return 0
  const d = new Date(onDate)
  let yrs = d.getUTCFullYear() - hd.getUTCFullYear()
  const annivThisYear = new Date(Date.UTC(d.getUTCFullYear(), hd.getUTCMonth(), hd.getUTCDate()))
  if (d < annivThisYear) yrs -= 1
  return Math.max(0, yrs)
}

/** Ajuste para aniversarios en meses con menos días (p.ej. 29-feb -> 28-feb en años no bisiestos) */
function safeAnniversaryBase(hire: Date, year: number): Date {
  const month = hire.getUTCMonth()
  const day = hire.getUTCDate()
  const candidate = new Date(Date.UTC(year, month, 1))
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  candidate.setUTCDate(Math.min(day, lastDay))
  return candidate
}

/**
 * Ventana visible:
 * - Si aún no cumple 1 año => usa PRÓXIMO aniversario (+6 meses).
 * - Si ya cumplió >=1 => usa aniversario vigente (este año si ya pasó; si no, el anterior) (+6 meses).
 */
function lftWindowForHireDate(
  hireDate?: string | null
): { start: string; end: string; daysLeft: number } | null {
  if (!hireDate) return null
  const hd = new Date(hireDate)
  if (Number.isNaN(hd.getTime())) return null

  const today = new Date()
  today.setUTCHours(0,0,0,0)

  const yos = yearsOfServiceLocal(hireDate, today)

  let start: Date
  if (yos === 0) {
    // Próximo aniversario (a 1 año de ingreso)
    start = safeAnniversaryBase(hd, hd.getUTCFullYear() + 1)
  } else {
    // Vigente: este año si ya pasó, si no el anterior
    const annivThisYear = safeAnniversaryBase(hd, today.getUTCFullYear())
    start = (today >= annivThisYear)
      ? annivThisYear
      : safeAnniversaryBase(hd, today.getUTCFullYear() - 1)
  }

  const end = new Date(start)
  end.setUTCMonth(end.getUTCMonth() + 6)

  const msLeft = Math.max(0, end.getTime() - today.getTime())
  const daysLeft = Math.ceil(msLeft / (24*60*60*1000))

  return {
    start: start.toISOString().slice(0,10),
    end:   end.toISOString().slice(0,10),
    daysLeft
  }
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
  const passOk = strongPassRe.test(f.password)
  const confirmOk = f.password_confirmation.length > 0 && f.password_confirmation === f.password

  // Fechas opcionales
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
  const anyErr = err as { code?: string; message?: string }
  return anyErr?.code === 'ECONNABORTED' || /timeout/i.test(anyErr?.message || '')
}

async function handleCreateUser() {
  if (creating.value) return
  if (!validateCreate()) {
    pushToast('Revisa los campos del formulario', 'warn')
    return
  }

  creating.value = true
  try {
    const payload: CreatePayload = {
      name: createForm.value.name.trim(),
      email: createForm.value.email.trim().toLowerCase(),
      password: createForm.value.password,
      password_confirmation: createForm.value.password_confirmation,
      role: createForm.value.role
    }
    if (createForm.value.position.trim()) payload.position = createForm.value.position.trim()
    if (createForm.value.hireDate) payload.hireDate = createForm.value.hireDate
    if (createForm.value.birthDate) payload.birthDate = createForm.value.birthDate

    const { user, requiresEmailVerification } =
      await userService.createUserAsAdmin(
        payload as unknown as Parameters<typeof userService.createUserAsAdmin>[0]
      )

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
const vacForm = ref({
  id: '' as string,
  name: '' as string,
  email: '' as string,

  // Estado actual de BD (totales/used)
  used: 0,
  currentTotal: 0,

  // LFT resumen (DERECHO)
  lftTotal: 0,
  windowStart: '' as string | '',
  windowEnd: '' as string | '',

  // Bono admin (derivado = total - LFT)
  bonus: 0,
  bonusEdit: 0, // valor editable

  // Total efectivo (lft + bonus)
  effectiveTotal: 0,

  // legacy setter
  newTotal: 0
})

/* Computed para habilitar/deshabilitar Guardar (legacy setter) */
const isSameTotal = computed(() => {
  const t = Math.max(0, Math.floor(Number(vacForm.value.newTotal ?? 0)))
  return t === vacForm.value.currentTotal
})

/* Borde inferior para bono: que el total efectivo >= max(LFT, usados) */
const minBonusAllowed = computed(() => {
  const minTotal = Math.max(vacForm.value.lftTotal, vacForm.value.used)
  return Math.max(0, minTotal - vacForm.value.lftTotal)
})

function bonusWouldGoUnderLaw(delta: number) {
  const nextBonus = (vacForm.value.bonus ?? 0) + delta
  const nextTotal = vacForm.value.lftTotal + nextBonus
  return nextTotal < Math.max(vacForm.value.lftTotal, vacForm.value.used)
}

onMounted(async () => {
  await fetchUsers()
})

async function fetchUsers() {
  loading.value = true
  error.value = null
  try {
    users.value = await userService.getAllUsers() as AdminUser[]
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Error desconocido al cargar usuarios'
    console.error('Error fetching users:', err)
  } finally {
    loading.value = false
  }
}

/* Helpers tabla */
function total(u: AdminUser) { return u.vacationDays?.total ?? 0 }
function used(u: AdminUser) { return u.vacationDays?.used ?? 0 }
function remaining(u: AdminUser) { return Math.max(0, total(u) - used(u)) }
function win(u: AdminUser): { start: string; end: string; daysLeft: number } | null {
  return lftWindowForHireDate(u.hireDate)
}

/* ====== LFT summary (admin) ====== */
async function loadLFTSummary(userId: string) {
  // GET /users/:userId/vacation/summary  -> { data: { vacation: { right, adminExtra, total, used, remaining, window } } }
  const { data } = await api.get(`/users/${encodeURIComponent(userId)}/vacation/summary`)
  const payload = (data && data.data) ? data.data : data
  const vac = payload?.vacation ?? {}
  const win = vac?.window ?? {}
  return {
    // DERECHO (LFT) — ¡ojo! usamos 'right' (no 'total')
    lftTotal: Number(vac?.right ?? 0) || 0,
    lftUsed: Number(vac?.used ?? 0) || 0,
    lftRemaining: Number(vac?.remaining ?? 0) || 0,
    windowStart: win?.start ? String(win.start).slice(0,10) : '',
    windowEnd: win?.end ? String(win.end).slice(0,10) : ''
  }
}

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
    else if (isFuture(birthDate)) msg = 'La fecha de nacimiento no puede ser futura'
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
        metaPayload as unknown as Parameters<typeof userService.updateUserMeta>[1]
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

  // estado actual
  const curTotal = total(u)
  const curUsed = used(u)

  // cargar LFT summary
  try {
    const s = await loadLFTSummary(u.id)
    const bonus = curTotal - s.lftTotal

    vacForm.value = {
      id: u.id,
      name: u.name,
      email: u.email,

      used: curUsed,
      currentTotal: curTotal,

      lftTotal: s.lftTotal,
      windowStart: s.windowStart,
      windowEnd: s.windowEnd,

      bonus: bonus,
      bonusEdit: Math.max(minBonusAllowed.value, bonus),

      // para mostrar, mantenemos consistencia con restricciones
      effectiveTotal: Math.max(curTotal, Math.max(curUsed, s.lftTotal)),

      newTotal: curTotal
    }
  } catch (e: unknown) {
    console.error('[vacationModal] error loading LFT summary', e)
    // fallback sin LFT
    vacForm.value = {
      id: u.id,
      name: u.name,
      email: u.email,
      used: curUsed,
      currentTotal: curTotal,
      lftTotal: 0,
      windowStart: '',
      windowEnd: '',
      bonus: 0,
      bonusEdit: 0,
      effectiveTotal: curTotal,
      newTotal: curTotal
    }
    pushToast('No se pudo cargar el resumen LFT. Aún puedes ajustar el total.', 'warn')
  }
  console.log('[vacModal] open', JSON.parse(JSON.stringify(vacForm.value)))
}

function closeVacModal() {
  showVacModal.value = false
  vacError.value = null
}

/** Ajuste relativo del bono (+/-) */
async function applyBonusDelta(delta: number) {
  if (bonusWouldGoUnderLaw(delta)) return
  try {
    savingVac.value = true
    const vd: VacationDays = await userService.adjustVacationBonus(vacForm.value.id, { delta })
    // Recalcular tras respuesta
    const newTotal = Math.floor(Number(vd.total || 0))
    const b = newTotal - vacForm.value.lftTotal
    vacForm.value.currentTotal = newTotal
    vacForm.value.bonus = b
    vacForm.value.bonusEdit = b
    vacForm.value.effectiveTotal = Math.max(newTotal, Math.max(vacForm.value.used, vacForm.value.lftTotal))

    // Refrescar en tabla
    const idx = users.value.findIndex(u => u.id === vacForm.value.id)
    if (idx !== -1) users.value[idx] = { ...users.value[idx], vacationDays: { ...vd } }

    pushToast(`Bono actualizado. Total: ${vd.total}, Disponibles: ${vd.remaining}`, 'success')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'No se pudo ajustar el bono'
    vacError.value = msg
    pushToast(msg, 'error')
    console.error('[applyBonusDelta] ERROR', e)
  } finally {
    savingVac.value = false
  }
}

/** Fijar bono a un valor específico */
async function applyBonusValue() {
  const b = Math.floor(Number(vacForm.value.bonusEdit ?? 0))
  // mínimo para que total >= max(LFT, usados)
  const minB = minBonusAllowed.value
  const safeBonus = Math.max(b, minB)

  try {
    savingVac.value = true
    const vd: VacationDays = await userService.adjustVacationBonus(vacForm.value.id, { value: safeBonus })
    const newTotal = Math.floor(Number(vd.total || 0))
    const nb = newTotal - vacForm.value.lftTotal
    vacForm.value.currentTotal = newTotal
    vacForm.value.bonus = nb
    vacForm.value.bonusEdit = nb
    vacForm.value.effectiveTotal = Math.max(newTotal, Math.max(vacForm.value.used, vacForm.value.lftTotal))

    const idx = users.value.findIndex(u => u.id === vacForm.value.id)
    if (idx !== -1) users.value[idx] = { ...users.value[idx], vacationDays: { ...vd } }

    pushToast(`Bono fijado. Total: ${vd.total}, Disponibles: ${vd.remaining}`, 'success')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'No se pudo fijar el bono'
    vacError.value = msg
    pushToast(msg, 'error')
    console.error('[applyBonusValue] ERROR', e)
  } finally {
    savingVac.value = false
  }
}

/** Guardado legacy de total absoluto (respetando límites LFT y usados) */
async function saveVacationTotal() {
  try {
    savingVac.value = true
    const newTotal = Math.max(
      vacForm.value.lftTotal,              // no menor que la ley (DERECHO)
      vacForm.value.used,                  // no menor que usados
      Math.floor(Number(vacForm.value.newTotal ?? 0))
    )
    if (newTotal === vacForm.value.currentTotal) {
      pushToast('No hay cambios en el total de días', 'info')
      return closeVacModal()
    }

    const vd = await userService.setVacationTotal(vacForm.value.id, { total: newTotal })

    const idx = users.value.findIndex(u => u.id === vacForm.value.id)
    if (idx !== -1) {
      users.value[idx] = {
        ...users.value[idx],
        vacationDays: { ...vd },
      }
    }

    // ajustar campos locales/bono derivados
    vacForm.value.currentTotal = vd.total
    vacForm.value.effectiveTotal = vd.total
    vacForm.value.bonus = vd.total - vacForm.value.lftTotal
    vacForm.value.bonusEdit = vacForm.value.bonus

    closeVacModal()
    pushToast(`Días de vacaciones actualizados: total ${vd.total}, disponibles ${vd.remaining}`, 'success')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'No se pudieron guardar los días'
    vacError.value = msg
    pushToast(msg, 'error')
    console.error('[saveVacationTotal] ERROR', e)
  } finally {
    savingVac.value = false
  }
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
.toast--success .toast-dot { background: #38a169; }
.toast--error   { background: #fff5f5; color: #742a2a; border-color: #fed7d7; }
.toast--error .toast-dot { background: #e53e3e; }
.toast--info    { background: #ebf8ff; color: #2a4365; border-color: #bee3f8; }
.toast--info .toast-dot { background: #3182ce; }
.toast--warn    { background: #fffaf0; color: #744210; border-color: #feebc8; }
.toast--warn .toast-dot { background: #dd6b20; }

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
.form-group input, .form-group select { width: 100%; padding: 0.625rem; border: 1px solid #e2e8f0; border-radius: 0.375rem; transition: border-color 0.2s; }
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

.bonus-row {
  display: flex;
  gap: .5rem;
  align-items: center;
  flex-wrap: wrap;
}
.pill-btn {
  border: 1px solid #cbd5e0;
  background: #edf2f7;
  padding: .4rem .7rem;
  border-radius: 9999px;
  font-weight: 600;
}
.pill-btn:disabled { opacity: .5; cursor: not-allowed; }
.bonus-input { max-width: 120px; }
.apply-btn {
  background: #4299e1;
  color: white;
  padding: .5rem .9rem;
  border-radius: .375rem;
}

@media (max-height: 700px) {
  .modal-content { max-height: 96vh; }
}

/* Ventana (tabla) */
.window-column { width: 18%; }
.window-cell { white-space: nowrap; }
.win-range { font-weight: 600; color: #1a202c; }
.win-left { font-size: .8rem; color: #4a5568; }
.text-warn { color: #c05621; }

/* La columna de acciones no se encoge y mantiene los botones a la vista */
.actions-column { width: 140px; min-width: 140px; }
.actions-cell { display: flex; gap: 0.5rem; white-space: nowrap; }

/* La celda de Ventana usa tipografía pequeña y puede partir línea */
.window-cell small { display: block; color: #718096; margin-top: .125rem; }
</style>
