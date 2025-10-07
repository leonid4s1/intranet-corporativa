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

/** Derecho vigente (LFT) */
export type EntitlementCycle = {
  yearsOfService: number;
  entitlementDays: number;
  usedDays: number;
  remainingDays: number;
  window: { start: string; end: string }; // YYYY-MM-DD
  daysUntilWindowEnds: number;
  nextAnniversary: string; // YYYY-MM-DD
  policy: string; // ej. 'LFT MX 2023'
};

export type EntitlementResponse = {
  user: { id: string; name?: string; email?: string; hireDate?: string | Date };
  cycle: EntitlementCycle;
};

/** Resumen LFT (legacy; mantiene compat) */
export type VacationSummary = {
  user: {
    id: string;
    name?: string;
    email?: string;
    hireDate?: string | Date;
    yearsOfService?: number;
  };
  vacation: {
    right: number;                // días por ley
    adminExtra: number;           // bono admin
    total: number;                // right + adminExtra
    used: number;                 // usados en ciclo vigente
    remaining: number;            // total - used
    window: { start: string; end: string }; // YYYY-MM-DD
    policy: string;               // 'LFT MX 2023'
  };
};

/** === NUEVO: Ventanas (current / next) con vigencia 18 meses === */
export type WindowLabel = 'current' | 'next';
export type VacationWindow = {
  year: number;
  label: WindowLabel;
  start: string;     // ISO (YYYY-MM-DD)
  end: string;       // ISO visible = expiresAt - 1 día
  expiresAt: string; // ISO (YYYY-MM-DD)
  days: number;
  used: number;
};
export type WindowsSummary = {
  available: number;          // suma de remaining de ventanas no expiradas + bonus
  bonusAdmin: number;
  windows: VacationWindow[];
  now: string;                // ISO “ahora” backend
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
  // Permite 0 y números finitos
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
 * Derecho vigente (LFT, legacy)
 * ========================= */

function parseEntitlement(payload: unknown): EntitlementResponse {
  const root = unwrapData<unknown>(payload, {});
  const rec = isRecord(root) ? root : {};

  const userObj = getRec(rec, 'user') ?? {};
  const cycleObj = getRec(rec, 'cycle') ?? {};

  const user = {
    id: getStr(userObj, 'id') ?? getStr(userObj, '_id') ?? '',
    name: getStr(userObj, 'name'),
    email: getStr(userObj, 'email'),
    hireDate: ((): string | undefined => {
      const hd = userObj['hireDate'];
      if (isString(hd)) return hd;
      if (hd instanceof Date) return hd.toISOString();
      return undefined;
    })(),
  };

  const windowObj = getRec(cycleObj, 'window') ?? {};
  const window = {
    start: getStr(windowObj, 'start') ?? '',
    end: getStr(windowObj, 'end') ?? '',
  };

  const cycle: EntitlementCycle = {
    yearsOfService: getNum(cycleObj, 'yearsOfService') ?? 0,
    entitlementDays: getNum(cycleObj, 'entitlementDays') ?? 0,
    usedDays: getNum(cycleObj, 'usedDays') ?? 0,
    remainingDays: getNum(cycleObj, 'remainingDays') ?? 0,
    window,
    daysUntilWindowEnds: getNum(cycleObj, 'daysUntilWindowEnds') ?? 0,
    nextAnniversary: getStr(cycleObj, 'nextAnniversary') ?? '',
    policy: getStr(cycleObj, 'policy') ?? 'LFT MX 2023',
  };

  return { user, cycle };
}

/** GET /vacations/my/entitlement */
export async function getMyEntitlement(): Promise<EntitlementResponse> {
  const { data } = await api.get('/vacations/my/entitlement', {
    headers: { 'Cache-Control': 'no-store' },
  });
  return parseEntitlement(data);
}

/** GET /vacations/users/:userId/entitlement (admin) */
export async function getUserEntitlementAdmin(userId: string): Promise<EntitlementResponse> {
  const { data } = await api.get(`/vacations/users/${userId}/entitlement`, {
    headers: { 'Cache-Control': 'no-store' },
  });
  return parseEntitlement(data);
}

/* =========================
 * NUEVO: Summary por ventanas (current/next + 18m)
 * ========================= */

const DAY_MS = 24 * 60 * 60 * 1000;
const isoYMD = (d: Date) => d.toISOString().slice(0, 10);
const toDateUTC = (ymd: string) => new Date(`${ymd}T00:00:00Z`);

function getYmdFlex(obj: Record<string, unknown>, key: string): string | undefined {
  const v = obj[key];
  if (typeof v === 'string') return v.slice(0, 10);
  if (v instanceof Date) return isoYMD(v);
  return undefined;
}

function parseWindowsSummary(payload: unknown): WindowsSummary {
  const root = unwrapData<unknown>(payload, {});
  const rec = isRecord(root) ? root : {};

  const bonusAdmin = getNum(rec as Record<string, unknown>, 'bonusAdmin') ?? 0;
  const nowISO = getStr(rec as Record<string, unknown>, 'now') ?? new Date().toISOString();

  // windows puede estar en el root o dentro de { vacation }
  let container: Record<string, unknown> = rec;
  const recWindowsNode = (rec as Record<string, unknown>)['windows'];
  const recHasWindows = Array.isArray(recWindowsNode) || isRecord(recWindowsNode);
  if (!recHasWindows) {
    const maybeVac = getRec(rec, 'vacation');
    if (maybeVac) container = maybeVac;
  }

  const winsArray = getArr(container, 'windows');
  const winsObject = !winsArray ? getRec(container, 'windows') : undefined;

  const rawWindows: Record<string, unknown>[] = (() => {
    if (winsArray) return winsArray.filter(isRecord) as Record<string, unknown>[];
    if (winsObject) {
      const current = getRec(winsObject, 'current');
      const next = getRec(winsObject, 'next');
      const arr: Record<string, unknown>[] = [];
      if (current) arr.push(current);
      if (next) arr.push(next);
      return arr;
    }
    return [];
  })();

  const windows: VacationWindow[] = rawWindows
    .map((rw): VacationWindow | null => {
      const labelRaw = getStr(rw, 'label');
      const label: WindowLabel = labelRaw === 'next' ? 'next' : 'current';

      const startYmd = getYmdFlex(rw, 'start') ?? '';
      const endRawYmd = getYmdFlex(rw, 'end') ?? '';
      const expiresAtYmd = getYmdFlex(rw, 'expiresAt') ?? '';

      if (!startYmd) return null;

      // Rango visible: start — (expiresAt - 1 día).
      // Si no vino expiresAt, usamos endRawYmd como visible.
      let endVisibleYmd = endRawYmd;
      if (expiresAtYmd) {
        const exp = toDateUTC(expiresAtYmd);
        const vis = new Date(exp.getTime() - DAY_MS);
        endVisibleYmd = isoYMD(vis);
      }
      if (!endVisibleYmd) return null;

      const days = getNum(rw, 'days') ?? 0;
      const used = getNum(rw, 'used') ?? 0;
      const year = toDateUTC(startYmd).getUTCFullYear();

      return {
        label,
        year,
        start: startYmd,
        end: endVisibleYmd,
        expiresAt: expiresAtYmd || endRawYmd,
        days,
        used,
      };
    })
    .filter((x): x is VacationWindow => !!x)
    .sort((a, b) => (a.label === 'current' ? 0 : 1) - (b.label === 'current' ? 0 : 1));

  // available: si no viene, lo calculamos (solo ventanas NO vencidas) + bonus
  let available = getNum(rec as Record<string, unknown>, 'available');
  if (available == null) {
    const today = new Date(nowISO);
    today.setUTCHours(0, 0, 0, 0);

    const remainingWindows = windows.reduce((acc, w) => {
      const exp = w.expiresAt ? toDateUTC(w.expiresAt) : null;
      const notExpired = !exp || exp.getTime() >= today.getTime();
      const remaining = Math.max(0, (w.days ?? 0) - (w.used ?? 0));
      return acc + (notExpired ? remaining : 0);
    }, 0);

    available = remainingWindows + Math.max(0, bonusAdmin);
  }

  return {
    available,
    bonusAdmin,
    windows,
    now: nowISO,
  };
}

/** GET /vacations/users/me/summary */
export async function getMyWindowsSummary(): Promise<WindowsSummary> {
  const { data } = await api.get('/vacations/users/me/summary', {
    headers: { 'Cache-Control': 'no-store' },
  });
  return parseWindowsSummary(data);
}

/** GET /vacations/users/:userId/summary (admin) */
export async function getWindowsSummaryByUserId(userId: string): Promise<WindowsSummary> {
  const { data } = await api.get(`/vacations/users/${userId}/summary`, {
    headers: { 'Cache-Control': 'no-store' },
  });
  return parseWindowsSummary(data);
}

/** Azúcar: si pasas userId usa admin, si no usa “self” */
export async function getWindowsSummary(userId?: string): Promise<WindowsSummary> {
  if (userId) return getWindowsSummaryByUserId(userId);
  return getMyWindowsSummary();
}

/* =========================
 * Resumen LFT (legacy) — mantenido para compat
 * ========================= */

// Helper: obtener el id del usuario autenticado desde /auth/me (sin any)
type MeUser = { id?: string; _id?: string };
type MeEnvelope =
  | { user?: MeUser }
  | { data?: { user?: MeUser } };

async function getCurrentUserId(): Promise<string> {
  const { data } = await api.get('/auth/me');
  const payload = data as MeEnvelope;

  // soporta { user } o { data: { user } }
  const userNode: MeUser | undefined =
    (payload as { user?: MeUser }).user ??
    ((payload as { data?: { user?: MeUser } }).data?.user);

  const id = userNode?.id ?? userNode?._id;
  if (!id) throw new Error('No se pudo resolver el userId del usuario autenticado');
  return String(id);
}

/** LEGACY: Resumen “LFT simple” basado en entitlement
 *  (Si lo usabas en otros componentes, sigue funcionando.)
 *  Para las dos ventanas, usa getWindowsSummary() de arriba.
 */
export async function getVacationSummary(userId?: string): Promise<VacationSummary> {
  const id = userId || (await getCurrentUserId());
  const { data } = await api.get(`/vacations/users/${id}/entitlement`, {
    headers: { 'Cache-Control': 'no-store' },
  });

  // Transformamos el entitlement a tu VacationSummary legacy
  const ent = parseEntitlement(data);
  const s: VacationSummary = {
    user: {
      id: ent.user.id,
      name: ent.user.name,
      email: ent.user.email,
      hireDate: ent.user.hireDate,
      yearsOfService: ent.cycle.yearsOfService,
    },
    vacation: {
      right: ent.cycle.entitlementDays,
      adminExtra: 0, // si quieres adminExtra exacto, que lo exponga el backend
      total: ent.cycle.entitlementDays,
      used: ent.cycle.usedDays,
      remaining: ent.cycle.remainingDays,
      window: ent.cycle.window,
      policy: ent.cycle.policy,
    },
  };

  return s;
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

  // Derecho vigente (LFT)
  getMyEntitlement,
  getUserEntitlementAdmin,

  // Ventanas (current/next + 18m)
  getMyWindowsSummary,
  getWindowsSummaryByUserId,
  getWindowsSummary,

  // Legacy summary (compat)
  getVacationSummary,

  // Admin
  getPendingRequests,
  updateRequestStatus,
  approve,
  reject,
  getApprovedAdmin,
};
