<template>
  <div class="admin-vacations">
    <h1>Administración de Vacaciones</h1>

    <!-- ========= DÍAS FESTIVOS ========= -->
    <section class="card">
      <div class="card-head">
        <h2>Días Festivos</h2>

        <div class="head-actions">
          <button class="btn primary" @click="openHolidayModal">Agregar Festivo</button>

          <label class="year-filter">
            Filtrar por año:
            <select v-model="selectedYear" @change="loadHolidays">
              <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}</option>
            </select>
          </label>
        </div>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>NOMBRE</th>
              <th>FECHA</th>
              <th>TIPO</th>
              <th class="center">ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loadingHolidays">
              <td colspan="4" class="muted center">Cargando festivos…</td>
            </tr>
            <tr v-else-if="holidays.length === 0">
              <td colspan="4" class="muted center">No hay festivos para {{ selectedYear }}</td>
            </tr>
            <tr v-else v-for="h in holidays" :key="h.date + h.name">
              <td>{{ h.name }}</td>
              <td>{{ formatDate(h.date) }}</td>
              <td>
                <span class="badge">Único</span>
              </td>
              <td class="center">
                <button class="btn warn sm" title="Editar" @click="editHoliday(h)">■</button>
                <button
                  class="btn danger sm"
                  title="Eliminar"
                  :disabled="isDeletingHoliday(h)"
                  @click="deleteHoliday(h)"
                >
                  ✖
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- ========= SOLICITUDES PENDIENTES ========= -->
    <section class="card">
      <div class="card-head">
        <h2>Solicitudes Pendientes</h2>
        <button class="btn" :disabled="loadingPending" @click="loadPending">
          {{ loadingPending ? 'Actualizando…' : 'Actualizar' }}
        </button>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>USUARIO</th>
              <th>FECHAS</th>
              <th>MOTIVO</th>
              <th>DÍAS</th>
              <th>ESTADO</th>
              <th class="center">ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loadingPending">
              <td colspan="6" class="muted center">Cargando solicitudes…</td>
            </tr>
            <tr v-else-if="pendingRequests.length === 0">
              <td colspan="6" class="muted center">No hay solicitudes pendientes</td>
            </tr>
            <tr v-else v-for="r in pendingRequests" :key="r.id">
              <td>
                <div class="user-cell">
                  <div class="name">{{ r.user?.name || 'Usuario' }}</div>
                  <div class="email" v-if="r.user?.email">{{ r.user.email }}</div>
                </div>
              </td>
              <td>{{ formatDate(r.startDate) }} - {{ formatDate(r.endDate) }}</td>
              <td class="wrap">{{ r.reason?.trim() || '—' }}</td>
              <td class="center">{{ r.daysRequested ?? spanDays(r.startDate, r.endDate) }}</td>
              <td>
                <span class="badge warn">Pendiente</span>
              </td>
              <td class="center">
                <button
                  class="btn success"
                  :disabled="isActionLoading === r.id"
                  @click="approveRequest(r.id)"
                >
                  {{ isActionLoading === r.id ? 'Aprobando…' : 'Aprobar' }}
                </button>
                <button
                  class="btn danger"
                  :disabled="isActionLoading === r.id"
                  @click="openRejectDialog(r.id)"
                >
                  Rechazar
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- ========= DIÁLOGO RECHAZO ========= -->
    <div v-if="reject.open" class="modal-backdrop" @click.self="closeRejectDialog">
      <div class="modal">
        <h3>Motivo de rechazo</h3>
        <p class="muted">Este motivo será visible para el usuario.</p>
        <textarea
          v-model="reject.text"
          rows="4"
          placeholder="Escribe el motivo del rechazo…"
        ></textarea>
        <div class="modal-actions">
          <button class="btn" @click="closeRejectDialog" :disabled="reject.loading">Cancelar</button>
          <button class="btn danger" @click="confirmReject" :disabled="reject.loading || !reject.text.trim()">
            {{ reject.loading ? 'Rechazando…' : 'Rechazar solicitud' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Alertas -->
    <AlertDialog
      v-if="alert.visible"
      :type="alert.type"
      :message="alert.message"
      @close="alert.visible = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import dayjs from 'dayjs';
import vacationService from '@/services/vacation.service';
import holidayService from '@/services/holiday.service';
import AlertDialog from '@/components/ui/AlertDialog.vue';

/* ========= STATE ========= */
type ID = string;

interface UserRef {
  id: ID;
  name: string;
  email?: string;
}

interface VacationRequest {
  id: ID;
  user: UserRef;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  reason?: string;         // <- MOTIVO del solicitante
  daysRequested?: number;  // <- si viene del backend, úsalo
}

interface Holiday {
  date: string; // YYYY-MM-DD
  name: string;
}

const pendingRequests = ref<VacationRequest[]>([]);
const loadingPending = ref<boolean>(false);
const isActionLoading = ref<string | null>(null);

const selectedYear = ref<number>(new Date().getFullYear());
const yearOptions = computed(() => {
  const y = new Date().getFullYear();
  return [y - 1, y, y + 1];
});

const holidays = ref<Holiday[]>([]);
const loadingHolidays = ref<boolean>(false);
const deletingHolidayKey = ref<string | null>(null);

/* ========= DIÁLOGO DE RECHAZO ========= */
const reject = ref<{ open: boolean; id: string | null; text: string; loading: boolean }>({
  open: false,
  id: null,
  text: '',
  loading: false
});

/* ========= ALERTAS ========= */
const alert = ref<{ visible: boolean; type: 'success' | 'error' | 'warning' | 'info'; message: string }>({
  visible: false,
  type: 'info',
  message: '',
});
function showAlert(type: 'success' | 'error' | 'warning' | 'info', message: string) {
  alert.value = { visible: true, type, message };
  setTimeout(() => (alert.value.visible = false), 4000);
}

/* ========= HELPERS ========= */
function formatDate(ymd: string): string {
  return dayjs(ymd).format('DD/MM/YYYY');
}
function spanDays(start: string, end: string): number {
  // Diferencia natural (incluye ambos extremos)
  return dayjs(end).diff(dayjs(start), 'day') + 1;
}
function getErrMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  try { return JSON.stringify(err); } catch { return 'Error desconocido'; }
}

/* ========= LOADERS ========= */
async function loadPending() {
  try {
    loadingPending.value = true;
    // El servicio ya trae reason y daysRequested si el backend los envía
    const list = await vacationService.getPendingRequests();
    // Adaptar a nuestro tipo local (ya coinciden las propiedades)
    pendingRequests.value = list as unknown as VacationRequest[];
  } catch (err) {
    console.error('Error cargando pendientes:', err);
    showAlert('error', getErrMsg(err));
  } finally {
    loadingPending.value = false;
  }
}

async function loadHolidays() {
  const start = `${selectedYear.value}-01-01`;
  const end = `${selectedYear.value}-12-31`;
  try {
    loadingHolidays.value = true;
    holidays.value = await holidayService.getHolidays(start, end);
  } catch (err) {
    console.error('Error cargando festivos:', err);
    showAlert('error', getErrMsg(err));
  } finally {
    loadingHolidays.value = false;
  }
}

/* ========= ACCIONES ADMIN ========= */
async function approveRequest(id: string) {
  try {
    isActionLoading.value = id;
    await vacationService.updateRequestStatus({ id, status: 'approved' });
    showAlert('success', 'Solicitud aprobada');
    await loadPending();
  } catch (err) {
    console.error('Error aprobando solicitud:', err);
    showAlert('error', getErrMsg(err));
  } finally {
    isActionLoading.value = null;
  }
}

function openRejectDialog(id: string) {
  reject.value = { open: true, id, text: '', loading: false };
}

function closeRejectDialog() {
  if (reject.value.loading) return;
  reject.value.open = false;
  reject.value.id = null;
  reject.value.text = '';
}

async function confirmReject() {
  const id = reject.value.id;
  const text = reject.value.text.trim();
  if (!id || !text) return;

  try {
    reject.value.loading = true;
    isActionLoading.value = id;
    // Enviamos como rejectReason (el backend lo espera con ese nombre)
    await vacationService.updateRequestStatus({ id, status: 'rejected', reason: text });
    showAlert('success', 'Solicitud rechazada');
    closeRejectDialog();
    await loadPending();
  } catch (err) {
    console.error('Error rechazando solicitud:', err);
    showAlert('error', getErrMsg(err));
  } finally {
    reject.value.loading = false;
    isActionLoading.value = null;
  }
}

/* ========= FESTIVOS (CRUD BÁSICO) ========= */
function openHolidayModal() {
  showAlert('info', 'Implementa tu modal para crear festivo (openHolidayModal).');
}

function editHoliday(h: Holiday) {
  showAlert('info', `Implementa tu modal para editar festivo: ${h.name}`);
}

function isDeletingHoliday(h: Holiday): boolean {
  return deletingHolidayKey.value === `${h.date}-${h.name}`;
}

async function deleteHoliday(h: Holiday) {
  const key = `${h.date}-${h.name}`;
  const ok = window.confirm(`¿Eliminar festivo "${h.name}" del ${formatDate(h.date)}?`);
  if (!ok) return;

  try {
    deletingHolidayKey.value = key;
    // Si tu holidayService tiene deleteHoliday(date) o deleteHolidayById(id), úsalo:
    await holidayService.deleteHoliday?.(h.date);
    showAlert('success', 'Festivo eliminado');
    await loadHolidays();
  } catch (err) {
    console.error('Error eliminando festivo:', err);
    showAlert('error', getErrMsg(err));
  } finally {
    deletingHolidayKey.value = null;
  }
}

/* ========= INIT ========= */
onMounted(async () => {
  await Promise.all([loadPending(), loadHolidays()]);
});
</script>

<style scoped>
.admin-vacations {
  padding: 16px;
}

h1 {
  margin: 0 0 16px 0;
}

.card {
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0,0,0,.06);
  padding: 14px;
  margin: 16px 0;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.card-head h2 { margin: 0; }

.head-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.year-filter { font-size: .95rem; }

.table-wrap { overflow: auto; }

table { width: 100%; border-collapse: collapse; }

thead th {
  text-align: left;
  font-weight: 600;
  color: #333;
  border-bottom: 1px solid #eee;
  padding: 10px 8px;
}

tbody td {
  border-bottom: 1px solid #f2f2f2;
  padding: 10px 8px;
  vertical-align: middle;
}

.wrap {
  max-width: 360px;
  white-space: normal;
  word-break: break-word;
}

.center { text-align: center; }
.muted { color: #6b7280; }

.user-cell .name { font-weight: 600; }
.user-cell .email { font-size: .85rem; color: #6b7280; }

/* Botones */
.btn {
  background: #e5e7eb;
  color: #111827;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 8px 12px;
  cursor: pointer;
}
.btn:hover { background: #dfe3e7; }
.btn:disabled { opacity: .6; cursor: not-allowed; }

.btn.primary { background: #2563eb; color: #fff; border-color: #1d4ed8; }
.btn.primary:hover { background: #1d4ed8; }

.btn.success { background: #22c55e; color: #fff; border-color: #16a34a; margin-right: 8px; }
.btn.success:hover { background: #16a34a; }

.btn.warn { background: #f59e0b; color: #fff; border-color: #d97706; margin-right: 6px; }
.btn.warn:hover { background: #d97706; }

.btn.danger { background: #ef4444; color: #fff; border-color: #dc2626; }
.btn.danger:hover { background: #dc2626; }

.btn.sm { padding: 4px 8px; border-radius: 6px; font-size: .85rem; }

/* Badges */
.badge {
  display: inline-block;
  font-size: .8rem;
  padding: 4px 8px;
  border-radius: 999px;
  background: #e5e7eb;
  color: #111827;
}

.badge.warn { background: #fff9c4; color: #9a6700; }

/* ===== Modal ===== */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, .45);
  display: grid;
  place-items: center;
  z-index: 50;
}
.modal {
  width: min(560px, calc(100% - 32px));
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 10px 30px rgba(0,0,0,.2);
}
.modal h3 { margin: 0 0 8px 0; }
.modal p  { margin: 0 0 12px 0; }
.modal textarea {
  width: 100%;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 10px;
  font-family: inherit;
  resize: vertical;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}
</style>
