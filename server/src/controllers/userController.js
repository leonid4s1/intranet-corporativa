// server/src/controllers/userController.js
import bcrypt from 'bcryptjs'
import User from '../models/User.js'
import VacationData from '../models/VacationData.js'

// --- LFT MX 2023: utilidades y servicio de cómputo del ciclo vigente
import {
  currentEntitlementDays,
  currentAnniversaryWindow,
  yearsOfService,
} from '../utils/vacationLawMX.js'
import { getUsedDaysInCurrentCycle } from '../services/vacationService.js'

/* ==============================
   Constantes para mensajes
============================== */
const ERROR_MESSAGES = {
  USER_NOT_FOUND: 'Usuario no encontrado',
  PASSWORD_REQUIRED: 'La nueva contraseña es requerida',
  EMAIL_IN_USE: 'El email ya está en uso',
  DEFAULT_ERROR: 'Error en el servidor',
}

/* ==============================
   Helpers numéricos y fechas
============================== */
const toNum = (v, def = 0) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : def
}

// Entero >= 0
const toInt = (v, def = 0) => {
  const n = Math.floor(Number(v))
  return Number.isFinite(n) ? Math.max(0, n) : def
}

// --- Fechas ---
const isoDayRe = /^\d{4}-\d{2}-\d{2}$/
const toDateOnlyUTC = (val) => {
  if (val == null || val === '') return undefined
  if (val instanceof Date) {
    if (Number.isNaN(val.getTime())) return undefined
    const d = new Date(val)
    d.setUTCHours(0, 0, 0, 0)
    return d
  }
  if (typeof val === 'string') {
    if (!isoDayRe.test(val)) return undefined
    const d = new Date(val)
    if (Number.isNaN(d.getTime())) return undefined
    d.setUTCHours(0, 0, 0, 0)
    return d
  }
  return undefined
}
const todayUTC = () => {
  const t = new Date()
  t.setUTCHours(0, 0, 0, 0)
  return t
}
const isFutureUTC = (d) => d && d.getTime() > todayUTC().getTime()
const yearsBetween = (a, b) => (b.getTime() - a.getTime()) / (365.25 * 24 * 60 * 60 * 1000)

/* ==============================
   Asegura subdoc vacaciones
============================== */
const ensureVacSubdoc = (user) => {
  if (!user.vacationDays) {
    user.vacationDays = { total: 0, used: 0, adminExtra: 0, lastUpdate: new Date() }
  } else {
    if (typeof user.vacationDays.total !== 'number') user.vacationDays.total = 0
    if (typeof user.vacationDays.used !== 'number') user.vacationDays.used = 0
    if (typeof user.vacationDays.adminExtra !== 'number') user.vacationDays.adminExtra = 0
  }
}

// Sincroniza VacationData para un usuario, tolerando upserts concurrentes (E11000)
const upsertVacationData = async (userDoc) => {
  const total = toInt(userDoc?.vacationDays?.total, 0)
  const used = toInt(userDoc?.vacationDays?.used, 0)
  const remaining = Math.max(0, total - used)
  const filter = { user: userDoc._id }
  const $set = { total, used, remaining, lastUpdate: new Date() }

  try {
    await VacationData.updateOne(
      filter,
      { $set },
      { upsert: true, runValidators: true, setDefaultsOnInsert: true }
    )
  } catch (err) {
    if (err?.code === 11000) {
      await VacationData.updateOne(filter, { $set }, { runValidators: true })
    } else {
      throw err
    }
  }
  return { total, used, remaining }
}

/* ==============================
   Mapper con LFT (derecho + bono) y meta
============================== */
const mapUserWithVacationLFT = (user, usedInCycle = 0) => {
  const hireOk = !!user.hireDate
  const right = hireOk ? currentEntitlementDays(user.hireDate) : 0
  const adminExtra = toInt(user?.vacationDays?.adminExtra ?? 0, 0)
  const total = right + adminExtra
  const used = hireOk ? toInt(usedInCycle, 0) : 0
  const remaining = Math.max(0, total - used)

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    isVerified: user.isVerified,
    email_verified_at: user.email_verified_at,
    createdAt: user.createdAt,
    position: user.position ?? null,
    birthDate: user.birthDate ?? null,
    hireDate: user.hireDate ?? null,
    vacationDays: { right, adminExtra, total, used, remaining },
  }
}

/* ==============================
   GET /api/users
   -> Devuelve tabla con derecho+bono (total), usados del ciclo vigente y disponibles
============================== */
export const getUsers = async (_req, res) => {
  try {
    const users = await User.find()
      .select('name email role isActive isVerified email_verified_at createdAt vacationDays position birthDate hireDate')
      .lean()
      .exec()

    // Calcular usados del ciclo vigente por usuario (si tiene hireDate)
    const usedList = await Promise.all(
      users.map(u => u.hireDate ? getUsedDaysInCurrentCycle(u._id, u.hireDate) : Promise.resolve(0))
    )

    const data = users.map((u, idx) => mapUserWithVacationLFT(u, usedList[idx]))

    res.set('Cache-Control', 'no-store')
    return res.status(200).json({ success: true, data })
  } catch (error) {
    console.error('Error en getUsers:', error)
    return res.status(500).json({
      success: false,
      message: 'Error al obtener usuarios',
      error: error.message,
      timestamp: new Date().toISOString(),
    })
  }
}

/* ==============================
   POST /api/users   (admin)
============================== */
export const createUser = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role = 'user',
      isActive = true,
      isVerified = false,
      availableDays,   // compat
      position,
      birthDate,
      hireDate,
    } = req.body

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ success: false, message: 'Nombre, email y contraseña son requeridos' })
    }

    const exists = await User.findOne({ email }).lean().exec()
    if (exists) {
      return res.status(409).json({ success: false, message: 'El email ya está en uso' })
    }

    if (!['admin', 'user', 'moderator'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Rol no válido' })
    }

    // Validaciones de fechas
    const bd = toDateOnlyUTC(birthDate)
    const hd = toDateOnlyUTC(hireDate)

    if (bd && isFutureUTC(bd)) {
      return res.status(400).json({ success: false, message: 'La fecha de nacimiento no puede ser futura' })
    }
    if (hd && isFutureUTC(hd)) {
      return res.status(400).json({ success: false, message: 'La fecha de ingreso no puede ser futura' })
    }
    if (bd && hd && yearsBetween(bd, hd) < 14) {
      return res.status(400).json({ success: false, message: 'Ingreso inconsistente con el nacimiento (≥ 14 años)' })
    }

    const user = new User({
      name,
      email,
      password, // se hashea en pre('save') si lo mantienes
      role,
      isActive,
      isVerified,
      email_verified_at: isVerified ? new Date() : undefined,
      position: typeof position === 'string' && position.trim() ? position.trim() : undefined,
      birthDate: bd,
      hireDate: hd,
    })

    ensureVacSubdoc(user)

    // Compatibilidad: si llega availableDays, lo guardamos en total (legacy)
    if (typeof availableDays === 'number' && availableDays >= 0) {
      user.vacationDays.total = Math.floor(availableDays)
      user.vacationDays.used = 0
    }
    if (typeof user.vacationDays.adminExtra !== 'number') user.vacationDays.adminExtra = 0
    user.vacationDays.lastUpdate = new Date()

    await user.save()
    await upsertVacationData(user)

    // Respuesta usando el mapper LFT
    const used = user.hireDate ? await getUsedDaysInCurrentCycle(user._id, user.hireDate) : 0
    res.status(201).json({
      success: true,
      message: 'Usuario creado',
      user: mapUserWithVacationLFT(user.toObject(), used),
    })

    // Verificación por correo en background (si aplica)
    if (!isVerified) {
      setImmediate(async () => {
        try {
          const { sendVerificationForUser } = await import('./authController.js')
          if (typeof sendVerificationForUser === 'function') {
            await sendVerificationForUser(user._id)
          } else {
            console.warn('[createUser] Helper sendVerificationForUser no encontrado en authController.js')
          }
        } catch (err) {
          console.error('[createUser] Error al enviar verificación:', err?.message || err)
        }
      })
    }
  } catch (error) {
    console.error('Error creando usuario:', error)
    if (!res.headersSent) {
      return res
        .status(500)
        .json({ success: false, message: 'Error al crear usuario', error: error.message })
    }
  }
}

/* ==============================
   DELETE /api/users/:id
============================== */
export const deleteUser = async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id)
    if (!deletedUser) {
      return res.status(404).json({ success: false, message: ERROR_MESSAGES.USER_NOT_FOUND })
    }
    return res.json({
      success: true,
      message: 'Usuario eliminado',
      userId: req.params.id,
    })
  } catch (error) {
    console.error('Error eliminando usuario:', error)
    return res.status(500).json({
      success: false,
      message: ERROR_MESSAGES.DEFAULT_ERROR,
      error: error.message,
    })
  }
}

/* ==============================
   PATCH /api/users/:id/role
============================== */
export const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body
    if (!['admin', 'user', 'moderator'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Rol no válido' })
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true, runValidators: true }
    ).select('-password')

    if (!user) {
      return res.status(404).json({ success: false, message: ERROR_MESSAGES.USER_NOT_FOUND })
    }

    const used = user.hireDate ? await getUsedDaysInCurrentCycle(user._id, user.hireDate) : 0
    return res.json({
      success: true,
      message: 'Rol actualizado',
      user: mapUserWithVacationLFT(user.toObject(), used),
    })
  } catch (error) {
    console.error('Error actualizando rol:', error)
    return res.status(500).json({
      success: false,
      message: ERROR_MESSAGES.DEFAULT_ERROR,
      error: error.message,
    })
  }
}

/* ==============================
   PATCH /api/users/:id/lock
============================== */
export const toggleUserLock = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
    if (!user) {
      return res.status(404).json({ success: false, message: ERROR_MESSAGES.USER_NOT_FOUND })
    }

    user.isActive = !user.isActive
    await user.save()

    return res.json({
      success: true,
      message: user.isActive ? 'Usuario activado' : 'Usuario desactivado',
      user: { id: user._id.toString(), name: user.name, isActive: user.isActive },
    })
  } catch (error) {
    console.error('Error cambiando estado usuario:', error)
    return res.status(500).json({
      success: false,
      message: ERROR_MESSAGES.DEFAULT_ERROR,
      error: error.message,
    })
  }
}

/* ==============================
   PATCH /api/users/:id/password
============================== */
export const updateUserPassword = async (req, res) => {
  try {
    const userId = req.params.id

    // Acepta ambos nombres para compatibilidad (newPassword | password)
    const raw = (req.body?.newPassword ?? req.body?.password ?? '').toString().trim()

    if (!raw || raw.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'La contraseña debe tener al menos 8 caracteres',
      })
    }

    const user = await User.findById(userId).select('_id')
    if (!user) {
      return res.status(404).json({ success: false, message: ERROR_MESSAGES.USER_NOT_FOUND })
    }

    // Hash explícito
    const salt = await bcrypt.genSalt(10)
    const hash = await bcrypt.hash(raw, salt)

    await User.findByIdAndUpdate(
      userId,
      { password: hash, passwordChangedAt: new Date() },
      { new: true, runValidators: true }
    )

    return res.json({ success: true, message: 'Contraseña actualizada' })
  } catch (error) {
    console.error('Error actualizando contraseña:', error)
    return res.status(500).json({
      success: false,
      message: ERROR_MESSAGES.DEFAULT_ERROR,
      error: error.message,
    })
  }
}

/* ==============================
   PATCH /api/users/:id  ó  /api/users/:id/name
============================== */
export const updateUserData = async (req, res) => {
  try {
    const { name, email } = req.body

    const update = {}
    if (typeof name === 'string') update.name = name
    if (typeof email === 'string') update.email = email

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ success: false, message: 'No hay campos para actualizar' })
    }

    const user = await User.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
      context: 'query',
    }).select('-password -refreshToken')

    if (!user) {
      return res.status(404).json({ success: false, message: ERROR_MESSAGES.USER_NOT_FOUND })
    }

    const used = user.hireDate ? await getUsedDaysInCurrentCycle(user._id, user.hireDate) : 0
    return res.json({
      success: true,
      message: 'Datos actualizados',
      user: mapUserWithVacationLFT(user.toObject(), used),
    })
  } catch (error) {
    console.error('Error actualizando datos:', error)
    const message =
      error.code === 11000 ? ERROR_MESSAGES.EMAIL_IN_USE : ERROR_MESSAGES.DEFAULT_ERROR

    return res.status(500).json({
      success: false,
      message,
      error: error.message,
    })
  }
}

/* ==============================
   NUEVO: PATCH /api/users/:id/meta
============================== */
export const updateUserMeta = async (req, res) => {
  try {
    const { id } = req.params
    const { position, birthDate, hireDate } = req.body

    const user = await User.findById(id)
    if (!user) {
      return res.status(404).json({ success: false, message: ERROR_MESSAGES.USER_NOT_FOUND })
    }

    // Preparamos nuevos valores tomando en cuenta los actuales
    let bd = user.birthDate ?? undefined
    let hd = user.hireDate ?? undefined

    if (birthDate !== undefined) {
      if (birthDate === '' || birthDate === null) bd = undefined
      else {
        const parsed = toDateOnlyUTC(birthDate)
        if (!parsed) return res.status(400).json({ success: false, message: 'Formato de birthDate inválido (YYYY-MM-DD)' })
        if (isFutureUTC(parsed)) return res.status(400).json({ success: false, message: 'birthDate no puede ser futura' })
        bd = parsed
      }
    }

    if (hireDate !== undefined) {
      if (hireDate === '' || hireDate === null) hd = undefined
      else {
        const parsed = toDateOnlyUTC(hireDate)
        if (!parsed) return res.status(400).json({ success: false, message: 'Formato de hireDate inválido (YYYY-MM-DD)' })
        if (isFutureUTC(parsed)) return res.status(400).json({ success: false, message: 'hireDate no puede ser futura' })
        hd = parsed
      }
    }

    if (bd && hd && yearsBetween(bd, hd) < 14) {
      return res.status(400).json({ success: false, message: 'Ingreso inconsistente con nacimiento (≥ 14 años)' })
    }

    if (position !== undefined) {
      const p = typeof position === 'string' ? position.trim() : ''
      user.position = p || undefined
    }
    user.birthDate = bd
    user.hireDate = hd

    await user.save()

    const used = user.hireDate ? await getUsedDaysInCurrentCycle(user._id, user.hireDate) : 0
    return res.json({
      success: true,
      message: 'Metadata actualizada',
      user: mapUserWithVacationLFT(user.toObject(), used),
    })
  } catch (error) {
    console.error('Error actualizando metadata:', error)
    return res.status(500).json({
      success: false,
      message: ERROR_MESSAGES.DEFAULT_ERROR,
      error: error.message,
    })
  }
}

/* ==============================
   VACACIONES — compat (legacy)
============================== */

/** PATCH /api/users/:id/vacation/total  { total }  (legacy) */
export const setVacationTotal = async (req, res) => {
  const { id } = req.params
  const rawTotal = req.body?.total

  try {
    const total = Math.max(0, Math.floor(Number(rawTotal)))
    if (!Number.isFinite(total)) {
      return res.status(400).json({ success: false, message: 'total debe ser un número >= 0' })
    }

    const u = await User.findById(id).select('vacationDays.used').lean()
    if (!u) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' })
    }

    const used = Math.max(0, Math.floor(Number(u?.vacationDays?.used ?? 0)))
    if (total < used) {
      return res
        .status(400)
        .json({ success: false, message: 'El total no puede ser menor que los usados', meta: { total, used } })
    }

    await User.updateOne(
      { _id: id },
      { $set: { 'vacationDays.total': total, 'vacationDays.lastUpdate': new Date() } },
      { runValidators: false }
    )

    const remaining = Math.max(0, total - used)
    res.json({ success: true, message: 'Días de vacaciones (total) actualizados', data: { total, used, remaining } })

    setImmediate(async () => {
      try {
        await VacationData.updateOne(
          { user: id },
          {
            $set: { total, used, remaining, lastUpdate: new Date() },
            $setOnInsert: { user: id },
          },
          { upsert: true, runValidators: false }
        )
      } catch (err) {
        if (err?.code === 11000) {
          await VacationData.updateOne(
            { user: id },
            { $set: { total, used, remaining, lastUpdate: new Date() } },
            { runValidators: false }
          )
        } else {
          console.error('[setVacationTotal/bg] ERROR sync VacationData:', err?.message || err)
        }
      }
    })
  } catch (error) {
    console.error('setVacationTotal error:', error)
    return res.status(500).json({
      success: false,
      message: 'Error actualizando días',
      error: error?.message || String(error),
    })
  }
}

/** POST /api/users/:id/vacation/add  { days }  (legacy) */
export const addVacationDays = async (req, res) => {
  try {
    const { id } = req.params
    const add = toInt(req.body.days, 0)

    if (add <= 0) {
      return res.status(400).json({ success: false, message: 'days debe ser un entero > 0' })
    }

    const user = await User.findById(id)
    if (!user) {
      return res.status(404).json({ success: false, message: ERROR_MESSAGES.USER_NOT_FOUND })
    }

    ensureVacSubdoc(user)

    user.vacationDays.total = toInt(user.vacationDays?.total, 0) + add
    user.vacationDays.lastUpdate = new Date()
    await user.save()
    const sync = await upsertVacationData(user)

    return res.json({ success: true, message: 'Días añadidos', data: sync })
  } catch (error) {
    console.error('addVacationDays error:', error)
    return res.status(500).json({ success: false, message: 'Error añadiendo días', error: error.message })
  }
}

/** PATCH /api/users/:id/vacation/used  { used }  (legacy) */
export const setVacationUsed = async (req, res) => {
  try {
    const { id } = req.params
    const used = toInt(req.body.used, -1)

    if (used < 0) {
      return res.status(400).json({ success: false, message: 'used debe ser un número >= 0' })
    }

    const user = await User.findById(id)
    if (!user) {
      return res.status(404).json({ success: false, message: ERROR_MESSAGES.USER_NOT_FOUND })
    }

    ensureVacSubdoc(user)

    const total = toInt(user.vacationDays?.total, 0)
    if (used > total) {
      return res.status(400).json({ success: false, message: 'Los días usados no pueden exceder el total' })
    }

    user.vacationDays.used = used
    user.vacationDays.lastUpdate = new Date()
    await user.save()
    const sync = await upsertVacationData(user)

    return res.json({ success: true, message: 'Días usados actualizados', data: sync })
  } catch (error) {
    console.error('setVacationUsed error:', error)
    return res.status(500).json({
      success: false,
      message: 'Error actualizando días usados',
      error: error.message,
    })
  }
}

/** (OPCIONAL) PATCH /api/users/:id/vacation/available  { available }  (legacy) */
export const setVacationAvailable = async (req, res) => {
  try {
    const { id } = req.params
    const available = toInt(req.body.available, -1)

    if (available < 0) {
      return res.status(400).json({ success: false, message: 'available debe ser >= 0' })
    }

    const user = await User.findById(id)
    if (!user) {
      return res.status(404).json({ success: false, message: ERROR_MESSAGES.USER_NOT_FOUND })
    }

    ensureVacSubdoc(user)

    const used = toInt(user.vacationDays?.used, 0)
    const newTotal = Math.max(0, used + available)

    user.vacationDays.total = newTotal
    user.vacationDays.lastUpdate = new Date()
    await user.save()
    const sync = await upsertVacationData(user)

    return res.json({ success: true, message: 'Días disponibles actualizados', data: sync })
  } catch (error) {
    console.error('setVacationAvailable error:', error)
    return res.status(500).json({
      success: false,
      message: 'Error actualizando disponibles',
      error: error.message,
    })
  }
}

/* ==============================
   LFT MX 2023 — Resumen por usuario
============================== */
export const getUserVacationSummary = async (req, res) => {
  try {
    const { userId } = req.params

    const user = await User.findById(userId)
      .select('name email hireDate vacationDays')
      .lean()
      .exec()

    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' })
    }
    if (!user.hireDate) {
      return res.status(400).json({
        success: false,
        message: 'El usuario no tiene fecha de ingreso (hireDate) configurada',
      })
    }

    const right = currentEntitlementDays(user.hireDate)
    const adminExtra = toInt(user?.vacationDays?.adminExtra ?? 0, 0)
    const total = right + adminExtra
    const used = await getUsedDaysInCurrentCycle(user._id, user.hireDate)
    const remaining = Math.max(0, total - used)
    const window = currentAnniversaryWindow(user.hireDate)
    const yos = yearsOfService(user.hireDate)

    return res.json({
      success: true,
      data: {
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          hireDate: user.hireDate,
          yearsOfService: yos,
        },
        vacation: {
          right,
          adminExtra,
          total,
          used,
          remaining,
          window, // { start: Date, end: Date }
          policy: 'LFT MX 2023',
        },
      },
    })
  } catch (error) {
    console.error('[getUserVacationSummary] error:', error)
    return res.status(500).json({
      success: false,
      message: 'Error al obtener el resumen de vacaciones',
      error: error?.message,
    })
  }
}

/* ==============================
   NUEVO — Bono admin (aumentar o disminuir)
   PATCH /api/users/:id/vacation/bonus
   Body: { delta?: number }  ó  { value?: number }
   Regla: adminExtra >= 0  → total = derecho + adminExtra (no puede bajar del derecho)
============================== */
export const adjustAdminExtra = async (req, res) => {
  try {
    const { id } = req.params
    const hasDelta = Number.isFinite(Number(req.body?.delta))
    const hasValue = Number.isFinite(Number(req.body?.value))
    if (!hasDelta && !hasValue) {
      return res.status(400).json({ success: false, message: 'Debes enviar delta o value numérico' })
    }

    const user = await User.findById(id).select('hireDate vacationDays').lean()
    if (!user) return res.status(404).json({ success: false, message: ERROR_MESSAGES.USER_NOT_FOUND })
    if (!user.hireDate) {
      return res.status(400).json({ success: false, message: 'Falta hireDate para calcular derecho' })
    }

    const right = currentEntitlementDays(user.hireDate)
    const currentExtra = toInt(user?.vacationDays?.adminExtra ?? 0, 0)

    let newExtra = hasValue
      ? Math.floor(Number(req.body.value))
      : currentExtra + Math.floor(Number(req.body.delta))

    // Nunca por debajo del derecho: adminExtra no puede ser negativo
    if (!Number.isFinite(newExtra)) newExtra = currentExtra
    if (newExtra < 0) newExtra = 0

    await User.updateOne(
      { _id: id },
      { $set: { 'vacationDays.adminExtra': newExtra, 'vacationDays.lastUpdate': new Date() } },
      { runValidators: false }
    )

    // Sincronía de compat con VacationData (opcional)
    const used = await getUsedDaysInCurrentCycle(id, user.hireDate)
    const totalCompat = right + newExtra
    try {
      await VacationData.updateOne(
        { user: id },
        { $set: { total: totalCompat, used, remaining: Math.max(totalCompat - used, 0), lastUpdate: new Date() } },
        { upsert: true, runValidators: false }
      )
    } catch { /* noop */ }

    return res.json({
      success: true,
      data: { right, adminExtra: newExtra, total: right + newExtra }
    })
  } catch (error) {
    console.error('[adjustAdminExtra] error:', error)
    return res.status(500).json({ success: false, message: 'Error ajustando bono', error: error?.message })
  }
}
