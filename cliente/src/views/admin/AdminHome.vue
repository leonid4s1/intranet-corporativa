<template>
  <div class="admin-home">
    <header class="admin-header">
      <h1>Panel de Administración</h1>
      <button @click="handleLogout" class="logout-btn" :disabled="loggingOut">
        {{ loggingOut ? 'Saliendo…' : 'Cerrar sesión' }}
      </button>
    </header>

    <div class="admin-options">
      <router-link to="/admin/roles" class="admin-card">
        <i class="fas fa-user-tag"></i>
        <div class="card-content">
          <h3>Gestión de Roles</h3>
          <p>Administrar los permisos y funciones de los usuarios</p>
        </div>
      </router-link>

      <router-link to="/admin/users" class="admin-card">
        <i class="fas fa-user-cog"></i>
        <div class="card-content">
          <h3>Administrar Usuarios</h3>
          <p>Gestiona cuentas de usuario y accesos</p>
        </div>
      </router-link>

      <!-- Botón que redirige a Administración de Vacaciones -->
      <button
        @click="goToVacations"
        class="admin-card"
        style="cursor: pointer; border: none; background: none; padding: 0;"
      >
        <i class="fas fa-calendar-alt"></i>
        <div class="card-content">
          <h3>Administración de Vacaciones</h3>
          <p>Gestiona solicitudes y días de vacaciones</p>
        </div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, defineOptions } from 'vue';
import { useAuthStore } from '@/stores/auth.store';
import { useRouter } from 'vue-router';

defineOptions({ name: 'AdminHome' });

const auth = useAuthStore();
const router = useRouter();
const loggingOut = ref(false);

const handleLogout = async () => {
  if (loggingOut.value) return;
  loggingOut.value = true;
  try {
    await auth.logout(); // el store hace router.replace('/login')
  } catch {
  } finally {
    loggingOut.value = false;
  }
};


const goToVacations = () => {
  router.push('/admin/vacations');
};

onMounted(() => {
  if (typeof document !== 'undefined') {
    document.title = 'Panel de Administración | Intranet';
  }
});
</script>

<style scoped>
.admin-home {
  padding: 2rem;
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

.logout-btn {
  background-color: #e3342f;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s ease;
  font-size: 0.9rem;
}

.logout-btn:hover {
  background-color: #cc1f1a;
}

.logout-btn:disabled {
  background-color: #e5e7eb;
  color: #6b7280;
  cursor: not-allowed;
}

.admin-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  margin-top: 2rem;
}

.admin-card {
  display: flex;
  align-items: flex-start;
  padding: 1.5rem;
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  text-decoration: none;
  color: #2c3e50;
  transition: all 0.3s ease;
}

.admin-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
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
}

.card-content p {
  margin: 0;
  color: #666;
  font-size: 0.9rem;
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

button.admin-card {
  display: flex;
  align-items: center;
  padding: 1.5rem;
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  color: #2c3e50;
  transition: all 0.3s ease;
  font: inherit; /* para que tome la fuente igual */
}

button.admin-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
}

button.admin-card i {
  font-size: 2rem;
  color: #3498db;
  margin-right: 1.5rem;
  margin-top: 0.3rem;
}

button.admin-card .card-content h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.2rem;
}

button.admin-card .card-content p {
  margin: 0;
  color: #666;
  font-size: 0.9rem;
}
</style>
