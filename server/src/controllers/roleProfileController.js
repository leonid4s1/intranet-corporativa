// server/src/controllers/roleProfileController.js
import User from '../models/User.js';
import RoleProfile from '../models/RoleProfile.js';

/**
 * GET /api/roles-profile/me
 * Devuelve el perfil de rol del usuario autenticado
 */
export const getMyRoleProfile = async (req, res, next) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado',
      });
    }

    const user = await User.findById(userId).select('roleKey position').lean();
    if (!user || !user.roleKey) {
      return res.status(404).json({
        success: false,
        message: 'El usuario no tiene un rol asignado',
      });
    }

    const roleProfile = await RoleProfile.findOne({
      roleKey: user.roleKey,
      isActive: true,
    }).lean();

    if (!roleProfile) {
      return res.status(404).json({
        success: false,
        message: `No existe perfil de rol para "${user.roleKey}"`,
      });
    }

    return res.json({
      success: true,
      data: roleProfile,
    });
  } catch (error) {
    next(error);
  }
};
