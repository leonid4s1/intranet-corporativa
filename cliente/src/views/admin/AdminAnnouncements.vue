<template>
  <AdminLayout>
    <div class="admin-announcements page">
      <header class="page-head">
        <div>
          <h1>Comunicados</h1>
          <p class="sub">
            Publica un comunicado con imagen, fechas y llamada a la acción.
          </p>
        </div>
        <router-link class="btn" :to="{ name: 'admin-home' }">
          ← Volver al panel
        </router-link>
      </header>

      <!-- ================== FORMULARIO (RETRÁCTIL) ================== -->
      <section class="card">
        <header class="section-head">
          <h2 class="section-title">Publicar comunicado</h2>
          <button
            type="button"
            class="btn btn-secondary btn-toggle"
            @click="toggleForm"
          >
            {{ showForm ? 'Ocultar formulario' : 'Mostrar formulario' }}
          </button>
        </header>

        <transition name="collapse">
          <div v-if="showForm" class="form-body">
            <!-- 👇 aquí va el cambio: ocultamos el título interno del form -->
            <AnnouncementForm :show-title="false" />
          </div>
        </transition>
      </section>

      <!-- ================== LISTADO ADMIN ================== -->
      <section class="card list-card">
        <header class="list-head">
          <h2 class="section-title">Comunicados existentes</h2>
          <button
            type="button"
            class="btn btn-secondary"
            @click="reload"
            :disabled="loading"
          >
            {{ loading ? 'Actualizando…' : 'Actualizar' }}
          </button>
        </header>

        <div v-if="loading" class="table-wrap">
          <p>Cargando comunicados…</p>
        </div>

        <div v-else-if="announcements.length" class="table-wrap">
          <table class="simple-table">
            <thead>
              <tr>
                <th>Título</th>
                <th>Visible desde</th>
                <th>Visible hasta</th>
                <th>Estado</th>
                <th class="col-actions">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in announcements" :key="item.id">
                <td>
                  <div class="title-cell">
                    <strong>{{ item.title }}</strong>
                    <small v-if="item.excerpt" class="excerpt">
                      {{ item.excerpt }}
                    </small>
                  </div>
                </td>
                <td>{{ formatDate(item.visibleFrom) }}</td>
                <td>{{ formatDate(item.visibleUntil) }}</td>
                <td>
                  <span
                    class="status-pill"
                    :class="item.published ? 'is-published' : 'is-unpublished'"
                  >
                    {{ item.published ? 'Publicado' : 'No publicado' }}
                  </span>
                </td>
                <td class="col-actions">
                  <button
                    type="button"
                    class="btn xs"
                    @click="togglePublished(item)"
                  >
                    {{
                      item.published
                        ? 'Marcar como borrador'
                        : 'Publicar ahora'
                    }}
                  </button>
                  <button
                    type="button"
                    class="btn xs btn-danger"
                    @click="confirmDelete(item)"
                  >
                    Quitar
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else class="empty-state">
          <p>No hay comunicados registrados todavía.</p>
        </div>
      </section>
    </div>
  </AdminLayout>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import AnnouncementForm from '@/components/admin/AnnouncementForm.vue';
import AdminLayout from '@/layouts/AdminLayout.vue';
import {
  fetchAdminAnnouncements,
  updateAnnouncement,
  deleteAnnouncement,
  type AdminAnnouncement,
} from '@/services/news.service';

defineOptions({ name: 'AdminAnnouncements' });

const announcements = ref<AdminAnnouncement[]>([]);
const loading = ref(false);
const showForm = ref(false);

function formatDate(value?: string): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-MX');
}

async function loadAnnouncements(): Promise<void> {
  loading.value = true;
  try {
    // true => ignora ventana de visibilidad, trae todos los announcements
    announcements.value = await fetchAdminAnnouncements(true);
  } finally {
    loading.value = false;
  }
}

async function reload(): Promise<void> {
  await loadAnnouncements();
}

function toggleForm(): void {
  showForm.value = !showForm.value;
}

async function togglePublished(item: AdminAnnouncement): Promise<void> {
  const makeDraft = item.published;

  const payload = makeDraft
    ? { status: 'draft', isActive: false }
    : { status: 'published', isActive: true };

  try {
    await updateAnnouncement(item.id, payload);
    await loadAnnouncements();
  } catch {
    // el servicio ya hace console.error
  }
}

async function confirmDelete(item: AdminAnnouncement): Promise<void> {
  const ok = window.confirm(
    `¿Seguro que quieres quitar el comunicado "${item.title}"?`
  );
  if (!ok) return;

  try {
    await deleteAnnouncement(item.id);
    await loadAnnouncements();
  } catch {
    // ya logueado en el servicio
  }
}

onMounted(() => {
  if (typeof document !== 'undefined') {
    document.title = 'Comunicados | Intranet';
  }
  void loadAnnouncements();
});
</script>

<style scoped>
.page {
  padding: 2rem;
  max-width: 1100px;
  margin: 0 auto;
}

.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.page-head h1 {
  margin: 0;
}

.sub {
  margin: 0.25rem 0 0;
  color: #6b7280;
}

.card {
  padding: 1.25rem;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.section-title {
  margin: 0;
}

.btn {
  background: #111;
  color: #fff;
  padding: 8px 14px;
  border-radius: 10px;
  text-decoration: none;
  border: none;
  cursor: pointer;
  font-size: 0.875rem;
}

.btn-secondary {
  background: #f3f4f6;
  color: #111827;
}

.btn.xs {
  padding: 4px 8px;
  font-size: 0.75rem;
  border-radius: 8px;
}

.btn-danger {
  background: #fee2e2;
  color: #b91c1c;
}

.btn-toggle {
  font-size: 0.75rem;
  padding-inline: 10px;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.form-body {
  margin-top: 0.25rem;
}

.list-card {
  margin-top: 1.5rem;
}

.list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.table-wrap {
  overflow-x: auto;
}

.simple-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.simple-table th,
.simple-table td {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid #e5e7eb;
  text-align: left;
  vertical-align: top;
}

.simple-table th {
  font-weight: 600;
  color: #4b5563;
}

.col-actions {
  white-space: nowrap;
  text-align: right;
}

.title-cell {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.excerpt {
  color: #6b7280;
  font-size: 0.75rem;
}

.status-pill {
  display: inline-flex;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.status-pill.is-published {
  background-color: rgba(34, 197, 94, 0.15);
  color: #16a34a;
}

.status-pill.is-unpublished {
  background-color: rgba(148, 163, 184, 0.2);
  color: #4b5563;
}

.empty-state {
  padding: 0.5rem 0;
  color: #6b7280;
}

/* Animación simple de plegado */
.collapse-enter-active,
.collapse-leave-active {
  transition: max-height 0.18s ease, opacity 0.18s ease;
}
.collapse-enter-from,
.collapse-leave-to {
  max-height: 0;
  opacity: 0;
}
.collapse-enter-to,
.collapse-leave-from {
  max-height: 1000px;
  opacity: 1;
}
</style>
