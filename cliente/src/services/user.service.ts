// cliente/src/services/vacation.service.ts
import api from '@/services/api'; // Axios con baseURL '/api'
import dayjs from 'dayjs';

/* ===================== Tipos exportados ===================== */
export type Status = 'approved' | 'pending' | 'cancelled' | 'rejected';

export type ApiHoliday = {
  date: string; // 'YYYY-MM-DD'
  name?: string;
};

export type TeamVacationApi = {
  startDate: string; // 'YYYY-MM-DD'
  endDate: string;   // 'YYYY-MM-DD'
  user?: { id?: string; _id?: string; name?: string };
};

export type VacationRequestApi = {
  id?: string;
  _id?: string;
  startDate: string; // 'YYYY-MM-DD'
  endDate: string;   // 'YYYY-MM-DD'
  status: Status;
  reason?: string;
  daysRequested?: number;
  days?: number;
};

export type VacationBalance = {
  availableDays: number;
  usedDays: number;
  totalAnnualDays: number;
};

/* ===================== Helpers de tipado ===================== */
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}
function get<T = unknown>(obj: Record<string, unknown>, key: string): T | undefined {
  return obj[key] as T | undefined;
}
function toStringOpt(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}
function toNumberOpt(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}
function toYMD(v: unknown): string | undefined {
  const s = toStringOpt(v);
  if (!s) return undefined;
  const d = dayjs(s);
  return d.isValid() ? d.format('YYYY-MM-DD') : undefined;
}

/* ===================== Normalizadores ===================== */
function normalizeBalance(raw: unknown): VacationBalance {
  // Soporta: { data:{ current:{ total, used, remaining } } } o { total, used, remaining }
  let current: Record<string, unknown> = {};
  if (isRecord(raw)) {
    const dataObj = get<Record<string, unknown>>(raw, 'data');
    const currentObj = dataObj && isRecord(dataObj) && isRecord(dataObj.current)
      ? (dataObj.current as Record<string, unknown>)
      : undefined;
    current = currentObj ?? raw;
  }

  const total = toNumberOpt(get(current, 'total')) ?? 0;
  const used = toNumberOpt(get(current, 'used')) ?? 0;
  const remaining = toNumberOpt(get(current, 'remaining')) ?? 0;

  return {
    availableDays: remaining >= 0 ? remaining : 0,
    usedDays: used >= 0 ? used : 0,
    totalAnnualDays: total > 0 ? total : used + remaining,
  };
}

function normalizeVacationArray(arr: unknown): VacationRequestApi[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((v: unknown): VacationRequestApi | null => {
      if (!isRecord(v)) return null;

      const id = toStringOpt(get(v, 'id')) ?? toStringOpt(get(v, '_id'));
      const startDate = toYMD(get(v, 'startDate'));
      const endDate = toYMD(get(v, 'endDate'));
      const status = toStringOpt(get(v, 'status')) as Status | undefined;
      const reason = toStringOpt(get(v, 'reason'));
      const daysRequested = toNumberOpt(get(v, 'daysRequested')) ?? toNumberOpt(get(v, 'days'));

      if (!startDate || !endDate || !status) return null;
      const out: VacationRequestApi = { id, startDate, endDate, status };
      if (reason) out.reason = reason;
      if (typeof daysRequested === 'number') {
        out.daysRequested = daysRequested;
        out.days = daysRequested;
      }
      return out;
    })
    .filter((x): x is VacationRequestApi => !!x);
}

function normalizeHolidays(raw: unknown): ApiHoliday[] {
  const list = Array.isArray(isRecord(raw) ? get<unknown[]>(raw, 'data') : undefined)
    ? (get<unknown[]>(raw as Record<string, unknown>, 'data') as unknown[])
    : (Array.isArray(raw) ? (raw as unknown[]) : []);

  return list
    .map((h: unknown): ApiHoliday | null => {
      if (!isRecord(h)) return null;
      const date = toYMD(get(h, 'date'));
      const name = toStringOpt(get(h, 'name'));
      return date ? { date, name } : null;
    })
    .filter((x): x is ApiHoliday => !!x);
}

function normalizeTeamVacations(raw: unknown): TeamVacationApi[] {
  const list = Array.isArray(isRecord(raw) ? get<unknown[]>(raw, 'data') : undefined)
    ? (get<unknown[]>(raw as Record<string, unknown>, 'data') as unknown[])
    : (Array.isArray(raw) ? (raw as unknown[]) : []);

  return list
    .map((v: unknown): TeamVacationApi | null => {
      if (!isRecord(v)) return null;
      const startDate = toYMD(get(v, 'startDate'));
      const endDate = toYMD(get(v, 'endDate'));

      const userRaw = get<Record<string, unknown>>(v, 'user');
      const userObj: Record<string, unknown> | undefined =
        userRaw && isRecord(userRaw) ? userRaw : undefined;
      const user = userObj
        ? {
            id: toStringOpt(get(userObj, 'id')),
            _id: toStringOpt(get(userObj, '_id')),
            name: toStringOpt(get(userObj, 'name')),
          }
        : undefined;

      return startDate && endDate ? { startDate, endDate, user } : null;
    })
    .filter((x): x is TeamVacationApi => !!x);
}

function arrayFromData(data: unknown): unknown[] {
  if (isRecord(data) && Array.isArray(get<unknown[]>(data, 'data'))) {
    return (get<unknown[]>(data, 'data') as unknown[]) ?? [];
  }
  return Array.isArray(data) ? (data as unknown[]) : [];
}

/* ===================== Service (rutas sin '/api' porque baseURL ya es '/api') ===================== */
async function getVacationBalance(): Promise<VacationBalance> {
  const { data } = await api.get('/vacations/balance');
  return normalizeBalance(data);
}

async function getHolidays(
  startDate: string,
  endDate: string,
  timezone?: string
): Promise<ApiHoliday[]> {
  const { data } = await api.get('/vacations/calendar/holidays', {
    params: { startDate, endDate, timezone },
  });
  return normalizeHolidays(data);
}

async function getUserVacations(): Promise<{ approved: VacationRequestApi[]; pending: VacationRequestApi[] }> {
  const { data } = await api.get('/vacations/user');
  const container =
    isRecord(data) && isRecord(get<Record<string, unknown>>(data, 'data'))
      ? (get<Record<string, unknown>>(data, 'data') as Record<string, unknown>)
      : (isRecord(data) ? (data as Record<string, unknown>) : {});
  const approved = normalizeVacationArray(get(container, 'approved'));
  const pending = normalizeVacationArray(get(container, 'pending'));
  return { approved, pending };
}

async function getTeamVacations(startDate: string, endDate: string): Promise<TeamVacationApi[]> {
  const { data } = await api.get('/vacations/calendar/team-vacations', { params: { startDate, endDate } });
  return normalizeTeamVacations(data);
}

async function getUnavailableDates(startDate: string, endDate: string): Promise<string[]> {
  const { data } = await api.get('/vacations/calendar/unavailable-dates', { params: { startDate, endDate } });
  const list = Array.isArray(isRecord(data) ? get<unknown[]>(data, 'data') : undefined)
    ? (get<unknown[]>(data as Record<string, unknown>, 'data') as unknown[])
    : (Array.isArray(data) ? (data as unknown[]) : []);
  return list.map((d) => toYMD(d)).filter((d): d is string => !!d);
}

async function requestVacation(payload: { startDate: string; endDate: string; reason?: string }): Promise<VacationRequestApi> {
  const { data } = await api.post('/vacations/requests', payload);
  const candidate = isRecord(data) && isRecord(get<Record<string, unknown>>(data, 'data'))
    ? [get<Record<string, unknown>>(data as Record<string, unknown>, 'data')]
    : [data];
  const normalized = normalizeVacationArray(candidate);
  if (normalized.length > 0) return normalized[0];
  return { startDate: payload.startDate, endDate: payload.endDate, status: 'pending', reason: payload.reason };
}

async function cancelVacationRequest(id: string): Promise<void> {
  await api.patch(`/vacations/requests/${id}/cancel`);
}

/* ====== Pendientes & cambio de estado (con tipado rígido y sobrecargas) ====== */

/** Lista solicitudes pendientes (intenta /pending y, si falla, usa ?status=pending) */
async function getPendingRequests(): Promise<VacationRequestApi[]> {
  try {
    const { data } = await api.get('/vacations/requests/pending');
    return normalizeVacationArray(arrayFromData(data));
  } catch {
    const { data } = await api.get('/vacations/requests', { params: { status: 'pending' } });
    return normalizeVacationArray(arrayFromData(data));
  }
}

/* Sobrecargas: */
function updateRequestStatus(id: string, status: 'approved' | 'rejected', reason?: string): Promise<void>;
function updateRequestStatus(args: { id: string; status: 'approved' | 'rejected'; reason?: string }): Promise<void>;
async function updateRequestStatus(
  arg1: string | { id: string; status: 'approved' | 'rejected'; reason?: string },
  arg2?: 'approved' | 'rejected',
  arg3?: string
): Promise<void> {
  let id: string;
  let status: 'approved' | 'rejected';
  let reason: string | undefined;

  if (typeof arg1 === 'object' && arg1 !== null) {
    ({ id, status, reason } = arg1);
  } else {
    id = arg1;
    status = arg2 as 'approved' | 'rejected';
    reason = arg3;
  }
  await api.patch(`/vacations/requests/${id}/status`, { status, reason });
}

/* Wrappers (compatibilidad con llamadas antiguas) */
async function approveRequest(id: string): Promise<void> {
  return updateRequestStatus(id, 'approved');
}
async function rejectRequest(id: string): Promise<void> {
  return updateRequestStatus(id, 'rejected');
}

/* ===================== Export por defecto ===================== */
export default {
  getVacationBalance,
  getHolidays,
  getUserVacations,
  getTeamVacations,
  getUnavailableDates,
  requestVacation,
  cancelVacationRequest,
  getPendingRequests,
  updateRequestStatus,
  // compat:
  approveRequest,
  rejectRequest,
};
