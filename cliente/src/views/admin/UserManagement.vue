<!-- cliente/src/views/admin/UserManagement.vue -->
<template>
  <div class="user-management-container">
    <div class="header">
      <h2 class="title">Gestión de Usuarios</h2>
      <div v-if="loading" class="loading-indicator">Cargando usuarios...</div>
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
            <th class="vac-col text-right">Usados</th>
            <th class="vac-col text-right">Totales</th>
            <th class="vac-col text-right">Disponibles</th>
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

            <!-- Vacaciones -->
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

            <td class="actions-cell">
              <button class="edit-btn" @click="openEditModal(u)" title="Editar">
                <svg class="icon" viewBox="0 0 24 24">
                  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                </svg>
              </button>
              <button class="vac-btn" @click="openVacationModal(u)" title="Editar días de vacaciones">
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

          <div class="form-group">
            <label>Nueva Contraseña</label>
            <input v-model="newPassword" type="password" placeholder="Deja en blanco para mantener la actual" />
          </div>
        </div>

        <div class="modal-footer">
          <button class="cancel-btn" @click="closeModal">Cancelar</button>
          <button class="save-btn" @click="updateUser">Guardar</button>
        </div>

        <div v-if="modalError" class="modal-error">{{ modalError }}</div>
      </div>
    </div>

    <!-- Modal Vacaciones (establecer total) -->
    <div v-if="showVacModal" class="modal-overlay" @click.self="closeVacModal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Días de vacaciones: {{ vacForm.name }}</h3>
          <button class="close-btn" @click="closeVacModal" title="Cerrar">
            <svg viewBox="0 0 24 24"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </div>

        <div class="modal-body">
          <div class="grid-2">
            <div class="stat">
              <span class="label">Usados</span>
              <span class="value">{{ vacForm.used }}</span>
            </div>
            <div class="stat">
              <span class="label">Totales actuales</span>
              <span class="value">{{ vacForm.currentTotal }}</span>
            </div>
            <div class="stat full">
              <span class="label">Disponibles</span>
              <span class="value">{{ Math.max(0, vacForm.currentTotal - vacForm.used) }}</span>
            </div>
          </div>

          <div class="form-group">
            <label>Nuevo total de días</label>
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
          </div>
        </div>

        <div class="modal-footer">
          <button class="cancel-btn" @click="closeVacModal">Cancelar</button>
          <button
            class="save-btn"
            :disabled="savingVac || vacForm.newTotal < vacForm.used"
            @click.stop.prevent="saveVacationTotal()"
          >
            {{ savingVac ? 'Guardando…' : 'Guardar' }}
          </button>
        </div>

        <div v-if="vacError" class="modal-error">{{ vacError }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import userService from '@/services/user.service'
import type { User, Role } from '@/services/user.service'

const users = ref<User[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

const showEditModal = ref(false)
const selectedUser = ref<User | null>(null)
const newPassword = ref('')

const modalError = ref<string | null>(null)

// Vacaciones
const showVacModal = ref(false)
const savingVac = ref(false)
const vacError = ref<string | null>(null)
const vacForm = ref({
  id: '' as string,
  name: '' as string,
  email: '' as string,
  used: 0,
  currentTotal: 0,
  newTotal: 0
})

onMounted(async () => {
  await fetchUsers()
})

async function fetchUsers() {
  loading.value = true
  error.value = null
  try {
    users.value = await userService.getAllUsers()
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Error desconocido al cargar usuarios'
    console.error('Error fetching users:', err)
  } finally {
    loading.value = false
  }
}

function total(u: User) { return u.vacationDays?.total ?? 0 }
function used(u: User) { return u.vacationDays?.used ?? 0 }
function remaining(u: User) { return Math.max(0, total(u) - used(u)) }

function openEditModal(u: User) {
  selectedUser.value = { ...u }
  newPassword.value = ''
  modalError.value = null
  showEditModal.value = true
}

function closeModal() {
  showEditModal.value = false
  selectedUser.value = null
  newPassword.value = ''
  modalError.value = null
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

    // Estado activo/inactivo
    if (selectedUser.value.isActive !== current.isActive) {
      await userService.toggleUserLock(selectedUser.value.id)
    }

    // Contraseña
    if (newPassword.value.trim().length > 0) {
      await userService.updateUserPassword(selectedUser.value.id, { newPassword: newPassword.value })
    }

    await fetchUsers()
    closeModal()
  } catch (err: unknown) {
    modalError.value = err instanceof Error ? err.message : 'No se pudo actualizar el usuario'
    console.error('Error updating user:', err)
  }
}

async function confirmDelete(userId: string) {
  const ok = window.confirm('¿Seguro que quieres eliminar este usuario?')
  if (!ok) return
  try {
    await userService.deleteUser(userId)
    users.value = users.value.filter(u => u.id !== userId)
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'No se pudo eliminar el usuario'
    console.error('Error deleting user:', err)
  }
}

function updateSelectedUser<K extends keyof User>(key: K, value: User[K]) {
  if (selectedUser.value) {
    selectedUser.value[key] = value
  }
}

// Vacaciones
function openVacationModal(u: User) {
  vacError.value = null
  showVacModal.value = true
  vacForm.value = {
    id: u.id,
    name: u.name,
    email: u.email,
    used: used(u),
    currentTotal: total(u),
    newTotal: total(u)
  }
  console.log('[vacModal] open', JSON.parse(JSON.stringify(vacForm.value)))
}

function closeVacModal() {
  showVacModal.value = false
  vacError.value = null
}

async function saveVacationTotal() {
  try {
    savingVac.value = true
    const newTotal = Math.max(0, Math.floor(Number(vacForm.value.newTotal ?? 0)))
    console.log('[saveVacationTotal] START', { id: vacForm.value.id, newTotal })

    await userService.setVacationTotal(vacForm.value.id, { total: newTotal })

    console.log('[saveVacationTotal] OK -> refetch users')
    await fetchUsers()
    closeVacModal()
  } catch (e: unknown) {
    vacError.value = e instanceof Error ? e.message : 'No se pudieron guardar los días'
    console.error('[saveVacationTotal] ERROR', e)
  } finally {
    savingVac.value = false
  }
}
</script>

<style scoped>
.user-management-container { padding: 2rem; max-width: 1200px; margin: 0 auto; }
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
.title { font-size: 1.5rem; font-weight: 600; color: #1a202c; }
.loading-indicator { color: #4a5568; font-size: 0.875rem; }
.error-message { padding: 1rem; background-color: #fff5f5; color: #e53e3e; border-radius: 0.375rem; margin-bottom: 1.5rem; }

.table-container { background-color: white; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; }
.user-table { width: 100%; border-collapse: collapse; }
.user-table th { padding: 1rem; text-align: left; background-color: #f7fafc; color: #4a5568; font-weight: 600; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.05em; }
.user-table td { padding: 1rem; border-top: 1px solid #edf2f7; }
.user-row:hover { background-color: #f8fafc; }

.name-column { width: 26%; }
.email-column { width: 28%; }
.role-column { width: 12%; }
.vac-col { width: 8%; }
.actions-column { width: 18%; }
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

/* Modal */
.modal-overlay { position: fixed; inset: 0; background-color: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal-content { background-color: white; border-radius: 0.5rem; width: 100%; max-width: 520px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
.modal-header { padding: 1.25rem 1.5rem; border-bottom: 1px solid #edf2f7; display: flex; justify-content: space-between; align-items: center; }
.modal-header h3 { font-size: 1.1rem; font-weight: 600; color: #1a202c; }
.close-btn { color: #a0aec0; background: none; border: none; cursor: pointer; padding: 0.25rem; } .close-btn:hover { color: #718096; }
.modal-body { padding: 1.5rem; }
.grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: .75rem; margin-bottom: .75rem; }
.stat { background: #f7fafc; border: 1px solid #edf2f7; padding: .5rem .75rem; border-radius: .375rem; }
.stat.full { grid-column: 1 / -1; }
.stat .label { font-size: .75rem; color: #4a5568; }
.stat .value { font-weight: 600; color: #1a202c; }

.form-group { margin-bottom: 1rem; }
.form-group label { display: block; margin-bottom: 0.5rem; font-size: 0.875rem; font-weight: 500; color: #4a5568; }
.form-group input, .form-group select { width: 100%; padding: 0.625rem; border: 1px solid #e2e8f0; border-radius: 0.375rem; transition: border-color 0.2s; }
.form-group input:focus, .form-group select:focus { outline: none; border-color: #4299e1; box-shadow: 0 0 0 3px rgba(66,153,225,0.2); }
.text-warn { color: #c05621; }

.modal-footer { padding: 1.25rem 1.5rem; border-top: 1px solid #edf2f7; display: flex; justify-content: flex-end; gap: 0.75rem; }
.cancel-btn, .save-btn { padding: 0.625rem 1.25rem; border-radius: 0.375rem; font-weight: 500; transition: all 0.2s; }
.cancel-btn { background-color: #edf2f7; color: #4a5568; } .cancel-btn:hover { background-color: #e2e8f0; }
.save-btn { background-color: #4299e1; color: white; } .save-btn:hover { background-color: #3182ce; }

.modal-error { margin: .75rem 1.5rem 1.25rem; padding: 0.75rem; background-color: #fff5f5; color: #e53e3e; border-radius: 0.375rem; font-size: 0.875rem; }
</style>
