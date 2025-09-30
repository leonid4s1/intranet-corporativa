// src/services/vacation.service.ts
import api from './api';

/* =========================
 * Tipos públicos
 * ========================= */

export type Status = 'pending' | 'approved' | 'rejected' | 'cancelled';

export type VacationBalance = {
  availableDays: number;
  usedDays: number;
  totalAnnualDays: number;
};

export type VacationRequestApi = {
  id?: string;
  _id?: string;
  user?: { id?: string; _id?: string; name?: string; email?: string };
  startDate: string;     // 'YYYY-MM-DD'
  endDate: string;       // 'YYYY-MM-DD'
  status: Status;
  reason?: string;       // motivo escrito por el usuario al solicitar
  rejectReason?: string; // motivo escrito por el admin al rechazar
  daysRequested?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type VacationsUserResponse = {
  approved: VacationRequestApi[];
  pending: VacationRequestApi[];
  rejected?: VacationRequestApi[]; // <- opcional
};

export type UIVacationRequest = {
  id: string;
  user: { id: string; name: string; email?: string };
  startDate: string;
  endDate: string;
  status: Status;
  reason?: string;        // mostrar al admin
  rejectReason?: string;  // mostrar al usuario si fue rechazada
  daysRequested?: number;
};

export type TeamVacationApi = {
  id?: string;
  userId?: string;
  startDate: string;
  endDate: string;
  user?: { id?: string; _id?: string; name?: string; email?: string };
};

export type ApiHoliday = { date: string; name?: string };

/** Filtros/filas para el reporte admin de aprobadas */
export type UserStatusFilter = 'Activo' | 'Inactivo' | 'Eliminado';
export type AdminApprovedRow = {
  id: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  displayName: string;
  displayEmail: string | null;
  userStatus: UserStatusFilter;
  createdAt: string | null;
};

/* =========================
 * Helpers seguros / type guards
 * ========================= */

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}
function isString(x: unknown): x is string {
  return typeof x === 'string';
}
function isNumber(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x);
}
function isUserStatus(x: unknown): x is UserStatusFilter {
  return x === 'Activo' || x === 'Inactivo' || x === 'Eliminado';
}

/** Accesos seguros a propiedades de Record<string, unknown> */
function getStr(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  return isString(v) ? v : undefined;
}
function getNum(obj: Record<string, unknown>, key: string): number | undefined {
  const v = obj[key];
  return isNumber(v) ? v : undefined;
}
function getRec(obj: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
  const v = obj[key];
  return isRecord(v) ? v : undefined;
}
function getArr(obj: Record<string, unknown>, key: string): unknown[] | undefined {
  const v = obj[key];
  return Array.isArray(v) ? v : undefined;
}

/** Algunos endpoints vienen como { data: ... } */
function unwrapData<T>(payload: unknown, fallback: T): T {
  if (isRecord(payload) && 'data' in payload) {
    const inner = (payload as Record<string, unknown>).data;
    return (inner as T) ?? fallback;
  }
  return (payload as T) ?? fallback;
}

/* =========================
 * Endpoints de usuario
 * ========================= */

export async function getVacationBalance(): Promise<VacationBalance> {
  const { data } = await api.get('/vacations/balance', {
    headers: { 'Cache-Control': 'no-store' },
  });

  const root = (data?.data ?? data ?? {}) as unknown;
  const base = isRecord(root) ? root : {};

  // current > balance > root
  const nodeRaw =
    (isRecord(base.current as unknown) ? (base.current as Record<string, unknown>) : undefined) ??
    (isRecord(base.balance as unknown) ? (base.balance as Record<string, unknown>) : undefined) ??
    base;

  const current = isRecord(nodeRaw) ? nodeRaw : {};

  const availableDays =
    Number(
      (current['availableDays'] ??
        current['remaining'] ??
        current['remainingDays'] ??
        current['available'] ??
        0) as number
    ) || 0;

  const usedDays = Number((current['usedDays'] ?? current['used'] ?? 0) as number) || 0;

  const totalAnnualDays =
    Number((current['totalAnnualDays'] ?? current['total'] ?? current['annual'] ?? 0) as number) ||
    0;

  return { availableDays, usedDays, totalAnnualDays };
}

export async function getHolidays(
  startDate: string,
  endDate: string,
  timezone?: string
): Promise<ApiHoliday[]> {
  const { data } = await api.get('/vacations/holidays', {
    params: { startDate, endDate, timezone },
  });

  const list = unwrapData<unknown>(data, []);
  const arr = Array.isArray(list) ? list : [];

  return arr
    .map((h: unknown): ApiHoliday | null => {
      if (isString(h)) return { date: h };
      if (isRecord(h)) {
        const rec = h as Record<string, unknown>;
        const date = getStr(rec, 'date') ?? '';
        const name = getStr(rec, 'name') ?? undefined;
        return date ? { date, name } : null;
      }
      return null;
    })
    .filter((x): x is ApiHoliday => !!x);
}

// pequeño type guard opcional
function isVacationRequestApi(x: unknown): x is VacationRequestApi {
  if (!isRecord(x)) return false;
  const r = x as Record<string, unknown>;
  return isString(getStr(r, 'startDate')) && isString(getStr(r, 'endDate')) && isString(getStr(r, 'status'));
}

export async function getUserVacations(): Promise<VacationsUserResponse> {
  const { data } = await api.get('/vacations/requests');

  const wrapped = unwrapData<unknown>(data, {});
  const wrappedRec = isRecord(wrapped) ? (wrapped as Record<string, unknown>) : {};

  const readList = (key: 'approved' | 'pending' | 'rejected'): VacationRequestApi[] => {
    const arr = getArr(wrappedRec, key);
    if (!arr) return [];
    return arr.filter(isVacationRequestApi) as VacationRequestApi[];
  };

  const approved = readList('approved');
  const pending = readList('pending');
  const rejected = readList('rejected');

  return rejected.length ? { approved, pending, rejected } : { approved, pending };
}

export async function getTeamVacations(
  startDate: string,
  endDate: string
): Promise<TeamVacationApi[]> {
  const { data } = await api.get('/vacations/calendar/team-vacations', {
    params: { startDate, endDate },
  });

  const list = unwrapData<unknown>(data, []);
  const arr = Array.isArray(list) ? list : [];

  return arr
    .map((v: unknown): TeamVacationApi | null => {
      if (!isRecord(v)) return null;

      const rec = v as Record<string, unknown>;
      const id = getStr(rec, 'id');
      const userId = getStr(rec, 'userId');
      const start = getStr(rec, 'startDate') ?? '';
      const end = getStr(rec, 'endDate') ?? '';

      const userObj = getRec(rec, 'user') ?? {};
      const user = {
        id: getStr(userObj, 'id') ?? undefined,
        _id: getStr(userObj, '_id') ?? undefined,
        name: getStr(userObj, 'name') ?? undefined,
        email: getStr(userObj, 'email') ?? undefined,
      };

      return start && end ? { id, userId, startDate: start, endDate: end, user } : null;
    })
    .filter((x): x is TeamVacationApi => !!x);
}

/** Alias ergonómico si te late el nombre */
export const getTeamCalendar = getTeamVacations;

export async function getUnavailableDates(
  startDate: string,
  endDate: string
): Promise<string[]> {
  const { data } = await api.get('/vacations/calendar/unavailable-dates', {
    params: { startDate, endDate },
  });

  const list = unwrapData<unknown>(data, []);
  const arr = Array.isArray(list) ? list : [];
  return arr.filter((d: unknown): d is string => isString(d));
}

export async function requestVacation(payload: {
  startDate: string;
  endDate: string;
  reason?: string;
}) {
  const { data } = await api.post('/vacations/requests', payload);
  return data as unknown;
}

export async function cancelVacationRequest(id: string) {
  const { data } = await api.patch(`/vacations/requests/${id}/cancel`);
  return data as unknown;
}

/* =========================
 * Endpoints de admin
 * ========================= */

export async function getPendingRequests(): Promise<UIVacationRequest[]> {
  const { data } = await api.get('/vacations/requests/pending');
  const list = unwrapData<unknown>(data, []);
  const arr = Array.isArray(list) ? list : [];

  return arr.map((v): UIVacationRequest => {
    const rec = isRecord(v) ? (v as Record<string, unknown>) : {};

    const id =
      getStr(rec, '_id') ??
      getStr(rec, 'id') ??
      '';

    const startDate = getStr(rec, 'startDate') ?? '';
    const endDate = getStr(rec, 'endDate') ?? '';
    const statusRaw = getStr(rec, 'status') ?? 'pending';
    const status = (statusRaw as Status);
    const reason = getStr(rec, 'reason') ?? undefined;
    const rejectReason = getStr(rec, 'rejectReason') ?? undefined;
    const daysRequested = getNum(rec, 'daysRequested') ?? undefined;

    const u = getRec(rec, 'user') ?? {};
    const user = {
      id: getStr(u, '_id') ?? getStr(u, 'id') ?? '',
      name: getStr(u, 'name') ?? 'Usuario',
      email: getStr(u, 'email') ?? undefined,
    };

    return { id, user, startDate, endDate, status, reason, rejectReason, daysRequested };
  });
}

type ApproveReject = 'approved' | 'rejected';
type UpdateStatusPayload = {
  id: string;
  status: ApproveReject;
  /** si rechaza, este es el motivo que exige el backend */
  reason?: string;
  /** por si lo llamas explícito como rejectReason */
  rejectReason?: string;
};

function isUpdatePayload(v: unknown): v is UpdateStatusPayload {
  if (!isRecord(v)) return false;
  const r = v as Record<string, unknown>;
  const idOk = isString(getStr(r, 'id')) && (getStr(r, 'id') as string).length > 0;
  const st = getStr(r, 'status');
  const statusOk = st === 'approved' || st === 'rejected';
  return idOk && !!statusOk;
}

// Overloads
export function updateRequestStatus(payload: UpdateStatusPayload): Promise<VacationRequestApi>;
export function updateRequestStatus(
  id: string,
  status: ApproveReject,
  rejectReason?: string
): Promise<VacationRequestApi>;

// Impl
export async function updateRequestStatus(
  arg1: UpdateStatusPayload | string,
  arg2?: ApproveReject,
  arg3?: string
): Promise<VacationRequestApi> {
  let id: string;
  let status: ApproveReject;
  let rejectReason: string | undefined;

  if (isUpdatePayload(arg1)) {
    id = arg1.id;
    status = arg1.status;
    rejectReason = arg1.rejectReason ?? arg1.reason;
  } else {
    id = arg1;
    status = arg2 as ApproveReject;
    rejectReason = arg3;
  }

  // Guard de UX: evita ida/vuelta si falta motivo o es muy corto/largo
  if (status === 'rejected') {
    const msg = (rejectReason ?? '').trim();
    if (msg.length < 3) throw new Error('El motivo de rechazo debe tener al menos 3 caracteres');
    if (msg.length > 500) throw new Error('El motivo de rechazo no puede exceder 500 caracteres');
  }

  const body: Record<string, unknown> = { status };
  if (status === 'rejected') {
    body['rejectReason'] = rejectReason ?? '';
  }

  const { data } = await api.patch(`/vacations/requests/${id}/status`, body);
  // Backend responde { success, data }; devolvemos el objeto "data"
  return unwrapData<VacationRequestApi>(data, {} as VacationRequestApi);
}

/** Azúcar sintáctico: evita confusiones con el nombre del campo */
export function approve(id: string) {
  return updateRequestStatus(id, 'approved');
}
export function reject(id: string, reason: string) {
  return updateRequestStatus({ id, status: 'rejected', rejectReason: reason });
}

/** Reporte admin de TODAS las vacaciones aprobadas (activos, inactivos o eliminados) */
export async function getApprovedAdmin(params?: {
  q?: string;
  from?: string;
  to?: string;
  userStatus?: UserStatusFilter;
}): Promise<AdminApprovedRow[]> {
  const { data } = await api.get('/vacations/admin/approved', { params });

  const list = unwrapData<unknown>(data, []);
  const arr = Array.isArray(list) ? list : [];

  return arr
    .map((v: unknown): AdminApprovedRow | null => {
      if (!isRecord(v)) return null;

      const rec = v as Record<string, unknown>;

      const id = getStr(rec, 'id') ?? getStr(rec, '_id') ?? '';
      const startDate = getStr(rec, 'startDate') ?? '';
      const endDate   = getStr(rec, 'endDate') ?? '';
      const totalDays = getNum(rec, 'totalDays') ?? 0;
      const displayName  = getStr(rec, 'displayName') ?? '';
      const displayEmailRaw = rec['displayEmail'];
      const displayEmail =
        displayEmailRaw === null ? null : (isString(displayEmailRaw) ? displayEmailRaw : null);

      const statusRaw = rec['userStatus'];
      const userStatus: UserStatusFilter =
        isUserStatus(statusRaw) ? statusRaw : 'Activo';

      const createdAtRaw = rec['createdAt'];
      const createdAt =
        createdAtRaw === null ? null : (isString(createdAtRaw) ? createdAtRaw : null);

      if (!id || !startDate || !endDate) return null;
      return { id, startDate, endDate, totalDays, displayName, displayEmail, userStatus, createdAt };
    })
    .filter((x): x is AdminApprovedRow => !!x);
}

/* =========================
 * Export por defecto
 * ========================= */
export default {
  getVacationBalance,
  getHolidays,
  getUserVacations,
  getTeamVacations,
  getTeamCalendar,
  getUnavailableDates,
  requestVacation,
  cancelVacationRequest,
  getPendingRequests,
  updateRequestStatus,
  approve,
  reject,
  getApprovedAdmin,
};
