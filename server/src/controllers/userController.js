// server/src/controllers/userController.js
import User from '../models/User.js'
import VacationData from '../models/VacationData.js'

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
   Helpers
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

// Asegura que el subdocumento exista
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
      // Ya existe; solo actualiza
      await VacationData.updateOne(filter, { $set }, { runValidators: true })
    } else {
      throw err
    }
  }
  return { total, used, remaining }
}

// Mapea el usuario + datos de vacaciones con fallback a user.vacationDays
const mapUserWithVacation = (user, vacationMap) => {
  const vacDoc = vacationMap.get(user._id.toString())

  const uVac = user.vacationDays ?? { total: 0, used: 0 }
  const base = {
    total: toNum(uVac.total, 0),
    used: toNum(uVac.used, 0),
  }
  const fallback = {
    ...base,
    remaining: Math.max(0, base.total - base.used),
  }

  const fromDoc = vacDoc
    ? {
        total: toNum(vacDoc.total, 0),
        used: toNum(vacDoc.used, 0),
        remaining:
          vacDoc.remaining != null
            ? toNum(vacDoc.remaining, 0)
            : Math.max(0, toNum(vacDoc.total, 0) - toNum(vacDoc.used, 0)),
      }
    : null

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    isVerified: user.isVerified,
    email_verified_at: user.email_verified_at,
    createdAt: user.createdAt,
    vacationDays: fromDoc || fallback,
  }
}

/* ==============================
   GET /api/users
============================== */
export const getUsers = async (_req, res) => {
  try {
    const [users, vacationDataList] = await Promise.all([
      User.find()
        .select('name email role isActive isVerified email_verified_at createdAt vacationDays')
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
   Body: { name, email, password, role?, isActive?, isVerified?, availableDays? }
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

    const user = new User({
      name,
      email,
      password, // se hashea en pre('save')
      role,
      isActive,
      isVerified,
      email_verified_at: isVerified ? new Date() : undefined,
    })

    ensureVacSubdoc(user)
    if (typeof availableDays === 'number' && availableDays >= 0) {
      user.vacationDays.total = Math.floor(availableDays)
      user.vacationDays.used = 0
    }
    user.vacationDays.lastUpdate = new Date()

    await user.save()
    await upsertVacationData(user)

    return res.status(201).json({
      success: true,
      message: 'Usuario creado',
      user: user.toObject(),
    })
  } catch (error) {
    console.error('Error creando usuario:', error)
    return res
      .status(500)
      .json({ success: false, message: 'Error al crear usuario', error: error.message })
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
   Body: { role: 'admin' | 'user' | 'moderator' }
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
      user,
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
      user: {
        id: user._id.toString(),
        name: user.name,
        isActive: user.isActive,
      },
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
   Body: { newPassword }
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

    return res.json({
      success: true,
      message: 'Contraseña actualizada',
    })
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
      user,
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
   VACACIONES
============================== */

/** PATCH /api/users/:id/vacation/total  { total } */
export const setVacationTotal = async (req, res) => {
  try {
    const { id } = req.params
    const total = toInt(req.body.total, -1)

    if (total < 0) {
      return res.status(400).json({ success: false, message: 'total debe ser un número >= 0' })
    }

    const user = await User.findById(id)
    if (!user) {
      return res.status(404).json({ success: false, message: ERROR_MESSAGES.USER_NOT_FOUND })
    }

    ensureVacSubdoc(user)

    const used = toInt(user.vacationDays?.used, 0)
    if (total < used) {
      return res
        .status(400)
        .json({ success: false, message: 'El total no puede ser menor que los usados' })
    }

    user.vacationDays.total = total
    user.vacationDays.lastUpdate = new Date()
    await user.save()
    const sync = await upsertVacationData(user)

    return res.json({
      success: true,
      message: 'Días de vacaciones (total) actualizados',
      data: sync,
    })
  } catch (error) {
    console.error('setVacationTotal error:', error)
    return res
      .status(500)
      .json({ success: false, message: 'Error actualizando días', error: error.message, code: error?.code })
  }
}

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
