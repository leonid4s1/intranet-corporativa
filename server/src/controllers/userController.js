// server/src/controllers/userController.js
import User from '../models/User.js'
import VacationData from '../models/VacationData.js'
// --- LFT MX 2023: utilidades y servicio de cómputo del ciclo vigente
import {
  currentEntitlementDays,
  currentAnniversaryWindow,
  yearsOfService,
} from '../utils/vacationLawMX.js';
import { getUsedDaysInCurrentCycle } from '../services/vacationService.js';

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
    user.vacationDays = { total: 0, used: 0, lastUpdate: new Date() }
  } else {
    if (typeof user.vacationDays.total !== 'number') user.vacationDays.total = 0
    if (typeof user.vacationDays.used !== 'number') user.vacationDays.used = 0
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
   Mapper con vacaciones + meta
============================== */
const mapUserWithVacation = (user, vacationMap) => {
  const vacDoc = vacationMap.get(user._id.toString()) || null

  const uVac = user?.vacationDays ?? { total: 0, used: 0, lastUpdate: null }
  const dVac = vacDoc ?? { total: 0, used: 0, lastUpdate: null }

  const uDate = uVac?.lastUpdate ? new Date(uVac.lastUpdate).getTime() : 0
  const dDate = dVac?.lastUpdate ? new Date(dVac.lastUpdate).getTime() : 0

  let chosen = null
  if (uDate > dDate) {
    chosen = { total: toNum(uVac.total, 0), used: toNum(uVac.used, 0) }
  } else if (dDate > uDate) {
    chosen = { total: toNum(dVac.total, 0), used: toNum(dVac.used, 0) }
  } else {
    const uZero = !(toNum(uVac.total, 0) || toNum(uVac.used, 0))
    const dZero = !(toNum(dVac.total, 0) || toNum(dVac.used, 0))
    if (!uZero && dZero) chosen = { total: toNum(uVac.total, 0), used: toNum(uVac.used, 0) }
    else if (!dZero && uZero) chosen = { total: toNum(dVac.total, 0), used: toNum(dVac.used, 0) }
    else chosen = vacDoc
      ? { total: toNum(dVac.total, 0), used: toNum(dVac.used, 0) }
      : { total: toNum(uVac.total, 0), used: toNum(uVac.used, 0) }
  }

  const remaining =
    vacDoc && dDate >= uDate && vacDoc.remaining != null
      ? toNum(vacDoc.remaining, Math.max(0, chosen.total - chosen.used))
      : Math.max(0, chosen.total - chosen.used)

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    isVerified: user.isVerified,
    email_verified_at: user.email_verified_at,
    createdAt: user.createdAt,
    // 👇 NUEVO: meta laboral
    position: user.position ?? null,
    birthDate: user.birthDate ?? null,
    hireDate: user.hireDate ?? null,
    // vacaciones
    vacationDays: { total: chosen.total, used: chosen.used, remaining },
  }
}

/* ==============================
   GET /api/users
============================== */
export const getUsers = async (_req, res) => {
  try {
    const [users, vacationDataList] = await Promise.all([
      User.find()
        // 👇 añadimos campos nuevos
        .select('name email role isActive isVerified email_verified_at createdAt vacationDays position birthDate hireDate')
        .lean()
        .exec(),
      VacationData.find().lean().exec(),
    ])

    const vacationMap = new Map(vacationDataList.map((v) => [v.user.toString(), v]))

    res.set('Cache-Control', 'no-store')
    return res.status(200).json({
      success: true,
      data: users.map((u) => mapUserWithVacation(u, vacationMap)),
    })
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
   Body: { name, email, password, role?, isActive?, isVerified?, availableDays?, position?, birthDate?, hireDate? }
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
      availableDays,
      // 👇 nuevos campos
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
      password, // se hashea en pre('save')
      role,
      isActive,
      isVerified,
      email_verified_at: isVerified ? new Date() : undefined,
      // 👇 meta laboral
      position: typeof position === 'string' && position.trim() ? position.trim() : undefined,
      birthDate: bd,
      hireDate: hd,
    })

    ensureVacSubdoc(user)
    if (typeof availableDays === 'number' && availableDays >= 0) {
      user.vacationDays.total = Math.floor(availableDays)
      user.vacationDays.used = 0
    }
    user.vacationDays.lastUpdate = new Date()

    await user.save()
    await upsertVacationData(user)

    // ---- RESPUESTA
    res.status(201).json({
      success: true,
      message: 'Usuario creado',
      user: mapUserWithVacation(user.toObject(), new Map()),
    })

    // ---- Envío de verificación en background (solo si falta verificar)
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
          console.error('[createUser] Error al enviar verificación en background:', err?.message || err)
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

    return res.json({
      success: true,
      message: 'Rol actualizado',
      user: mapUserWithVacation(user.toObject(), new Map()),
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
    const { newPassword } = req.body
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'La contraseña debe tener al menos 8 caracteres',
      })
    }

    const user = await User.findById(req.params.id)
    if (!user) {
      return res.status(404).json({ success: false, message: ERROR_MESSAGES.USER_NOT_FOUND })
    }

    user.password = newPassword // se hashea en pre('save')
    await user.save()

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
   Body: { name?, email? }
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

    return res.json({
      success: true,
      message: 'Datos actualizados',
      user: mapUserWithVacation(user.toObject(), new Map()),
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
   Body: { position?, birthDate?, hireDate? }
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

    // Asignaciones
    if (position !== undefined) {
      const p = typeof position === 'string' ? position.trim() : ''
      user.position = p || undefined
    }
    user.birthDate = bd
    user.hireDate = hd

    await user.save()

    return res.json({
      success: true,
      message: 'Metadata actualizada',
      user: mapUserWithVacation(user.toObject(), new Map()),
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
   VACACIONES
============================== */

/** PATCH /api/users/:id/vacation/total  { total } */
export const setVacationTotal = async (req, res) => {
  const { id } = req.params;
  const rawTotal = req.body?.total;

  try {
    console.log('[setVacationTotal] IN', { id, body: req.body });

    const total = Math.max(0, Math.floor(Number(rawTotal)));
    if (!Number.isFinite(total)) {
      return res.status(400).json({ success: false, message: 'total debe ser un número >= 0' });
    }

    const u = await User.findById(id).select('vacationDays.used').lean();
    if (!u) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    const used = Math.max(0, Math.floor(Number(u?.vacationDays?.used ?? 0)));
    if (total < used) {
      return res
        .status(400)
        .json({ success: false, message: 'El total no puede ser menor que los usados', meta: { total, used } });
    }

    const upd = await User.updateOne(
      { _id: id },
      { $set: { 'vacationDays.total': total, 'vacationDays.lastUpdate': new Date() } },
      { runValidators: false }
    );
    console.log('[setVacationTotal] User.updateOne result', upd);

    const remaining = Math.max(0, total - used);

    res.json({
      success: true,
      message: 'Días de vacaciones (total) actualizados',
      data: { total, used, remaining },
    });

    setImmediate(async () => {
      try {
        const updv = await VacationData.updateOne(
          { user: id },
          {
            $set: { total, used, remaining, lastUpdate: new Date() },
            $setOnInsert: { user: id },
          },
          { upsert: true, runValidators: false }
        );
        console.log('[setVacationTotal/bg] VacationData.updateOne OK', updv?.acknowledged, updv);
      } catch (err) {
        if (err?.code === 11000) {
          const updv2 = await VacationData.updateOne(
            { user: id },
            { $set: { total, used, remaining, lastUpdate: new Date() } },
            { runValidators: false }
          );
          console.warn('[setVacationTotal/bg] E11000 retry OK', updv2?.acknowledged, updv2);
        } else {
          console.error('[setVacationTotal/bg] ERROR sync VacationData:', {
            name: err?.name, code: err?.code, msg: err?.message, stack: err?.stack?.split('\n')[0],
          });
        }
      }
    });
  } catch (error) {
    console.error('setVacationTotal error (outer catch):', {
      id, body: req.body, name: error?.name, code: error?.code, msg: error?.message,
    });
    return res.status(500).json({
      success: false,
      message: 'Error actualizando días',
      error: error?.message || String(error),
    });
  }
};

/** POST /api/users/:id/vacation/add  { days } */
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

    return res.json({
      success: true,
      message: 'Días añadidos',
      data: sync,
    })
  } catch (error) {
    console.error('addVacationDays error:', error)
    return res
      .status(500)
      .json({ success: false, message: 'Error añadiendo días', error: error.message, code: error?.code })
  }
}

/** PATCH /api/users/:id/vacation/used  { used } */
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
      return res
        .status(400)
        .json({ success: false, message: 'Los días usados no pueden exceder el total' })
    }

    user.vacationDays.used = used
    user.vacationDays.lastUpdate = new Date()
    await user.save()
    const sync = await upsertVacationData(user)

    return res.json({
      success: true,
      message: 'Días usados actualizados',
      data: sync,
    })
  } catch (error) {
    console.error('setVacationUsed error:', error)
    return res.status(500).json({
      success: false,
      message: 'Error actualizando días usados',
      error: error.message,
      code: error?.code,
    })
  }
}

/** (OPCIONAL) PATCH /api/users/:id/vacation/available  { available } */
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

    return res.json({
      success: true,
      message: 'Días disponibles actualizados',
      data: sync,
    })
  } catch (error) {
    console.error('setVacationAvailable error:', error)
    return res.status(500).json({
      success: false,
      message: 'Error actualizando disponibles',
      error: error.message,
      code: error?.code,
    })
  }
}

/* ==============================
   LFT MX 2023 — Resumen de vacaciones por usuario
   GET /api/users/:userId/vacation/summary
============================== */
export const getUserVacationSummary = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId)
      .select('name email hireDate')
      .lean()
      .exec();

    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }
    if (!user.hireDate) {
      return res.status(400).json({
        success: false,
        message: 'El usuario no tiene fecha de ingreso (hireDate) configurada',
      });
    }

    // Total del ciclo vigente (derecho del año que se cumple)
    const total = currentEntitlementDays(user.hireDate);

    // Usados en el ciclo vigente (solicitudes aprobadas, recortadas a la ventana)
    const used = await getUsedDaysInCurrentCycle(user._id, user.hireDate);

    const remaining = Math.max(0, total - used);
    const window = currentAnniversaryWindow(user.hireDate);
    const yos = yearsOfService(user.hireDate);

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
          total,
          used,
          remaining,
          window, // { start: Date, end: Date }
          policy: 'LFT MX 2023',
        },
      },
    });
  } catch (error) {
    console.error('[getUserVacationSummary] error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener el resumen de vacaciones',
      error: error?.message,
    });
  }
};

