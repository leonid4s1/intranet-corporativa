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
  startDate: string;
  endDate: string;
  user?: { id?: string; _id?: string; name?: string };
};

export type ApiHoliday = { date: string; name?: string };

/* =========================
 * Helpers seguros
 * ========================= */

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

/** Algunos endpoints vienen como { data: ... } */
function unwrapData<T>(data: unknown, fallback: T): T {
  if (isRecord(data) && 'data' in data) {
    const inner = (data as { data: unknown }).data;
    return (inner as T) ?? fallback;
  }
  return (data as T) ?? fallback;
}

/* =========================
 * Endpoints de usuario
 * ========================= */

export async function getVacationBalance(): Promise<VacationBalance> {
  const { data } = await api.get('/vacations/balance', {
    headers: { 'Cache-Control': 'no-store' },
  });

  const root = (data?.data ?? data ?? {}) as Record<string, unknown>;
  const current = (root.current ??
    (isRecord(root.balance) ? root.balance : root)) as Record<string, unknown>;

  const availableDays = Number(
    (current.availableDays ?? current.remaining ?? current.remainingDays ?? current.available ?? 0) as number
  );
  const usedDays = Number((current.usedDays ?? current.used ?? 0) as number);
  const totalAnnualDays = Number(
    (current.totalAnnualDays ?? current.total ?? current.annual ?? 0) as number
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
      if (typeof h === 'string') return { date: h };
      if (isRecord(h)) {
        const date = typeof h.date === 'string' ? h.date : '';
        const name = typeof h.name === 'string' ? h.name : undefined;
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
    typeof x.startDate === 'string' &&
    typeof x.endDate === 'string' &&
    typeof x.status === 'string'
  );
}

export async function getUserVacations(): Promise<VacationsUserResponse> {
  const { data } = await api.get('/vacations/requests');

  const wrapped = unwrapData<unknown>(data, {});

  // lector seguro sin any
  const readList = (key: 'approved' | 'pending' | 'rejected'): VacationRequestApi[] => {
    if (isRecord(wrapped) && Array.isArray(wrapped[key])) {
      // filtramos por si vienen elementos raros
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

      const start = typeof v.startDate === 'string' ? v.startDate : '';
      const end = typeof v.endDate === 'string' ? v.endDate : '';

      const userObj = isRecord(v.user) ? v.user : {};
      const user = {
        id: typeof userObj.id === 'string' ? userObj.id : undefined,
        _id: typeof userObj._id === 'string' ? userObj._id : undefined,
        name: typeof userObj.name === 'string' ? userObj.name : undefined,
      };

      return start && end ? { startDate: start, endDate: end, user } : null;
    })
    .filter((x): x is TeamVacationApi => !!x);
}

export async function getUnavailableDates(
  startDate: string,
  endDate: string
): Promise<string[]> {
  const { data } = await api.get('/vacations/calendar/unavailable-dates', {
    params: { startDate, endDate },
  });

  const list = unwrapData<unknown>(data, []);
  const arr = Array.isArray(list) ? list : [];
  return arr.filter((d: unknown): d is string => typeof d === 'string');
}

export async function requestVacation(payload: {
  startDate: string;
  endDate: string;
  reason?: string;
}) {
  const { data } = await api.post('/vacations/requests', payload);
  return data;
}

export async function cancelVacationRequest(id: string) {
  const { data } = await api.patch(`/vacations/requests/${id}/cancel`);
  return data;
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
      typeof rec._id === 'string'
        ? rec._id
        : typeof rec.id === 'string'
        ? rec.id
        : '';

    const startDate = typeof rec.startDate === 'string' ? rec.startDate : '';
    const endDate = typeof rec.endDate === 'string' ? rec.endDate : '';
    const status = (typeof rec.status === 'string' ? rec.status : 'pending') as Status;
    const reason = typeof rec.reason === 'string' ? rec.reason : undefined;
    const rejectReason = typeof rec.rejectReason === 'string' ? rec.rejectReason : undefined;
    const daysRequested =
      typeof rec.daysRequested === 'number' ? rec.daysRequested : undefined;

    const u = isRecord(rec.user) ? (rec.user as Record<string, unknown>) : {};
    const user = {
      id:
        typeof u._id === 'string'
          ? u._id
          : typeof u.id === 'string'
          ? u.id
          : '',
      name: typeof u.name === 'string' ? u.name : 'Usuario',
      email: typeof u.email === 'string' ? u.email : undefined,
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
  const idOk = typeof v.id === 'string' && v.id.length > 0;
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
    // admitir reason o rejectReason desde el caller
    rejectReason = arg1.rejectReason ?? arg1.reason;
  } else {
    id = arg1;
    status = arg2 as ApproveReject;
    rejectReason = arg3;
  }

  const body: Record<string, unknown> = { status };
  // el backend espera rejectReason cuando es rechazado
  if (status === 'rejected') {
    body.rejectReason = rejectReason ?? '';
  }

  const { data } = await api.patch(`/vacations/requests/${id}/status`, body);
  return data as unknown;
}

/* =========================
 * Export por defecto
 * ========================= */
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
};
