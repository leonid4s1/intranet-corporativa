// cliente/src/services/user.service.ts
import api from '@/services/api'

/* ========== Tipos públicos ========== */
export type Role = 'user' | 'admin' | (string & {})

export interface VacationDays {
  total: number
  used: number
  remaining: number
  adminExtra?: number
  adminBonus?: number
  bonusAdmin?: number
}

export interface User {
  id: string
  name: string
  email: string
  role: Role
  isActive: boolean
  isVerified?: boolean
  email_verified_at?: string | null
  position?: string | null
  birthDate?: string | null
  hireDate?: string | null
  vacationDays?: VacationDays
  used?: number
  total?: number
  available?: number
}

export interface UpdateNamePayload {
  name: string
  email?: string
}

export interface UpdatePasswordPayload {
  newPassword: string
}

export interface LoginPayload { email: string; password: string }

export interface CreateUserAsAdminPayload {
  name: string
  email: string
  password: string
  password_confirmation: string
  role?: Role
  position?: string
  birthDate?: string | Date
  hireDate?: string | Date
}

export interface UpdateUserMetaPayload {
  position?: string | ''
  birthDate?: string | ''
  hireDate?: string | ''
}

export interface SetVacationTotalPayload { total: number }

export interface AdjustVacationBonusPayload {
  value?: number
  delta?: number
}

/* ========== Helpers seguros ========== */
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function get<T>(o: Record<string, unknown>, k: string): T | undefined {
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

function toISODateOnly(v?: unknown): string | undefined {
  const s =
    typeof v === 'string'
      ? v
      : v instanceof Date
      ? v.toISOString()
      : undefined
  if (!s) return undefined
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return typeof v === 'string' ? v : undefined
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/** Validar id antes de llamar a la API */
function requireId(id: string | undefined | null): string {
  const v = (id ?? '').toString().trim()
  if (!v) throw new Error('Falta el id del usuario')
  return v
}

/** Normaliza un usuario del backend */
function normalizeUser(raw: unknown): User | null {
  if (!isRecord(raw)) return null
  const r = raw.data && isRecord(raw.data) ? raw.data : raw

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

  const isVerified = toBool(get(r, 'isVerified'))
  const email_verified_at =
    toStr(get(r, 'email_verified_at')) ?? toStr(get(r, 'emailVerifiedAt'))

  const position = toStr(get(r, 'position')) ?? null
  const birthDate = toISODateOnly(get(r, 'birthDate')) ?? toStr(get(r, 'birthDate')) ?? null
  const hireDate = toISODateOnly(get(r, 'hireDate')) ?? toStr(get(r, 'hireDate')) ?? null

  let vacationDays: VacationDays | undefined
  const vDays = get<Record<string, unknown>>(r, 'vacationDays')
  if (isRecord(vDays)) {
    const totalV = toNum(get(vDays, 'total')) ?? 0
    const usedV = toNum(get(vDays, 'used')) ?? 0
    const remainingV = toNum(get(vDays, 'remaining')) ?? Math.max(0, totalV - usedV)
    vacationDays = { total: totalV, used: usedV, remaining: remainingV }
  }

  const used = toNum(get(r, 'used'))
  const total = toNum(get(r, 'total'))
  const available = toNum(get(r, 'available'))

  return {
    id,
    name,
    email,
    role,
    isActive: isActive ?? true,
    isVerified,
    email_verified_at: email_verified_at ?? null,
    position,
    birthDate,
    hireDate,
    vacationDays,
    used,
    total,
    available,
  }
}

/** Limpia el payload del bonus */
function cleanBonusPayload(p: AdjustVacationBonusPayload): AdjustVacationBonusPayload {
  const result: AdjustVacationBonusPayload = {}
  if (typeof p.value === 'number' && Number.isFinite(p.value)) result.value = Math.floor(p.value)
  if (typeof p.delta === 'number' && Number.isFinite(p.delta)) result.delta = Math.floor(p.delta)
  return result
}

function unwrapList(data: unknown): unknown[] {
  if (isRecord(data)) {
    if (Array.isArray(data.data)) return data.data
    if (Array.isArray(data.users)) return data.users
  }
  return Array.isArray(data) ? data : []
}

/* ========== AUTH ========== */
export async function login(payload: LoginPayload): Promise<void> {
  await api.post('/auth/login', payload)
}

export async function getProfile(): Promise<User> {
  const { data } = await api.get('/auth/profile')
  const user = normalizeUser(data)
  if (!user) throw new Error('Respuesta inválida al cargar perfil')
  return user
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout')
}

/* ========== USERS (admin) ========== */
export async function getAllUsers(): Promise<User[]> {
  const { data } = await api.get('/users', { params: { _t: Date.now() } })
  return unwrapList(data)
    .map(normalizeUser)
    .filter((u): u is User => !!u)
}

export async function updateUserName(userId: string, payload: UpdateNamePayload): Promise<User> {
  const id = requireId(userId)
  const body: Record<string, unknown> = { name: payload.name }
  if (payload.email) body.email = payload.email
  const { data } = await api.patch(`/users/${encodeURIComponent(id)}/name`, body)
  const user = normalizeUser(data)
  if (!user) throw new Error('Respuesta inválida al actualizar nombre')
  return user
}

export async function toggleUserLock(userId: string): Promise<{ id: string; isActive: boolean }> {
  const id = requireId(userId)
  const { data } = await api.patch(`/users/${encodeURIComponent(id)}/lock`)
  const user = normalizeUser(data)
  return { id, isActive: user?.isActive ?? true }
}

export async function updateUserPassword(
  userId: string,
  payload: UpdatePasswordPayload
): Promise<{ success: boolean }> {
  const id = requireId(userId)
  const { data } = await api.patch(`/users/${encodeURIComponent(id)}/password`, {
    newPassword: payload.newPassword,
  })
  return { success: isRecord(data) ? Boolean(data.success ?? true) : true }
}

export async function deleteUser(userId: string): Promise<{ success: boolean }> {
  const id = requireId(userId)
  const { data } = await api.delete(`/users/${encodeURIComponent(id)}`)
  return { success: isRecord(data) ? Boolean(data.success ?? true) : true }
}

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
  if (payload.hireDate) body.hireDate = toISODateOnly(payload.hireDate)

  const { data } = await api.post('/auth/register', body)
  const user = normalizeUser(data)
  if (!user) throw new Error('Respuesta inválida al crear usuario')
  const requiresEmailVerification =
    (isRecord(data) && Boolean(data.requiresEmailVerification ?? true)) || true
  return { user, requiresEmailVerification }
}

export async function updateUserMeta(
  userId: string,
  payload: UpdateUserMetaPayload
): Promise<User> {
  const id = requireId(userId)
  const body: Record<string, unknown> = {}
  if (payload.position !== undefined) body.position = payload.position?.trim?.() ?? ''
  if (payload.birthDate !== undefined)
    body.birthDate = payload.birthDate ? toISODateOnly(payload.birthDate) : ''
  if (payload.hireDate !== undefined)
    body.hireDate = payload.hireDate ? toISODateOnly(payload.hireDate) : ''
  const { data } = await api.patch(`/users/${encodeURIComponent(id)}/meta`, body)
  const user = normalizeUser(data)
  if (!user) throw new Error('Respuesta inválida al actualizar metadata')
  return user
}

/* ======= Vacaciones ======= */
export async function setVacationTotal(
  userId: string,
  payload: SetVacationTotalPayload
): Promise<VacationDays> {
  const id = requireId(userId)
  const { data } = await api.patch(`/users/${encodeURIComponent(id)}/vacation/total`, {
    total: Number(payload.total),
  })
  const d = isRecord(data) && isRecord(data.data) ? data.data : (data as Record<string, unknown>)
  const total = toNum(get(d, 'total')) ?? 0
  const used = toNum(get(d, 'used')) ?? 0
  return { total, used, remaining: Math.max(0, total - used) }
}

export async function addVacationDays(userId: string, payload: { days: number }): Promise<void> {
  const id = requireId(userId)
  await api.post(`/users/${encodeURIComponent(id)}/vacation/add`, {
    days: Number(payload.days),
  })
}

export async function setVacationUsed(userId: string, payload: { used: number }): Promise<void> {
  const id = requireId(userId)
  await api.patch(`/users/${encodeURIComponent(id)}/vacation/used`, {
    used: Number(payload.used),
  })
}

/** NUEVO: Ajustar bono admin */
export async function adjustVacationBonus(
  userId: string,
  payload: AdjustVacationBonusPayload
): Promise<VacationDays> {
  const id = requireId(userId)
  const body = cleanBonusPayload(payload)
  if (!('delta' in body) && !('value' in body)) {
    throw new Error('Debes enviar delta o value para ajustar el bono')
  }
  const { data } = await api.patch(`/users/${encodeURIComponent(id)}/vacation/bonus`, body)
  const d = isRecord(data) && isRecord(data.data) ? data.data : (data as Record<string, unknown>)
  const total = toNum(get(d, 'total')) ?? 0
  const used = toNum(get(d, 'used')) ?? 0
  return { total, used, remaining: Math.max(0, total - used) }
}

export async function adjustAdminBonus(userId: string, delta: number): Promise<VacationDays> {
  return adjustVacationBonus(userId, { delta })
}

/* ========== Export por defecto ========== */
export default {
  login,
  getProfile,
  logout,
  getAllUsers,
  updateUserName,
  toggleUserLock,
  updateUserPassword,
  deleteUser,
  createUserAsAdmin,
  updateUserMeta,
  setVacationTotal,
  addVacationDays,
  setVacationUsed,
  adjustVacationBonus,
  adjustAdminBonus,
}
