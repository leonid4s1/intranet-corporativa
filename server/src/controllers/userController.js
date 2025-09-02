import User from '../models/User.js';
import VacationData from '../models/VacationData.js';

// Constantes para mensajes
const ERROR_MESSAGES = {
  USER_NOT_FOUND: 'Usuario no encontrado',
  PASSWORD_REQUIRED: 'La nueva contraseña es requerida',
  EMAIL_IN_USE: 'El email ya está en uso',
  DEFAULT_ERROR: 'Error en el servidor'
};

// Función para mapear usuario con datos de vacaciones
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
    vacationDays: vacation ? {
      total: vacation.total,
      used: vacation.used,
      remaining: vacation.remaining
    } : { total: 0, used: 0, remaining: 0 }
  };
};

// Obtener todos los usuarios
export const getUsers = async (req, res) => {
  try {
    const [users, vacationDataList] = await Promise.all([
      User.find()
        .select('name email role isActive isVerified email_verified_at createdAt')
        .lean()
        .exec(),
      VacationData.find().lean().exec()
    ]);

    const vacationMap = new Map(
      vacationDataList.map(v => [v.user.toString(), v])
    );

    res.set('Cache-Control', 'no-store');
    res.status(200).json({
      success: true,
      data: users.map(user => mapUserWithVacation(user, vacationMap))
    });
    
  } catch (error) {
    console.error('Error en getUsers:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al obtener usuarios',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

// Eliminar usuario
export const deleteUser = async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id);
    if (!deletedUser) {
      return res.status(404).json({ message: ERROR_MESSAGES.USER_NOT_FOUND });
    }
    res.json({ 
      success: true,
      message: 'Usuario eliminado',
      userId: req.params.id
    });
  } catch (error) {
    console.error('Error eliminando usuario:', error);
    res.status(500).json({ 
      success: false,
      message: ERROR_MESSAGES.DEFAULT_ERROR,
      error: error.message
    });
  }
};

// Actualizar rol
export const updateUserRole = async (req, res) => {
  try {
    if (!['admin', 'user'].includes(req.body.role)) {
      return res.status(400).json({ message: 'Rol no válido' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role: req.body.role },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: ERROR_MESSAGES.USER_NOT_FOUND });
    }

    res.json({
      success: true,
      message: 'Rol actualizado',
      user
    });
  } catch (error) {
    console.error('Error actualizando rol:', error);
    res.status(500).json({ 
      success: false,
      message: ERROR_MESSAGES.DEFAULT_ERROR,
      error: error.message
    });
  }
};

// Bloquear/desbloquear usuario
export const toggleUserLock = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: ERROR_MESSAGES.USER_NOT_FOUND });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.json({
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
    res.status(500).json({ 
      success: false,
      message: ERROR_MESSAGES.DEFAULT_ERROR,
      error: error.message
    });
  }
};

// Cambiar contraseña
export const updateUserPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ 
        message: 'La contraseña debe tener al menos 8 caracteres' 
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: ERROR_MESSAGES.USER_NOT_FOUND });
    }

    user.password = newPassword;
    await user.save();

    res.json({ 
      success: true,
      message: 'Contraseña actualizada' 
    });
  } catch (error) {
    console.error('Error actualizando contraseña:', error);
    res.status(500).json({ 
      success: false,
      message: ERROR_MESSAGES.DEFAULT_ERROR,
      error: error.message
    });
  }
};

// Editar datos de usuario
export const updateUserData = async (req, res) => {
  try {
    const { name, email } = req.body;
    
    if (!name || !email) {
      return res.status(400).json({ message: 'Nombre y email son requeridos' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { name, email },
      { 
        new: true, 
        runValidators: true,
        context: 'query' 
      }
    ).select('-password -refreshToken');

    if (!user) {
      return res.status(404).json({ message: ERROR_MESSAGES.USER_NOT_FOUND });
    }

    res.json({
      success: true,
      message: 'Datos actualizados',
      user
    });
  } catch (error) {
    console.error('Error actualizando datos:', error);
    const message = error.code === 11000 
      ? ERROR_MESSAGES.EMAIL_IN_USE 
      : ERROR_MESSAGES.DEFAULT_ERROR;
    
    res.status(500).json({
      success: false,
      message,
      error: error.message
    });
  }
};