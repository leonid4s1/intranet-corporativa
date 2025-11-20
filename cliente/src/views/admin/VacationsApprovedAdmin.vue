<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import AdminLayout from '@/layouts/AdminLayout.vue';
import {
  getApprovedAdmin,
  type UserStatusFilter,
  type AdminApprovedRow,
} from '@/services/vacation.service';

const loading = ref(false);
const errorMsg = ref('');
const rows = ref<AdminApprovedRow[]>([]);

// Filtros
const q = ref('');
const from = ref('');
const to = ref('');
const userStatus = ref<UserStatusFilter | ''>('');

async function fetchData() {
  loading.value = true;
  errorMsg.value = '';
  try {
    rows.value = await getApprovedAdmin({
      q: q.value || undefined,
      from: from.value || undefined,
      to: to.value || undefined,
      userStatus: (userStatus.value ||
        undefined) as UserStatusFilter | undefined,
    });
  } catch (e: unknown) {
    const err = e as {
      response?: { data?: { error?: string } };
      message?: string;
    };
    errorMsg.value =
      err?.response?.data?.error ??
      err?.message ??
      'Error cargando datos';
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  q.value = '';
  from.value = '';
  to.value = '';
  userStatus.value = '';
  fetchData();
}

function exportCSV() {
  const header = [
    'Nombre',
    'Email',
    'EstadoUsuario',
    'Inicio',
    'Fin',
    'Dias',
    'Creado',
  ].join(',');
  const csv = rows.value.map((r) =>
    [
      `"${r.displayName.replace(/"/g, '""')}"`,
      `"${(r.displayEmail ?? '').replace(/"/g, '""')}"`,
      r.userStatus,
      r.startDate,
      r.endDate,
      r.totalDays,
      r.createdAt ?? '',
    ].join(',')
  );
  const blob = new Blob([header + '\n' + csv.join('\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vacaciones_aprobadas_${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const total = computed(() => rows.value.length);
onMounted(fetchData);
</script>

<template>
  <AdminLayout>
    <div class="approved-page">
      <!-- CABECERA -->
      <header class="approved-head">
        <div>
          <h1 class="approved-title">Vacaciones aprobadas (Admin)</h1>
          <p class="approved-subtitle">
            Consulta, filtra y exporta el histórico de vacaciones aprobadas por
            la administración.
          </p>
        </div>

        <div class="head-actions">
          <button type="button" class="btn btn-ghost" @click="exportCSV">
            Exportar CSV
          </button>
          <button type="button" class="btn btn-primary" @click="fetchData">
            Refrescar
          </button>
        </div>
      </header>

      <!-- FILTROS -->
      <section class="card filters-card">
        <div class="filters-bar">
          <input
            v-model="q"
            class="field"
            placeholder="Buscar nombre o email"
          />
          <input v-model="from" type="date" class="field" />
          <input v-model="to" type="date" class="field" />

          <select v-model="userStatus" class="field">
            <option value="">Estado usuario (todos)</option>
            <option value="Activo">Activo</option>
            <option value="Inactivo">Inactivo</option>
            <option value="Eliminado">Eliminado</option>
          </select>

          <div class="filters-actions">
            <button type="button" class="btn btn-primary" @click="fetchData">
              Aplicar
            </button>
            <button type="button" class="btn btn-ghost" @click="resetFilters">
              Limpiar
            </button>
          </div>
        </div>
      </section>

      <!-- TABLA -->
      <section class="card table-card">
        <p v-if="errorMsg" class="error-text">
          {{ errorMsg }}
        </p>
        <p v-else class="results-count">Resultados: {{ total }}</p>

        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Estado</th>
                <th>Inicio</th>
                <th>Fin</th>
                <th>Días</th>
                <th>Creado</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="7" class="loading-cell">Cargando…</td>
              </tr>

              <tr
                v-for="r in rows"
                :key="r.id"
              >
                <td class="cell-name">
                  {{ r.displayName }}
                </td>
                <td>
                  {{ r.displayEmail || '—' }}
                </td>
                <td>
                  <span
                    class="status-pill"
                    :class="{
                      'is-active': r.userStatus === 'Activo',
                      'is-inactive': r.userStatus === 'Inactivo',
                      'is-deleted': r.userStatus === 'Eliminado'
                    }"
                  >
                    {{ r.userStatus }}
                  </span>
                </td>
                <td>{{ r.startDate }}</td>
                <td>{{ r.endDate }}</td>
                <td>{{ r.totalDays }}</td>
                <td>{{ r.createdAt?.slice(0, 10) || '—' }}</td>
              </tr>

              <tr v-if="!loading && !rows.length">
                <td colspan="7" class="empty-cell">
                  No hay resultados.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </AdminLayout>
</template>

<style scoped>
.approved-page {
  background: #f3f4f6;
  min-height: 100vh;
  padding: 24px 24px 32px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* CABECERA */
.approved-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.approved-title {
  margin: 0;
  font-size: 2rem;
  font-weight: 700;
  color: #111827;
}

.approved-subtitle {
  margin: 4px 0 0;
  font-size: 0.9rem;
  color: #6b7280;
}

.head-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* BOTONES GENÉRICOS */
.btn {
  border-radius: 999px;
  padding: 8px 14px;
  font-size: 0.875rem;
  border: none;
  cursor: pointer;
  transition:
    background 0.15s ease-out,
    transform 0.1s ease-out,
    box-shadow 0.15s ease-out;
}

.btn:hover {
  transform: translateY(-1px);
}

.btn-primary {
  background: #2563eb;
  color: #f9fafb;
  box-shadow: 0 10px 15px -5px rgba(37, 99, 235, 0.4);
}

.btn-primary:hover {
  background: #1d4ed8;
}

.btn-ghost {
  background: #e5e7eb;
  color: #111827;
}

.btn-ghost:hover {
  background: #d1d5db;
}

/* TARJETAS */
.card {
  background: #ffffff;
  border-radius: 16px;
  box-shadow:
    0 20px 25px -5px rgba(15, 23, 42, 0.1),
    0 10px 10px -5px rgba(15, 23, 42, 0.04);
}

.filters-card {
  padding: 12px 16px;
}

.table-card {
  padding: 16px 20px 20px;
}

/* FILTROS */
.filters-bar {
  display: grid;
  grid-template-columns: minmax(0, 2fr) repeat(2, minmax(0, 1fr)) minmax(
      0,
      1.2fr
    ) auto;
  gap: 8px;
  align-items: center;
}

.field {
  min-height: 36px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid #d1d5db;
  font-size: 0.875rem;
  outline: none;
}

.field:focus {
  border-color: #f97316;
  box-shadow: 0 0 0 1px rgba(249, 115, 22, 0.4);
}

.filters-actions {
  display: flex;
  gap: 8px;
}

/* TABLA */
.results-count {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0 0 8px;
}

.error-text {
  margin: 0 0 8px;
  font-size: 0.9rem;
  color: #b91c1c;
}

.table-wrapper {
  width: 100%;
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

thead {
  background: #f9fafb;
}

th,
td {
  padding: 10px 8px;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
}

th {
  font-weight: 600;
  color: #4b5563;
}

tbody tr:nth-child(even) {
  background: #f9fafb;
}

tbody tr:hover {
  background: #eef2ff;
}

.cell-name {
  font-weight: 600;
}

/* estados */
.status-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.status-pill.is-active {
  background: #dcfce7;
  color: #166534;
}

.status-pill.is-inactive {
  background: #e5e7eb;
  color: #374151;
}

.status-pill.is-deleted {
  background: #fee2e2;
  color: #b91c1c;
}

.loading-cell,
.empty-cell {
  padding: 16px;
  text-align: center;
}

.empty-cell {
  color: #6b7280;
}

/* RESPONSIVE */
@media (max-width: 960px) {
  .approved-page {
    padding: 16px 12px 24px;
  }

  .approved-head {
    flex-direction: column;
    align-items: stretch;
  }

  .filters-bar {
    grid-template-columns: 1fr;
  }
}
</style>
