// src/services/vacation.service.ts
import api from './api';

/* =========================
 * Tipos públicos (importa con "type" para verbatimModuleSyntax)
 * ========================= */

export type VacationBalance = {
  availableDays: number;   // días disponibles (restantes)
  usedDays: number;        // días usados
  totalAnnualDays: number; // días anuales totales
};

export type VacationRequestApi = {
  _id: string;
  startDate: string; // 'YYYY-MM-DD'
  endDate: string;   // 'YYYY-MM-DD'
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  reason?: string;          // motivo opcional (por ejemplo al rechazar)
  daysRequested?: number;   // cantidad de días solicitados
  createdAt?: string;
  updatedAt?: string;
};

export type UIVacationRequest = {
  id: string;
  user: { id: string; name: string; email?: string };
  startDate: string; // 'YYYY-MM-DD'
  endDate: string;   // 'YYYY-MM-DD'
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
};

export type VacationsUserResponse = {
  approved: VacationRequestApi[];
  pending: VacationRequestApi[];
};

export type TeamVacationApi = {
  startDate: string; // 'YYYY-MM-DD'
  endDate: string;   // 'YYYY-MM-DD'
  user?: {
    id?: string;
    _id?: string;
    name?: string;
  };
};

export type ApiHoliday = {
  date: string;   // 'YYYY-MM-DD'
  name?: string;  // nombre del festivo (si el backend lo envía)
};

/* =========================
 * Helpers seguros (sin any)
 * ========================= */

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

/** Algunos controladores devuelven `{ data: ... }` y otros devuelven el payload directo */
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

  // distintas formas que suelen venir del backend
  const root = data?.data ?? data ?? {};
  const current = root.current ?? root.balance?.current ?? root.balance ?? root;

  const availableDays = Number(
    current.availableDays ?? current.remaining ?? current.remainingDays ?? current.available ?? 0
  );
  const usedDays = Number(
    current.usedDays ?? current.used ?? 0
  );
  const totalAnnualDays = Number(
    current.totalAnnualDays ?? current.total ?? current.annual ?? 0
  );

  return { availableDays, usedDays, totalAnnualDays };
}

export async function getHolidays(
  startDate: string,
  endDate: string,
  timezone?: string
): Promise<ApiHoliday[]> {
  // Servidor: GET /api/vacations/holidays
  const { data } = await api.get('/vacations/holidays', {
    params: { startDate, endDate, timezone },
  });

  // Puede ser [{date,name}] o directamente ['YYYY-MM-DD', ...]
  const list = unwrapData<unknown>(data, []);
  const arr = Array.isArray(list) ? list : [];

  return arr
    .map((h: unknown): ApiHoliday | null => {
      if (typeof h === 'string') {
        return { date: h };
      }
      if (isRecord(h)) {
        const date = typeof h.date === 'string' ? h.date : '';
        const name =
          typeof h.name === 'string'
            ? h.name
            : undefined;
        return date ? { date, name } : null;
      }
      return null;
    })
    .filter((x): x is ApiHoliday => !!x);
}

export async function getUserVacations(): Promise<VacationsUserResponse> {
  // Servidor: GET /api/vacations/requests  -> { approved:[], pending:[] } o { data:{ approved, pending } }
  const { data } = await api.get('/vacations/requests');

  const wrapped = unwrapData<unknown>(data, {});
  const approved: VacationRequestApi[] =
    (isRecord(wrapped) && Array.isArray(wrapped.approved)
      ? wrapped.approved
      : []) as VacationRequestApi[];

  const pending: VacationRequestApi[] =
    (isRecord(wrapped) && Array.isArray(wrapped.pending)
      ? wrapped.pending
      : []) as VacationRequestApi[];

  return { approved, pending };
}

export async function getTeamVacations(
  startDate: string,
  endDate: string
): Promise<TeamVacationApi[]> {
  // Servidor: GET /api/vacations/calendar/team-vacations
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
  // Servidor: GET /api/vacations/calendar/unavailable-dates
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
  // Servidor: POST /api/vacations/requests
  const { data } = await api.post('/vacations/requests', payload);
  return data;
}

export async function cancelVacationRequest(id: string) {
  // Servidor: PATCH /api/vacations/requests/:id/cancel
  const { data } = await api.patch(`/vacations/requests/${id}/cancel`);
  return data;
}

/* =========================
 * Endpoints de admin
 * ========================= */

export async function getPendingRequests(): Promise<UIVacationRequest[]> {
  // Ideal: /vacations/requests/pending  (si no existe, usa /vacations/requests?status=pending)
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
    const endDate   = typeof rec.endDate   === 'string' ? rec.endDate   : '';
    const status    = (typeof rec.status   === 'string' ? rec.status : 'pending') as UIVacationRequest['status'];

    const u = isRecord(rec.user) ? (rec.user as Record<string, unknown>) : {};
    const user = {
      id:    typeof u._id  === 'string' ? u._id  : (typeof u.id === 'string' ? u.id : ''),
      name:  typeof u.name === 'string' ? u.name : 'Usuario',
      email: typeof u.email === 'string' ? u.email : undefined,
    };

    return { id, user, startDate, endDate, status };
  });
}

type ApproveReject = 'approved' | 'rejected';
type UpdateStatusPayload = {
  id: string;
  status: ApproveReject;
  reason?: string;
};

function isUpdatePayload(v: unknown): v is UpdateStatusPayload {
  return (
    typeof v === 'object' &&
    v !== null &&
    'id' in v &&
    'status' in v &&
    (typeof (v as { id: unknown }).id === 'string') &&
    (v as { status: unknown }).status === 'approved' ||
    (v as { status: unknown }).status === 'rejected'
  );
}

export function updateRequestStatus(payload: UpdateStatusPayload): Promise<unknown>;
export function updateRequestStatus(id: string, status: ApproveReject, reason?: string): Promise<unknown>;

export async function updateRequestStatus(
  arg1: UpdateStatusPayload | string,
  arg2?: ApproveReject,
  arg3?: string
): Promise<unknown> {
  let id: string;
  let status: ApproveReject;
  let reason: string | undefined;

  if (isUpdatePayload(arg1)) {
    id = arg1.id;
    status = arg1.status;
    reason = arg1.reason;
  } else {
    id = arg1;
    status = arg2 as ApproveReject;
    reason = arg3;
  }

  const { data } = await api.patch(`/vacations/requests/${id}/status`, { status, reason });
  return data as unknown;
}

/* =========================
 * Export por defecto (compatible con tus imports actuales)
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
