// cliente/src/services/user.service.ts
import api from '@/services/api'

/* ========== Tipos públicos ========== */
export type Role = 'user' | 'admin' | (string & {})

export interface VacationDays {
  total: number
  used: number
  remaining: number
}

export interface User {
  id: string
  name: string
  email: string
  role: Role
  isActive: boolean
  email_verified_at?: string | null
  // 👇 nuevos campos de metadata laboral
  position?: string | null
  birthDate?: string | null // YYYY-MM-DD o ISO
  hireDate?: string | null  // YYYY-MM-DD o ISO

  vacationDays?: VacationDays
}

export interface UpdateNamePayload {
  name: string
  /** Algunos backends también piden email; tu updateUserData lo acepta */
  email?: string
}

export interface UpdatePasswordPayload {
  newPassword: string
}

/* Auth payloads (solo para compat con funciones locales de este servicio) */
export interface LoginPayload { email: string; password: string }

/** 🔐 Creación por admin */
export interface CreateUserAsAdminPayload {
  name: string
  email: string
  password: string
  password_confirmation: string
  role?: Role
  // 👇 nuevos (opcionales)
  position?: string
  birthDate?: string | Date // YYYY-MM-DD o Date
  hireDate?: string | Date  // YYYY-MM-DD o Date
}

/** Meta editable desde el panel */
export interface UpdateUserMetaPayload {
  position?: string | ''            // '' para limpiar
  birthDate?: string | ''           // YYYY-MM-DD o '' para limpiar
  hireDate?: string | ''            // YYYY-MM-DD o '' para limpiar
}

/* Vacaciones */
export interface SetVacationTotalPayload { total: number }

/* ========== Helpers seguros ========== */
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}
function get<T = unknown>(o: Record<string, unknown>, k: string): T | undefined {
  return o[k] as T | undefined
}
function toStr(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}
function toBool(v: unknown): boolean | undefined {
  if (typeof v === 'boolean') return v
  if (v === 'true') return true
  if (v === 'false') return false
  return undefined
}
function toNum(v: unknown): number | undefined {
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v)
  return undefined
}

/** Normaliza fecha a YYYY-MM-DD (UTC) si es posible */
function toISODateOnly(v?: unknown): string | undefined {
  const s = typeof v === 'string' ? v : v instanceof Date ? v.toISOString() : undefined
  if (!s) return undefined
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return typeof v === 'string' ? v : undefined
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/** Normaliza un usuario venido del backend (directo / {user} / {data}) */
function normalizeUser(raw: unknown): User | null {
  const pick = (x: unknown): Record<string, unknown> | null => {
    if (!isRecord(x)) return null
    if (isRecord(x.user)) return x.user as Record<string, unknown>
    if (isRecord(x.data)) return x.data as Record<string, unknown>
    return x
  }

  const r = pick(raw)
  if (!r) return null

  const id = toStr(get(r, 'id')) ?? toStr(get(r, '_id'))
  if (!id) return null

  const name = toStr(get(r, 'name')) ?? 'Usuario'
  const email = toStr(get(r, 'email')) ?? 'no-email@example.com'
  const role = (toStr(get(r, 'role')) ?? 'user') as Role

  const isActive =
    toBool(get(r, 'isActive')) ??
    toBool(get(r, 'active')) ??
    (toBool(get(r, 'locked')) !== undefined ? !toBool(get(r, 'locked'))! : undefined) ??
    (toBool(get(r, 'disabled')) !== undefined ? !toBool(get(r, 'disabled'))! : true)

  const email_verified_at =
    toStr(get(r, 'email_verified_at')) ??
    toStr(get(r, 'emailVerifiedAt')) ??
    undefined

  // 👇 nuevos campos
  const position = toStr(get(r, 'position')) ?? null
  const birthDate = toISODateOnly(get(r, 'birthDate')) ?? (toStr(get(r, 'birthDate')) ?? null)
  const hireDate  = toISODateOnly(get(r, 'hireDate'))  ?? (toStr(get(r, 'hireDate'))  ?? null)

  // Vacaciones
  let vacationDays: VacationDays | undefined
  if (isRecord(get(r, 'vacationDays'))) {
    const v = get(r, 'vacationDays') as Record<string, unknown>
    const total = toNum(get(v, 'total')) ?? 0
    const used  = toNum(get(v, 'used'))  ?? 0
    const remaining = toNum(get(v, 'remaining')) ?? Math.max(0, total - used)
    vacationDays = { total, used, remaining }
  }

  return { id, name, email, role, isActive: isActive ?? true, email_verified_at, position, birthDate, hireDate, vacationDays }
}

function unwrapList(data: unknown): unknown[] {
  if (isRecord(data)) {
    if (Array.isArray(get<unknown[]>(data, 'data')))  return (get<unknown[]>(data, 'data')  as unknown[]) ?? []
    if (Array.isArray(get<unknown[]>(data, 'users'))) return (get<unknown[]>(data, 'users') as unknown[]) ?? []
  }
  return Array.isArray(data) ? data : []
}

/* ========== AUTH mínimo (puedes usar AuthService para todo lo auth) ========== */

async function login(payload: LoginPayload): Promise<void> {
  await api.post('/auth/login', payload)
}

async function getProfile(): Promise<User> {
  const { data } = await api.get('/auth/profile')
  const payload = isRecord(data) ? (get(data, 'user') ?? data) : data
  const user = normalizeUser(payload)
  if (!user) throw new Error('Respuesta inválida al cargar perfil')
  return user
}

async function logout(): Promise<void> {
  await api.post('/auth/logout')
}

/* ========== USERS (admin) ========== */

export async function getAllUsers(): Promise<User[]> {
  const { data } = await api.get('/users', { params: { _t: Date.now() } })
  return unwrapList(data).map(normalizeUser).filter((u): u is User => !!u)
}

export async function updateUserName(userId: string, payload: UpdateNamePayload): Promise<User> {
  const body: Record<string, unknown> = { name: payload.name }
  if (payload.email) body.email = payload.email
  const { data } = await api.patch(`/users/${encodeURIComponent(userId)}/name`, body)
  const user = normalizeUser(data)
  if (!user) throw new Error('Respuesta inválida al actualizar nombre')
  return user
}

export async function toggleUserLock(
  userId: string
): Promise<{ id: string; isActive: boolean }> {
  const { data } = await api.patch(`/users/${encodeURIComponent(userId)}/lock`)
  const container = isRecord(data) ? (get<Record<string, unknown>>(data, 'user') ?? data) : data

  if (isRecord(container)) {
    const id = toStr(get(container, 'id')) ?? toStr(get(container, '_id')) ?? userId
    const isActive =
      toBool(get(container, 'isActive')) ??
      toBool(get(container, 'active')) ??
      (toBool(get(container, 'locked')) !== undefined ? !toBool(get(container, 'locked'))! : undefined) ??
      true
    return { id, isActive: !!isActive }
  }
  return { id: userId, isActive: true }
}

export async function updateUserPassword(
  userId: string,
  payload: UpdatePasswordPayload
): Promise<{ success: boolean }> {
  const { data } = await api.patch(`/users/${encodeURIComponent(userId)}/password`, {
    newPassword: payload.newPassword
  })
  const success = isRecord(data) ? (get<boolean>(data, 'success') ?? true) : true
  return { success }
}

export async function deleteUser(userId: string): Promise<{ success: boolean }> {
  const { data } = await api.delete(`/users/${encodeURIComponent(userId)}`)
  const success = isRecord(data) ? (get<boolean>(data, 'success') ?? true) : true
  return { success }
}

/** 🔐 Crear usuario desde el panel admin
 *  - POST /auth/register (protegido por rol admin mediante el backend)
 *  - El backend envía correo de verificación al nuevo usuario
 */
export async function createUserAsAdmin(
  payload: CreateUserAsAdminPayload
): Promise<{ user: User; requiresEmailVerification: boolean }> {
  const body: Record<string, unknown> = {
    name: payload.name?.trim(),
    email: payload.email?.trim().toLowerCase(),
    password: payload.password,
    password_confirmation: payload.password_confirmation,
  }
  if (payload.role) body.role = payload.role
  if (payload.position?.trim()) body.position = payload.position.trim()
  if (payload.birthDate) body.birthDate = toISODateOnly(payload.birthDate)
  if (payload.hireDate)  body.hireDate  = toISODateOnly(payload.hireDate)

  const { data } = await api.post('/auth/register', body)

  const user = normalizeUser(isRecord(data) ? (get(data, 'user') ?? data) : data)
  if (!user) throw new Error('Respuesta inválida al crear usuario')

  // backend retorna requiresEmailVerification: true en este flujo
  const requiresEmailVerification =
    (isRecord(data) && (get<boolean>(data, 'requiresEmailVerification') ?? true)) || true

  return { user, requiresEmailVerification }
}

/** ✏️ Actualizar metadata (puesto y fechas)
 *  Endpoint sugerido: PATCH /users/:id/meta con body { position?, birthDate?, hireDate? }
 *  Si tu backend usa otra ruta, ajusta aquí.
 */
export async function updateUserMeta(
  userId: string,
  payload: UpdateUserMetaPayload
): Promise<User> {
  const body: Record<string, unknown> = {}
  if (payload.position !== undefined) body.position = payload.position?.trim?.() ?? ''
  if (payload.birthDate !== undefined) body.birthDate = payload.birthDate ? toISODateOnly(payload.birthDate) : ''
  if (payload.hireDate  !== undefined) body.hireDate  = payload.hireDate  ? toISODateOnly(payload.hireDate)  : ''

  const { data } = await api.patch(`/users/${encodeURIComponent(userId)}/meta`, body)
  const user = normalizeUser(data)
  if (!user) throw new Error('Respuesta inválida al actualizar metadata')
  return user
}

/* ======= Vacaciones ======= */

export async function setVacationTotal(
  userId: string,
  payload: SetVacationTotalPayload
): Promise<VacationDays> {
  const { data } = await api.patch(
    `/users/${encodeURIComponent(userId)}/vacation/total`,
    { total: Number(payload.total) }
  )

  // data puede venir como { success, data: {...} } o directamente el objeto
  const containerRaw: unknown = isRecord(data) ? (get<unknown>(data, 'data') ?? data) : data
  const container: Record<string, unknown> = isRecord(containerRaw) ? containerRaw : {}

  const total = toNum(get(container, 'total')) ?? 0
  const used  = toNum(get(container, 'used'))  ?? 0
  const remaining = Math.max(0, total - used)

  return { total, used, remaining }
}

export async function addVacationDays(
  userId: string,
  payload: { days: number }
): Promise<void> {
  await api.post(`/users/${encodeURIComponent(userId)}/vacation/add`, {
    days: Number(payload.days)
  })
}

export async function setVacationUsed(
  userId: string,
  payload: { used: number }
): Promise<void> {
  await api.patch(`/users/${encodeURIComponent(userId)}/vacation/used`, {
    used: Number(payload.used)
  })
}

/* ========== Export por defecto (compat con imports actuales) ========== */
export default {
  // auth mínimos (puedes migrar a AuthService donde convenga)
  login,
  getProfile,
  logout,
  // admin users
  getAllUsers,
  updateUserName,
  toggleUserLock,
  updateUserPassword,
  deleteUser,
  createUserAsAdmin,
  updateUserMeta,     // ✅ nuevo
  // vacaciones
  setVacationTotal,
  addVacationDays,
  setVacationUsed,
}
