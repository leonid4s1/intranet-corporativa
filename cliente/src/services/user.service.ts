// cliente/src/services/user.service.ts
import api from '@/services/api'

/* ========== Tipos públicos ========== */
export type Role = 'user' | 'admin' | (string & {})

export interface User {
  id: string
  name: string
  email: string
  role: Role
  isActive: boolean
  email_verified_at?: string | null
}

export interface UpdateNamePayload {
  name: string
}

export interface UpdatePasswordPayload {
  newPassword: string
}

/* Auth payloads */
export interface LoginPayload { email: string; password: string }
export interface RegisterPayload { name: string; email: string; password: string }

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

/** Normaliza un usuario venido del backend (con o sin envoltorio `data`) */
function normalizeUser(raw: unknown): User | null {
  const r =
    isRecord(raw) ? raw
    : isRecord((raw as { data?: unknown })?.data)
      ? ((raw as { data: unknown }).data as Record<string, unknown>)
      : null

  if (!r) return null

  const id = toStr(get(r, 'id')) ?? toStr(get(r, '_id'))
  if (!id) return null

  const name = toStr(get(r, 'name')) ?? 'Usuario'
  const email = toStr(get(r, 'email')) ?? 'no-email@example.com'
  const role = (toStr(get(r, 'role')) ?? 'user') as Role

  // isActive puede venir como isActive/active o invertido locked/disabled
  const isActive =
    toBool(get(r, 'isActive')) ??
    toBool(get(r, 'active')) ??
    (toBool(get(r, 'locked')) !== undefined ? !toBool(get(r, 'locked'))! : undefined) ??
    (toBool(get(r, 'disabled')) !== undefined ? !toBool(get(r, 'disabled'))! : true)

  const email_verified_at =
    toStr(get(r, 'email_verified_at')) ??
    toStr(get(r, 'emailVerifiedAt')) ??
    undefined

  return { id, name, email, role, isActive: isActive ?? true, email_verified_at }
}

function unwrapList(data: unknown): unknown[] {
  if (isRecord(data) && Array.isArray(get<unknown[]>(data, 'data'))) {
    return (get<unknown[]>(data, 'data') as unknown[]) ?? []
  }
  return Array.isArray(data) ? data : []
}

/* ========== AUTH (usa siempre api con baseURL correcto) ========== */

/** POST /auth/login */
async function login(payload: LoginPayload): Promise<void> {
  await api.post('/auth/login', payload)
}

/** POST /auth/register */
async function register(payload: RegisterPayload): Promise<void> {
  await api.post('/auth/register', payload)
}

/** GET /auth/profile -> User */
async function getProfile(): Promise<User> {
  const { data } = await api.get('/auth/profile')
  const user = normalizeUser(isRecord(data) ? (get(data as Record<string, unknown>, 'user') ?? data) : data)
  if (!user) throw new Error('Respuesta inválida al cargar perfil')
  return user
}

/** POST /auth/logout */
async function logout(): Promise<void> {
  await api.post('/auth/logout')
}

/* ========== USERS (admin) ========== */

/** GET /users -> User[] (acepta también {data:User[]}) */
export async function getAllUsers(): Promise<User[]> {
  const { data } = await api.get('/users')
  return unwrapList(data)
    .map(normalizeUser)
    .filter((u): u is User => !!u)
}

/** PATCH /users/:id { name } -> User */
export async function updateUserName(userId: string, payload: UpdateNamePayload): Promise<User> {
  const { data } = await api.patch(`/users/${encodeURIComponent(userId)}`, { name: payload.name })
  const user = normalizeUser(data)
  if (!user) throw new Error('Respuesta inválida al actualizar nombre')
  return user
}

/** POST /users/:id/toggle-lock -> { id, isActive } (acepta también respuestas con {data}) */
export async function toggleUserLock(
  userId: string
): Promise<{ id: string; isActive: boolean }> {
  const { data } = await api.post(`/users/${encodeURIComponent(userId)}/toggle-lock`)

  // ✅ sin `any`
  const container: unknown = isRecord(data) ? (get<unknown>(data, 'data') ?? data) : data

  if (isRecord(container)) {
    const id =
      toStr(get(container, 'id')) ??
      toStr(get(container, '_id')) ??
      userId

    const isActive =
      toBool(get(container, 'isActive')) ??
      toBool(get(container, 'active')) ??
      (toBool(get(container, 'locked')) !== undefined
        ? !toBool(get(container, 'locked'))!
        : undefined) ??
      true

    return { id, isActive: !!isActive }
  }

  return { id: userId, isActive: true }
}


/** PATCH /users/:id/password { newPassword } -> { success } */
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

/** DELETE /users/:id -> { success } */
export async function deleteUser(userId: string): Promise<{ success: boolean }> {
  const { data } = await api.delete(`/users/${encodeURIComponent(userId)}`)
  const success = isRecord(data) ? (get<boolean>(data, 'success') ?? true) : true
  return { success }
}

/* ========== Export por defecto (compat con imports actuales) ========== */
export default {
  // auth
  login,
  register,
  getProfile,
  logout,
  // admin users
  getAllUsers,
  updateUserName,
  toggleUserLock,
  updateUserPassword,
  deleteUser,
}
