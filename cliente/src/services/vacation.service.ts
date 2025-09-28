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

/** Forma en la que llega cada fila desde el backend (parcial/relajada) */
type AdminApprovedApiRow = {
  id?: string;
  _id?: string;
  startDate?: string;
  endDate?: string;
  totalDays?: number;
  displayName?: string;
  displayEmail?: string | null;
  userStatus?: UserStatusFilter | string;
  createdAt?: string | null;
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

/** Algunos endpoints vienen como { data: ... } */
function unwrapData<T>(payload: unknown, fallback: T): T {
  if (isRecord(payload) && 'data' in payload) {
    const inner = (payload as { data: unknown }).data;
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
    (isRecord(base.current) ? base.current : undefined) ??
    (isRecord(base.balance) ? base.balance : undefined) ??
    base;

  const current = isRecord(nodeRaw) ? nodeRaw : {};

  const availableDays = Number(
    ((current.availableDays ??
      current.remaining ??
      current.remainingDays ??
      current.available ??
      0) as number)
  );
  const usedDays = Number((current.usedDays ?? current.used ?? 0) as number);
  const totalAnnualDays = Number(
    ((current.totalAnnualDays ?? current.total ?? current.annual ?? 0) as number)
  );

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
        const date = isString(h.date) ? h.date : '';
        const name = isString(h.name) ? h.name : undefined;
        return date ? { date, name } : null;
      }
      return null;
    })
    .filter((x): x is ApiHoliday => !!x);
}

// pequeño type guard opcional
function isVacationRequestApi(x: unknown): x is VacationRequestApi {
  return (
    isRecord(x) &&
    isString(x.startDate) &&
    isString(x.endDate) &&
    isString(x.status)
  );
}

export async function getUserVacations(): Promise<VacationsUserResponse> {
  const { data } = await api.get('/vacations/requests');

  const wrapped = unwrapData<unknown>(data, {});

  // lector seguro sin any
  const readList = (key: 'approved' | 'pending' | 'rejected'): VacationRequestApi[] => {
    if (isRecord(wrapped) && Array.isArray(wrapped[key])) {
      return (wrapped[key] as unknown[]).filter(isVacationRequestApi);
    }
    return [];
  };

  const approved = readList('approved');
  const pending  = readList('pending');
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

      const id = isString(v.id) ? v.id : undefined;
      const userId = isString(v.userId) ? v.userId : undefined;
      const start = isString(v.startDate) ? v.startDate : '';
      const end = isString(v.endDate) ? v.endDate : '';

      const userObj = isRecord(v.user) ? v.user : {};
      const user = {
        id: isString(userObj.id) ? userObj.id : undefined,
        _id: isString(userObj._id) ? userObj._id : undefined,
        name: isString(userObj.name) ? userObj.name : undefined,
        email: isString(userObj.email) ? userObj.email : undefined,
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
      isString(rec._id)
        ? rec._id
        : isString(rec.id)
        ? rec.id
        : '';

    const startDate = isString(rec.startDate) ? rec.startDate : '';
    const endDate = isString(rec.endDate) ? rec.endDate : '';
    const status = (isString(rec.status) ? rec.status : 'pending') as Status;
    const reason = isString(rec.reason) ? rec.reason : undefined;
    const rejectReason = isString(rec.rejectReason) ? rec.rejectReason : undefined;
    const daysRequested =
      isNumber(rec.daysRequested) ? rec.daysRequested : undefined;

    const u = isRecord(rec.user) ? (rec.user as Record<string, unknown>) : {};
    const user = {
      id:
        isString(u._id)
          ? u._id
          : isString(u.id)
          ? u.id
          : '',
      name: isString(u.name) ? u.name : 'Usuario',
      email: isString(u.email) ? u.email : undefined,
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
  const idOk = isString(v.id) && v.id.length > 0;
  const st = v.status;
  const statusOk = st === 'approved' || st === 'rejected';
  return idOk && statusOk;
}

// Overloads
export function updateRequestStatus(payload: UpdateStatusPayload): Promise<unknown>;
export function updateRequestStatus(
  id: string,
  status: ApproveReject,
  rejectReason?: string
): Promise<unknown>;

// Impl
export async function updateRequestStatus(
  arg1: UpdateStatusPayload | string,
  arg2?: ApproveReject,
  arg3?: string
): Promise<unknown> {
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

  const body: Record<string, unknown> = { status };
  if (status === 'rejected') {
    body.rejectReason = rejectReason ?? '';
  }

  const { data } = await api.patch(`/vacations/requests/${id}/status`, body);
  return data as unknown;
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

      const rec = v as Partial<AdminApprovedApiRow>;

      const id =
        isString(rec.id) ? rec.id :
        isString(rec._id) ? rec._id : '';

      const startDate = isString(rec.startDate) ? rec.startDate : '';
      const endDate   = isString(rec.endDate)   ? rec.endDate   : '';
      const totalDays = isNumber(rec.totalDays) ? rec.totalDays : 0;
      const displayName  = isString(rec.displayName) ? rec.displayName : '';
      const displayEmail = rec.displayEmail === null
        ? null
        : isString(rec.displayEmail) ? rec.displayEmail : null;

      const userStatus: UserStatusFilter =
        isUserStatus(rec.userStatus) ? rec.userStatus as UserStatusFilter : 'Activo';

      const createdAt = rec.createdAt === null
        ? null
        : isString(rec.createdAt) ? rec.createdAt : null;

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
  getApprovedAdmin,
};
