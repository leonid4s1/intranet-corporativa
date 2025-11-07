<template>
  <div class="admin-home">
    <header class="admin-header">
      <h1>Panel de Administración</h1>

      <!-- Usa el botón de marca -->
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

      <router-link to="/admin/vacations" class="admin-card">
        <i class="fas fa-calendar-alt"></i>
        <div class="card-content">
          <h3>Administración de Vacaciones</h3>
          <p>Gestiona solicitudes y días de vacaciones</p>
        </div>
      </router-link>
    </div>

    <!-- Sección de comunicados -->
    <section class="admin-section">
      <div class="section-head">
        <h2>Comunicados</h2>
        <p class="section-subtitle">Publica un comunicado con imagen, fechas y llamada a la acción.</p>
      </div>

      <div class="section-card">
        <AnnouncementForm />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, defineOptions } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import AnnouncementForm from '@/components/admin/AnnouncementForm.vue'

defineOptions({ name: 'AdminHome' })

const auth = useAuthStore()
const loggingOut = ref<boolean>(false)

const handleLogout = async (): Promise<void> => {
  if (loggingOut.value) return
  loggingOut.value = true
  try {
    await auth.logout() // router.replace('/login')
  } finally {
    loggingOut.value = false
  }
}

onMounted((): void => {
  if (typeof document !== 'undefined') {
    document.title = 'Panel de Administración | Intranet'
  }
})
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

/* === Botón de marca (usa reglas .btn de brand.css) === */
.logout-btn {
  /* sin colores locales: hereda background/hover de .btn */
  min-width: 146px;
}
.logout-btn:disabled {
  opacity: .6;
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
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  text-decoration: none;
  color: var(--ink-900, #2c3e50);
  transition: transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease;
  cursor: pointer;
}
.admin-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 10px 24px rgba(0,0,0,0.10);
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
  color: var(--ink, #4B5055);
}
.card-content p {
  margin: 0;
  color: #666;
  font-size: 0.95rem;
}

/* Sección de comunicados */
.admin-section {
  margin-top: 3rem;
}
.section-head {
  display: flex;
  flex-direction: column;
  gap: .25rem;
  margin-bottom: 1rem;
}
.section-head h2 {
  margin: 0;
}
.section-subtitle {
  color: #6b7280;
  font-size: .95rem;
  margin: 0;
}
.section-card {
  background: #fff;
  border: 1px solid var(--gray-300, #e5e7eb);
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  padding: 1.25rem;
}

/* Responsive */
@media (max-width: 768px) {
  .admin-header { flex-direction: column; align-items: flex-start; gap: 1rem; }
  .logout-btn { align-self: flex-end; }
}
@media (max-width: 480px) {
  .admin-options { grid-template-columns: 1fr; }
}
</style>
