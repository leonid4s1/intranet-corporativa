// server/src/controllers/userController.js
import User from '../models/User.js';
import VacationData from '../models/VacationData.js';

// ==============================
// Constantes para mensajes
// ==============================
const ERROR_MESSAGES = {
  USER_NOT_FOUND: 'Usuario no encontrado',
  PASSWORD_REQUIRED: 'La nueva contraseña es requerida',
  EMAIL_IN_USE: 'El email ya está en uso',
  DEFAULT_ERROR: 'Error en el servidor'
};

// ==============================
// Helper: mapear usuario + vacaciones
// ==============================
const mapUserWithVacation = (user, vacationMap) => {
  const vacation = vacationMap.get(user._id.toString());
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    isVerified: user.isVerified,
    email_verified_at: user.email_verified_at,
    createdAt: user.createdAt,
    vacationDays: vacation
      ? { total: vacation.total, used: vacation.used, remaining: vacation.remaining }
      : { total: 0, used: 0, remaining: 0 }
  };
};

// ==============================
// GET /api/users
// ==============================
export const getUsers = async (req, res) => {
  try {
    const [users, vacationDataList] = await Promise.all([
      User.find()
        .select('name email role isActive isVerified email_verified_at createdAt')
        .lean()
        .exec(),
      VacationData.find().lean().exec()
    ]);

    const vacationMap = new Map(vacationDataList.map(v => [v.user.toString(), v]));

    res.set('Cache-Control', 'no-store');
    return res.status(200).json({
      success: true,
      data: users.map(user => mapUserWithVacation(user, vacationMap))
    });
  } catch (error) {
    console.error('Error en getUsers:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener usuarios',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

// ==============================
// POST /api/users
// Crear usuario (admin)
// Body: { name, email, password, role?, isActive?, isVerified?, availableDays? }
// ==============================
export const createUser = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role = 'user',
      isActive = true,
      isVerified = false,
      availableDays
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Nombre, email y contraseña son requeridos' });
    }

    const exists = await User.findOne({ email }).lean().exec();
    if (exists) {
      return res.status(409).json({ success: false, message: 'El email ya está en uso' });
    }

    if (!['admin', 'user', 'moderator'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Rol no válido' });
    }

    const user = new User({
      name,
      email,
      password, // se hashea en el pre('save')
      role,
      isActive,
      isVerified,
      email_verified_at: isVerified ? new Date() : undefined
    });

    if (typeof availableDays === 'number' && availableDays >= 0) {
      user.vacationDays.total = Math.floor(availableDays);
      user.vacationDays.used = 0;
    }

    await user.save();

    return res.status(201).json({
      success: true,
      message: 'Usuario creado',
      user: user.toObject()
    });
  } catch (error) {
    console.error('Error creando usuario:', error);
    return res.status(500).json({ success: false, message: 'Error al crear usuario' });
  }
};

// ==============================
// DELETE /api/users/:id
// ==============================
export const deleteUser = async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id);
    if (!deletedUser) {
      return res.status(404).json({ success: false, message: ERROR_MESSAGES.USER_NOT_FOUND });
    }
    return res.json({
      success: true,
      message: 'Usuario eliminado',
      userId: req.params.id
    });
  } catch (error) {
    console.error('Error eliminando usuario:', error);
    return res.status(500).json({
      success: false,
      message: ERROR_MESSAGES.DEFAULT_ERROR,
      error: error.message
    });
  }
};

// ==============================
// PATCH /api/users/:id/role
// Body: { role: 'admin' | 'user' }
// ==============================
export const updateUserRole = async (req, res) => {
  try {
    if (!['admin', 'user'].includes(req.body.role)) {
      return res.status(400).json({ success: false, message: 'Rol no válido' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role: req.body.role },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: ERROR_MESSAGES.USER_NOT_FOUND });
    }

    return res.json({
      success: true,
      message: 'Rol actualizado',
      user
    });
  } catch (error) {
    console.error('Error actualizando rol:', error);
    return res.status(500).json({
      success: false,
      message: ERROR_MESSAGES.DEFAULT_ERROR,
      error: error.message
    });
  }
};

// ==============================
// PATCH /api/users/:id/lock
// ==============================
export const toggleUserLock = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: ERROR_MESSAGES.USER_NOT_FOUND });
    }

    user.isActive = !user.isActive;
    await user.save();

    return res.json({
      success: true,
      message: user.isActive ? 'Usuario activado' : 'Usuario desactivado',
      user: {
        id: user._id,
        name: user.name,
        isActive: user.isActive
      }
    });
  } catch (error) {
    console.error('Error cambiando estado usuario:', error);
    return res.status(500).json({
      success: false,
      message: ERROR_MESSAGES.DEFAULT_ERROR,
      error: error.message
    });
  }
};

// ==============================
// PATCH /api/users/:id/password
// Body: { newPassword }
// ==============================
export const updateUserPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'La contraseña debe tener al menos 8 caracteres'
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: ERROR_MESSAGES.USER_NOT_FOUND });
    }

    user.password = newPassword; // se hashea en pre('save')
    await user.save();

    return res.json({
      success: true,
      message: 'Contraseña actualizada'
    });
  } catch (error) {
    console.error('Error actualizando contraseña:', error);
    return res.status(500).json({
      success: false,
      message: ERROR_MESSAGES.DEFAULT_ERROR,
      error: error.message
    });
  }
};

// ==============================
// PATCH /api/users/:id/name   (Compat con updateUserData)
// Body: { name, email }  → si usas wrapper en la ruta, este controller puede recibir ambos.
// ==============================
// PUT/PATCH /api/users/:id
export const updateUserData = async (req, res) => {
  try {
    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'Nombre y email son requeridos' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { name, email },
      { new: true, runValidators: true, context: 'query' }
    ).select('-password -refreshToken');

    if (!user) {
      return res.status(404).json({ success: false, message: ERROR_MESSAGES.USER_NOT_FOUND });
    }

    return res.json({
      success: true,
      message: 'Datos actualizados',
      user
    });
  } catch (error) {
    console.error('Error actualizando datos:', error);
    const message = error.code === 11000
      ? ERROR_MESSAGES.EMAIL_IN_USE
      : ERROR_MESSAGES.DEFAULT_ERROR;

    return res.status(500).json({
      success: false,
      message,
      error: error.message
    });
  }
};

// ==============================
// VACACIONES
// ==============================

// PATCH /api/users/:id/vacation/total
// Establecer el número TOTAL de días (reemplaza el total actual)
export const setVacationTotal = async (req, res) => {
  try {
    const { id } = req.params;
    const { total } = req.body;

    if (total == null || isNaN(total) || Number(total) < 0) {
      return res.status(400).json({ success: false, message: 'total debe ser un número >= 0' });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: ERROR_MESSAGES.USER_NOT_FOUND });

    const used = user.vacationDays?.used ?? 0;
    if (Number(total) < used) {
      return res.status(400).json({ success: false, message: 'El total no puede ser menor que los usados' });
    }

    await user.setVacationDays(Math.floor(Number(total))); // dispara post-save (sync con VacationData)

    return res.json({
      success: true,
      message: 'Días de vacaciones (total) actualizados',
      data: user.vacationDays
    });
  } catch (error) {
    console.error('setVacationTotal error:', error);
    return res.status(500).json({ success: false, message: 'Error actualizando días', error: error.message });
  }
};

// POST /api/users/:id/vacation/add
// Sumar N días al total actual (bonificación)
export const addVacationDays = async (req, res) => {
  try {
    const { id } = req.params;
    const { days } = req.body;

    if (days == null || isNaN(days) || Number(days) <= 0) {
      return res.status(400).json({ success: false, message: 'days debe ser un entero > 0' });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: ERROR_MESSAGES.USER_NOT_FOUND });

    await user.addVacationDays(Math.floor(Number(days))); // dispara post-save (sync con VacationData)

    return res.json({
      success: true,
      message: 'Días añadidos',
      data: user.vacationDays
    });
  } catch (error) {
    console.error('addVacationDays error:', error);
    return res.status(500).json({ success: false, message: 'Error añadiendo días', error: error.message });
  }
};

// PATCH /api/users/:id/vacation/used
// Establecer directamente los días USADOS
export const setVacationUsed = async (req, res) => {
  try {
    const { id } = req.params;
    const { used } = req.body;

    if (used == null || isNaN(used) || Number(used) < 0) {
      return res.status(400).json({ success: false, message: 'used debe ser un número >= 0' });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: ERROR_MESSAGES.USER_NOT_FOUND });

    const total = user.vacationDays?.total ?? 0;
    if (Number(used) > total) {
      return res.status(400).json({ success: false, message: 'Los días usados no pueden exceder el total' });
    }

    user.vacationDays.used = Math.floor(Number(used));
    user.vacationDays.lastUpdate = new Date();
    await user.save(); // dispara post-save (sync con VacationData)

    return res.json({
      success: true,
      message: 'Días usados actualizados',
      data: user.vacationDays
    });
  } catch (error) {
    console.error('setVacationUsed error:', error);
    return res.status(500).json({ success: false, message: 'Error actualizando días usados', error: error.message });
  }
};

// (OPCIONAL) PATCH /api/users/:id/vacation/available
// Establecer directamente los días DISPONIBLES (remaining): total = used + available
export const setVacationAvailable = async (req, res) => {
  try {
    const { id } = req.params;
    const { available } = req.body;

    if (available == null || isNaN(available) || Number(available) < 0) {
      return res.status(400).json({ success: false, message: 'available debe ser >= 0' });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: ERROR_MESSAGES.USER_NOT_FOUND });

    const used = user.vacationDays?.used ?? 0;
    const newTotal = Math.floor(used + Number(available));
    await user.setVacationDays(newTotal); // dispara post-save

    return res.json({
      success: true,
      message: 'Días disponibles actualizados',
      data: user.vacationDays
    });
  } catch (error) {
    console.error('setVacationAvailable error:', error);
    return res.status(500).json({ success: false, message: 'Error actualizando disponibles', error: error.message });
  }
};
