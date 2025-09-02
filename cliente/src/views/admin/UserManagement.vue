<!-- src/views/admin/UserManagement.vue -->
<template>
  <div class="user-management-container">
    <div class="header">
      <h2 class="title">Gestion de Usuarios</h2>
      <div v-if="loading" class="loading-indicador">Cargando usuarios...</div>
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
            <th class="actions-column">Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.id" class="user-row">
            <td class="name-cell">
              <div class="user-info">
                <span class="user-name">{{ user.name }}</span>
                <span class="user-status" :class="{ active: user.isActive, inactive: !user.isActive }">
                  {{ user.isActive ? 'Activo' : 'Inactivo' }}
                </span>
                <span v-if="user.email_verified_at" class="verified-badge">Verificado</span>
              </div>
            </td>
            <td class="email-cell">
              {{ user.email }}
            </td>
            <td class="role-cell">
              <span class="role-badge" :class="user.role">
                {{ user.role === 'admin' ? 'Administrador' : 'Usuario' }}
              </span>
            </td>
            <td class="actions-cell">
              <button class="edit-btn" @click="openEditModal(user)">
                <svg class="icon" viewBox="0 0 24 24">
                  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                </svg>
              </button>
              <button class="delete-btn" @click="confirmDelete(user.id)">
                <svg class="icon" viewBox="0 0 24 24">
                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                </svg>
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-else class="empty-state">
        No se encontraron usuarios
      </div>
    </div>

    <!-- Edit User Modal -->
    <div v-if="showEditModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Editar Usuario: {{ selectedUser?.name }}</h3>
          <button class="close-btn" @click="closeModal">
            <svg viewBox="0 0 24 24">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
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
            <input
              type="email"
              :value="selectedUser?.email || ''"
              disabled
            />
          </div>

          <div class="form-group">
            <label>Rol:</label>
            <select
              :value="selectedUser?.role"
              @change="e => updateSelectedUser('role', (e.target as HTMLSelectElement).value)"
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
            <input
              v-model="newPassword"
              type="password"
              placeholder="Deja en blanco para mantener la actual"
            />
          </div>
        </div>

        <div class="modal-footer">
          <button class="cancel-btn" @click="closeModal">Cancelar</button>
          <button class="save-btn" @click="updateUser">Guardar</button>
        </div>

        <div v-if="modalError" class="modal-error">
          {{ modalError }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import  userService  from '@/services/user.service';
import axios, { type AxiosError, type AxiosResponse } from 'axios';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  email_verified_at?: string | null;
  isActive: boolean;
}

const users = ref<User[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

const showEditModal = ref(false);
const selectedUser = ref<User | null>(null);
const newPassword = ref('');

const modalError = ref<string | null>(null);

onMounted(async () => {
  await fetchUsers();
});

const fetchUsers = async () => {
  loading.value = true;
  error.value = null;

  try {
    const data = await userService.getAllUsers();
    users.value = data;
  } catch (err: unknown) { // Explicitamos que err es unknown
    // Verificación segura del tipo de error
    if (err instanceof Error) {
      error.value = err.message;
    } else if (typeof err === 'string') {
      error.value = err;
    } else {
      error.value = 'Error desconocido al cargar usuarios';
    }

    // Debugging detallado
    console.error('Error fetching users:', {
      error: err,
      isAxiosError: axios.isAxiosError(err),
      responseData: axios.isAxiosError(err) ? err.response?.data : null
    });
  } finally {
    loading.value = false;
  }
};

const openEditModal = (user: User) => {
  selectedUser.value = { ...user };
  newPassword.value = '';
  modalError.value = null;
  showEditModal.value = true;
};

const closeModal = () => {
  showEditModal.value = false;
  selectedUser.value = null;
  newPassword.value = '';
  modalError.value = null;
};

const updateUser = async () => {
  if (!selectedUser.value) return;

  modalError.value = null;

  try {
    // Actualizar nombre
    await userService.updateUserName(selectedUser.value.id, { name: selectedUser.value.name });

    // Actualizar rol
   // await userService.updateUserRole(selectedUser.value.id, selectedUser.value.role);

    // Bloquear/desbloquear usuario si cambió estado
    const currentUser = users.value.find(u => u.id === selectedUser.value?.id);
    if (currentUser && selectedUser.value.isActive !== currentUser.isActive) {
      await userService.toggleUserLock(selectedUser.value.id);
    }

    // Cambiar contraseña solo si el campo tiene texto
    if (newPassword.value.trim().length > 0) {
      await userService.updateUserPassword(selectedUser.value.id, { newPassword: newPassword.value });
    }

    await fetchUsers();
    closeModal();
  } catch (err: any) {
    modalError.value = err.response?.data?.message || 'Failed to update user';
    console.error('Error updating user:', err);
  }
};

const confirmDelete = async (userId: string) => {
  if (confirm('Are you sure you want to delete this user?')) {
    try {
      await userService.deleteUser(userId);
      users.value = users.value.filter(user => user.id !== userId);
    } catch (err: any) {
      error.value = err.response?.data?.message || 'Failed to delete user';
      console.error('Error deleting user:', err);
    }
  }
};

function updateSelectedUser<K extends keyof User>(key: K, value: User[K]) {
  if (selectedUser.value) {
    selectedUser.value[key] = value;
  }
}
</script>

<style scoped>
.user-management-container {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1a202c;
}

.loading-indicator {
  color: #4a5568;
  font-size: 0.875rem;
}

.error-message {
  padding: 1rem;
  background-color: #fff5f5;
  color: #e53e3e;
  border-radius: 0.375rem;
  margin-bottom: 1.5rem;
}

.table-container {
  background-color: white;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.user-table {
  width: 100%;
  border-collapse: collapse;
}

.user-table th {
  padding: 1rem;
  text-align: left;
  background-color: #f7fafc;
  color: #4a5568;
  font-weight: 600;
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
}

.user-table td {
  padding: 1rem;
  border-top: 1px solid #edf2f7;
}

.user-row:hover {
  background-color: #f8fafc;
}

.name-column {
  width: 30%;
}
.email-column {
  width: 40%;
}
.role-column {
  width: 15%;
}
.actions-column {
  width: 15%;
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.user-name {
  font-weight: 500;
  color: #1a202c;
}

.user-status {
  font-size: 0.75rem;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  display: inline-block;
  width: fit-content;
}

.user-status.active {
  background-color: #f0fff4;
  color: #38a169;
}

.user-status.inactive {
  background-color: #fff5f5;
  color: #e53e3e;
}

.verified-badge {
  font-size: 0.75rem;
  color: #4299e1;
  background-color: #ebf8ff;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  display: inline-block;
  width: fit-content;
}

.role-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 500;
}

.role-badge.admin {
  background-color: #ebf4ff;
  color: #667eea;
}

.role-badge.user {
  background-color: #f0fff4;
  color: #48bb78;
}

.actions-cell {
  display: flex;
  gap: 0.5rem;
}

.edit-btn, .delete-btn {
  padding: 0.5rem;
  border-radius: 0.375rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.edit-btn {
  color: #4299e1;
  background-color: #ebf8ff;
}

.edit-btn:hover {
  background-color: #bee3f8;
}

.delete-btn {
  color: #f56565;
  background-color: #fff5f5;
}

.delete-btn:hover {
  background-color: #fed7d7;
}

.icon {
  width: 1.25rem;
  height: 1.25rem;
  fill: currentColor;
}

.empty-state {
  padding: 2rem;
  text-align: center;
  color: #718096;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background-color: white;
  border-radius: 0.5rem;
  width: 100%;
  max-width: 500px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
}

.modal-header {
  padding: 1.5rem;
  border-bottom: 1px solid #edf2f7;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1a202c;
}

.close-btn {
  color: #a0aec0;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.25rem;
}

.close-btn:hover {
  color: #718096;
}

.modal-body {
  padding: 1.5rem;
}

.form-group {
  margin-bottom: 1.25rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #4a5568;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 0.625rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  transition: border-color 0.2s;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #4299e1;
  box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.2);
}

.modal-footer {
  padding: 1.5rem;
  border-top: 1px solid #edf2f7;
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

.cancel-btn, .save-btn {
  padding: 0.625rem 1.25rem;
  border-radius: 0.375rem;
  font-weight: 500;
  transition: all 0.2s;
}

.cancel-btn {
  background-color: #edf2f7;
  color: #4a5568;
}

.cancel-btn:hover {
  background-color: #e2e8f0;
}

.save-btn {
  background-color: #4299e1;
  color: white;
}

.save-btn:hover {
  background-color: #3182ce;
}

.modal-error {
  margin-top: 1rem;
  padding: 0.75rem;
  background-color: #fff5f5;
  color: #e53e3e;
  border-radius: 0.375rem;
  font-size: 0.875rem;
}
</style>
