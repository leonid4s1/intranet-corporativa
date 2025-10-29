<template>
  <div class="admin-vacations">
    <div class="page-head">
      <h1>Administración de Vacaciones</h1>
      <router-link
        :to="{ name: 'vacations-approved-admin' }"
        class="btn primary"
      >
        Ver aprobadas
      </router-link>
    </div>

    <!-- ========= SOLICITUDES PENDIENTES (AHORA ARRIBA) ========= -->
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

    <!-- ========= DÍAS FESTIVOS (AHORA ABAJO) ========= -->
    <section class="card">
      <div class="card-head">
        <h2>Días Festivos</h2>

        <div class="head-actions">
          <button class="btn primary" @click="openHolidayModal()">Agregar Festivo</button>

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
            <tr v-else v-for="h in holidays" :key="h.id">
              <td class="wrap">{{ h.name }}</td>
              <td>{{ formatDate(h.date) }}</td>
              <td>
                <span class="badge" :class="{ recurrent: h.recurring }">
                  {{ h.recurring ? 'Recurrente' : 'Único' }}
                </span>
              </td>
              <td class="center">
                <button class="btn warn sm" title="Editar" @click="openHolidayModal(h)">✎</button>
                <button
                  class="btn danger sm"
                  title="Eliminar"
                  :disabled="deletingHolidayKey === h.id"
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

    <!-- ========= DIÁLOGO RECHAZO ========= -->
    <div v-if="reject.open" class="modal-backdrop" @click.self="closeRejectDialog">
      <div class="modal">
        <h3>Motivo de rechazo</h3>
        <p class="muted">Este motivo será visible para el usuario (3–500 caracteres).</p>
        <textarea
          v-model="reject.text"
          rows="4"
          placeholder="Escribe el motivo del rechazo…"
          :maxlength="500"
        ></textarea>
        <div class="modal-actions">
          <button class="btn" @click="closeRejectDialog()" :disabled="reject.loading">Cancelar</button>
          <button
            class="btn danger"
            @click="confirmReject()"
            :disabled="reject.loading || reject.text.trim().length < 3 || reject.text.trim().length > 500"
            :title="reject.text.trim().length < 3 ? 'Mínimo 3 caracteres' : (reject.text.trim().length > 500 ? 'Máximo 500 caracteres' : 'Rechazar solicitud')"
          >
            {{ reject.loading ? 'Rechazando…' : 'Rechazar solicitud' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ========= MODAL FESTIVO (CREAR/EDITAR) ========= -->
    <div v-if="holidayModal.open" class="modal-backdrop" @click.self="closeHolidayModal">
      <div class="modal">
        <h3>{{ holidayModal.mode === 'create' ? 'Agregar festivo' : 'Editar festivo' }}</h3>

        <div class="form-grid">
          <label>
            <span>Nombre *</span>
            <input
              type="text"
              v-model.trim="holidayForm.name"
              :class="{ invalid: !!holidayErrors.name }"
              placeholder="Ej. Día de la Independencia"
              autocomplete="off"
            />
            <small v-if="holidayErrors.name" class="error">{{ holidayErrors.name }}</small>
          </label>

          <label>
            <span>Fecha *</span>
            <input
              type="date"
              v-model="holidayForm.date"
              :class="{ invalid: !!holidayErrors.date }"
            />
            <small v-if="holidayErrors.date" class="error">{{ holidayErrors.date }}</small>
          </label>

          <label class="checkbox">
            <input type="checkbox" v-model="holidayForm.recurring" />
            <span>Recurrente (se repite cada año)</span>
          </label>

          <label>
            <span>Descripción</span>
            <textarea
              rows="3"
              v-model.trim="holidayForm.description"
              placeholder="Descripción breve (opcional)"
            />
          </label>

          <label>
            <span>Identificador opcional</span>
            <input
              type="text"
              v-model.trim="holidayForm.customId"
              placeholder="Ej. MX_IND_DAY"
              autocomplete="off"
            />
          </label>
        </div>

        <div class="modal-actions">
          <button class="btn" @click="closeHolidayModal()" :disabled="holidayModal.loading">Cancelar</button>
          <button
            class="btn primary"
            @click="saveHoliday()"
            :disabled="holidayModal.loading || !canSubmitHoliday"
            :title="!canSubmitHoliday ? 'Completa los campos obligatorios' : 'Guardar festivo'"
          >
            {{ holidayModal.loading ? 'Guardando…' : (holidayModal.mode === 'create' ? 'Crear festivo' : 'Guardar cambios') }}
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
import holidayService, {
  type Holiday as ApiHoliday,
  type HolidayCreateData,
} from '@/services/holiday.service';
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
  reason?: string;
  daysRequested?: number;
}

/** Holiday del servicio */
type Holiday = ApiHoliday;

const pendingRequests = ref<VacationRequest[]>([]);
const loadingPending = ref(false);
const isActionLoading = ref<string | null>(null);

const selectedYear = ref<number>(new Date().getFullYear());
const yearOptions = computed(() => {
  const y = new Date().getFullYear();
  return [y - 1, y, y + 1];
});

const holidays = ref<Holiday[]>([]);
const loadingHolidays = ref(false);
const deletingHolidayKey = ref<string | null>(null);

/* ========= MODAL: CREAR/EDITAR FESTIVO ========= */
const holidayModal = ref<{ open: boolean; mode: 'create' | 'edit'; loading: boolean; editId?: string | null }>({
  open: false,
  mode: 'create',
  loading: false,
  editId: null,
});

const holidayForm = ref<HolidayCreateData>({
  name: '',
  date: '',
  recurring: false,
  description: '',
  customId: '',
});

const holidayErrors = ref<{ name?: string; date?: string }>({});

const MIN_NAME_LENGTH = 5;

const canSubmitHoliday = computed(() => {
  return !!holidayForm.value.name?.trim()
    && holidayForm.value.name.trim().length >= MIN_NAME_LENGTH
    && !!holidayForm.value.date;
});

/* ========= DIÁLOGO RECHAZO ========= */
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
    const list = await vacationService.getPendingRequests();
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

/* ========= ACCIONES ADMIN (Solicitudes) ========= */
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
  if (!id) return;
  if (text.length < 3) return showAlert('warning', 'El motivo debe tener al menos 3 caracteres');
  if (text.length > 500) return showAlert('warning', 'El motivo no puede exceder 500 caracteres');

  try {
    reject.value.loading = true;
    isActionLoading.value = id;
    await vacationService.updateRequestStatus({ id, status: 'rejected', rejectReason: text });
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

/* ========= CRUD FESTIVOS ========= */
function openHolidayModal(h?: Holiday) {
  holidayErrors.value = {};
  if (h) {
    holidayModal.value = { open: true, mode: 'edit', loading: false, editId: h.id };
    holidayForm.value = {
      name: h.name,
      date: h.date,
      recurring: h.recurring ?? false,
      description: h.description ?? '',
      customId: h.customId ?? '',
    };
  } else {
    holidayModal.value = { open: true, mode: 'create', loading: false, editId: null };
    holidayForm.value = { name: '', date: '', recurring: false, description: '', customId: '' };
  }
}

function closeHolidayModal() {
  if (holidayModal.value.loading) return;
  holidayModal.value.open = false;
  holidayModal.value.editId = null;
}

function validateHolidayForm(): boolean {
  holidayErrors.value = {};
  const name = holidayForm.value.name?.trim() || '';
  const date = holidayForm.value.date;

  if (!name || name.length < MIN_NAME_LENGTH) {
    holidayErrors.value.name = `El nombre debe tener al menos ${MIN_NAME_LENGTH} caracteres`;
  }
  if (!date) {
    holidayErrors.value.date = 'La fecha es obligatoria';
  } else if (Number.isNaN(new Date(date).getTime())) {
    holidayErrors.value.date = 'Formato de fecha inválido (YYYY-MM-DD)';
  }
  return !holidayErrors.value.name && !holidayErrors.value.date;
}

async function saveHoliday() {
  if (!validateHolidayForm()) return;
  try {
    holidayModal.value.loading = true;

    if (holidayModal.value.mode === 'create') {
      await holidayService.createHoliday({
        name: holidayForm.value.name.trim(),
        date: holidayForm.value.date,
        recurring: !!holidayForm.value.recurring,
        description: holidayForm.value.description?.trim() || undefined,
        customId: holidayForm.value.customId?.trim() || undefined,
      });
      showAlert('success', 'Festivo creado');
    } else {
      const id = holidayModal.value.editId!;
      const payload: Partial<HolidayCreateData> = {
        name: holidayForm.value.name?.trim() || undefined,
        date: holidayForm.value.date || undefined,
        recurring: !!holidayForm.value.recurring,
        description: holidayForm.value.description?.trim() || undefined,
        customId: holidayForm.value.customId?.trim() || undefined,
      };
      await holidayService.updateHoliday(id, payload);
      showAlert('success', 'Festivo actualizado');
    }

    closeHolidayModal();
    await loadHolidays();
  } catch (err) {
    console.error('Error guardando festivo:', err);
    showAlert('error', getErrMsg(err));
  } finally {
    holidayModal.value.loading = false;
  }
}

async function deleteHoliday(h: Holiday) {
  const ok = window.confirm(`¿Eliminar festivo "${h.name}" del ${formatDate(h.date)}?`);
  if (!ok) return;

  try {
    deletingHolidayKey.value = h.id;
    await holidayService.deleteHoliday(h.id);
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
/* === estilos idénticos a tu versión previa === */
.admin-vacations { padding: 16px; }
.page-head{ display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:12px; }
h1 { margin: 0; }
.card { background: #fff; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,.06); padding: 14px; margin: 16px 0; }
.card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.card-head h2 { margin: 0; }
.head-actions { display: flex; align-items: center; gap: 12px; }
.year-filter { font-size: .95rem; }
.table-wrap { overflow: auto; }
table { width: 100%; border-collapse: collapse; }
thead th { text-align: left; font-weight: 600; color: #333; border-bottom: 1px solid #eee; padding: 10px 8px; }
tbody td { border-bottom: 1px solid #f2f2f2; padding: 10px 8px; vertical-align: middle; }
.wrap { max-width: 360px; white-space: normal; word-break: break-word; }
.center { text-align: center; }
.muted { color: #6b7280; }
.error { color: #b91c1c; }
.user-cell .name { font-weight: 600; }
.user-cell .email { font-size: .85rem; color: #6b7280; }
.btn { background: #e5e7eb; color: #111827; border: 1px solid #d1d5db; border-radius: 8px; padding: 8px 12px; cursor: pointer; }
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
.badge { display: inline-block; font-size: .8rem; padding: 4px 8px; border-radius: 999px; background: #e5e7eb; color: #111827; }
.badge.warn { background: #fff9c4; color: #9a6700; }
.badge.recurrent { background: #e9e5ff; color: #3b2db8; }
.modal-backdrop { position: fixed; inset: 0; background: rgba(15, 23, 42, .45); display: grid; place-items: center; z-index: 50; }
.modal { width: min(640px, calc(100% - 32px)); background: #fff; border-radius: 12px; padding: 16px; box-shadow: 0 10px 30px rgba(0,0,0,.2); }
.modal h3 { margin: 0 0 8px 0; }
.modal p  { margin: 0 0 12px 0; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 8px; }
.form-grid label { display: flex; flex-direction: column; gap: 6px; }
.form-grid label span { font-size: .9rem; color: #374151; }
.form-grid input[type="text"], .form-grid input[type="date"], .form-grid textarea { width: 100%; border: 1px solid #d1d5db; border-radius: 8px; padding: 10px; font-family: inherit; }
.form-grid .checkbox { grid-column: 1 / -1; flex-direction: row; align-items: center; gap: 8px; }
.form-grid textarea { resize: vertical; grid-column: 1 / -1; }
.invalid { border-color: #ef4444 !important; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
</style>
