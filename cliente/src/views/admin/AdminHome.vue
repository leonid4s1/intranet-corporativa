<template>
  <AdminLayout>
    <div class="admin-home">
      <header class="admin-header">
        <h1>Panel de Administración</h1>

        <button
          @click="handleLogout"
          class="btn logout-btn"
          :disabled="loggingOut"
          type="button"
        >
          {{ loggingOut ? 'Saliendo…' : 'Cerrar sesión' }}
        </button>
      </header>

      <div class="admin-options">
        <router-link to="/admin/users" class="admin-card">
          <i class="fas fa-user-cog"></i>
          <div class="card-content">
            <h3>Administrar Usuarios</h3>
            <p>Gestiona cuentas de usuario y accesos</p>
          </div>
        </router-link>

        <router-link to="/admin/vacations" class="admin-card">
          <i class="fas fa-calendar-alt"></i>
          <div class="card-content">
            <h3>Administración de Vacaciones</h3>
            <p>Gestiona solicitudes y días de vacaciones</p>
          </div>
        </router-link>

        <router-link to="/admin/announcements" class="admin-card">
          <i class="fas fa-bullhorn"></i>
          <div class="card-content">
            <h3>Comunicados</h3>
            <p>Publica y gestiona comunicados de la empresa</p>
          </div>
        </router-link>
      </div>
    </div>
  </AdminLayout>
</template>

<script setup lang="ts">
import { ref, onMounted, defineOptions } from 'vue';
import { useAuthStore } from '@/stores/auth.store';
import AdminLayout from '@/layouts/AdminLayout.vue';

defineOptions({ name: 'AdminHome' });

const auth = useAuthStore();
const loggingOut = ref<boolean>(false);

const handleLogout = async (): Promise<void> => {
  if (loggingOut.value) return;
  loggingOut.value = true;
  try {
    await auth.logout();
  } finally {
    loggingOut.value = false;
  }
};

onMounted((): void => {
  if (typeof document !== 'undefined') {
    document.title = 'Panel de Administración | Intranet';
  }
});
</script>

<style scoped>
.admin-home {
  max-width: 1200px;
  margin: 0 auto;
}

.admin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.admin-header h1 {
  margin: 0;
}

/* Botón de marca */
.logout-btn {
  min-width: 146px;
}
.logout-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* Grid de opciones */
.admin-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  margin-top: 2rem;
}

/* Tarjetas */
.admin-card {
  display: flex;
  align-items: flex-start;
  width: 100%;
  padding: 1.5rem;
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid var(--gray-300, #e5e7eb);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  text-decoration: none;
  color: var(--ink-900, #2c3e50);
  transition:
    transform 0.12s ease,
    box-shadow 0.12s ease,
    border-color 0.12s ease;
  cursor: pointer;
}
.admin-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.1);
  border-color: var(--gray-400, #cdcdcd);
}
.admin-card i {
  font-size: 2rem;
  color: #3498db;
  margin-right: 1.5rem;
  margin-top: 0.3rem;
}
.card-content h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--ink, #4b5055);
}
.card-content p {
  margin: 0;
  color: #666;
  font-size: 0.95rem;
}

/* Responsive */
@media (max-width: 768px) {
  .admin-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
  .logout-btn {
    align-self: flex-end;
  }
}
@media (max-width: 480px) {
  .admin-options {
    grid-template-columns: 1fr;
  }
}
</style>
