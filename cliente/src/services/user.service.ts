// src/services/vacation.service.ts
import api from '@/services/api'; // Axios con baseURL '/api'
import dayjs from 'dayjs';

/* ===================== Tipos exportados ===================== */
export type Status = 'approved' | 'pending' | 'cancelled' | 'rejected';

export type ApiHoliday = {
  date: string;        // 'YYYY-MM-DD'
  name?: string;
};

export type TeamVacationApi = {
  startDate: string;   // 'YYYY-MM-DD'
  endDate: string;     // 'YYYY-MM-DD'
  user?: { id?: string; _id?: string; name?: string };
};

export type VacationRequestApi = {
  id?: string;
  _id?: string;
  startDate: string;   // 'YYYY-MM-DD'
  endDate: string;     // 'YYYY-MM-DD'
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
  // Esperamos algo tipo: { success, data: { current: { total, used, remaining }, ... } }
  let current: Record<string, unknown> = {};
  if (isRecord(raw)) {
    const dataObj = isRecord(raw.data) ? (raw.data as Record<string, unknown>) : undefined;
    const currentObj = dataObj && isRecord(dataObj.current) ? (dataObj.current as Record<string, unknown>) : undefined;
    current = currentObj ?? (raw as Record<string, unknown>);
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
  const list = Array.isArray((isRecord(raw) ? (raw as Record<string, unknown>).data : undefined))
    ? ((raw as Record<string, unknown>).data as unknown[])
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
  const list = Array.isArray((isRecord(raw) ? (raw as Record<string, unknown>).data : undefined))
    ? ((raw as Record<string, unknown>).data as unknown[])
    : (Array.isArray(raw) ? (raw as unknown[]) : []);

  return list
    .map((v: unknown): TeamVacationApi | null => {
      if (!isRecord(v)) return null;
      const startDate = toYMD(get(v, 'startDate'));
      const endDate = toYMD(get(v, 'endDate'));

      const userRaw = get<Record<string, unknown>>(v, 'user');
      const userObj: Record<string, unknown> | undefined = userRaw && isRecord(userRaw) ? userRaw : undefined;
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

/* ===================== Service (rutas sin '/api') ===================== */
async function getVacationBalance(): Promise<VacationBalance> {
  // GET /vacations/balance
  const { data } = await api.get('/vacations/balance');
  return normalizeBalance(data);
}

async function getHolidays(
  startDate: string,
  endDate: string,
  timezone?: string
): Promise<ApiHoliday[]> {
  // GET /vacations/calendar/holidays
  const { data } = await api.get('/vacations/calendar/holidays', {
    params: { startDate, endDate, timezone },
  });
  return normalizeHolidays(data);
}

async function getUserVacations(): Promise<{ approved: VacationRequestApi[]; pending: VacationRequestApi[] }> {
  // GET /vacations/user  (ajusta a /vacations/requests si tu backend así lo expone)
  const { data } = await api.get('/vacations/user');

  // Soportar { data: { approved, pending } } o { approved, pending }
  const container = isRecord(data) && isRecord(data.data) ? (data.data as Record<string, unknown>) : (isRecord(data) ? (data as Record<string, unknown>) : {});
  const approved = normalizeVacationArray(get(container, 'approved'));
  const pending = normalizeVacationArray(get(container, 'pending'));
  return { approved, pending };
}

async function getTeamVacations(startDate: string, endDate: string): Promise<TeamVacationApi[]> {
  // GET /vacations/calendar/team-vacations
  const { data } = await api.get('/vacations/calendar/team-vacations', { params: { startDate, endDate } });
  return normalizeTeamVacations(data);
}

async function getUnavailableDates(startDate: string, endDate: string): Promise<string[]> {
  // GET /vacations/calendar/unavailable-dates
  const { data } = await api.get('/vacations/calendar/unavailable-dates', { params: { startDate, endDate } });

  const list = Array.isArray((isRecord(data) ? (data as Record<string, unknown>).data : undefined))
    ? ((data as Record<string, unknown>).data as unknown[])
    : (Array.isArray(data) ? (data as unknown[]) : []);

  return list.map((d) => toYMD(d)).filter((d): d is string => !!d);
}

async function requestVacation(payload: { startDate: string; endDate: string; reason?: string }): Promise<VacationRequestApi> {
  // POST /vacations/requests
  const { data } = await api.post('/vacations/requests', payload);

  // La API puede devolver { success, data: obj } o directamente el objeto
  const candidate = isRecord(data) && isRecord(data.data) ? [data.data] : [data];
  const normalized = normalizeVacationArray(candidate);
  if (normalized.length > 0) return normalized[0];

  // Fallback mínimo con el payload
  return {
    startDate: payload.startDate,
    endDate: payload.endDate,
    status: 'pending',
    reason: payload.reason,
  };
}

async function cancelVacationRequest(id: string): Promise<void> {
  // PATCH /vacations/requests/:id/cancel
  await api.patch(`/vacations/requests/${id}/cancel`);
}

async function approveRequest(id: string): Promise<void> {
  // PATCH /vacations/requests/:id/status { status: 'approved' }
  await api.patch(`/vacations/requests/${id}/status`, { status: 'approved' });
}

async function rejectRequest(id: string): Promise<void> {
  // PATCH /vacations/requests/:id/status { status: 'rejected' }
  await api.patch(`/vacations/requests/${id}/status`, { status: 'rejected' });
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
  approveRequest,
  rejectRequest,
};
